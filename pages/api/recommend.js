import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

const RETAILER_DOMAINS = ['amazon.com', 'walmart.com', 'target.com', 'bestbuy.com', 'wayfair.com', 'homedepot.com', 'costco.com'];

function extractPrice(text) {
  const match = text.match(/\$[\d,]+(\.\d{1,2})?/);
  return match ? match[0] : null;
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s|)\]"[]+/);
  return match ? match[0].replace(/[.,;[\]]+$/, '') : null;
}

async function searchProducts(query) {
  const prompt = `I want to buy: "${query}". Search Amazon.com, Walmart.com, Target.com, and BestBuy.com for real current listings. Give me exactly 3 specific products with exact prices currently for sale. Include the direct individual product page URL for each one (not a search or browse page).

Format each product on its own line exactly like this (no extra text on that line):
Product Name | $price | URL

Give me exactly 3 products. Order: best quality first, then best value, then lowest price.`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      return_citations: true,
      search_domain_filter: RETAILER_DOMAINS,
    }),
  });

  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;

  // Parse "Product Name | $price | URL" lines
  const lines = content.split('\n').filter(l => l.includes('|') && l.includes('$') && l.includes('http'));

  const products = lines.slice(0, 5).map(line => {
    // Strip markdown bold, leading numbers/bullets, citation refs like [1]
    const clean = line.replace(/\*\*/g, '').replace(/^\s*[-\d.)+*]+\s*/, '').replace(/\[\d+\]/g, '').trim();
    const parts = clean.split('|').map(s => s.trim());
    const title = parts[0].replace(/^\*+|\*+$/g, '').replace(/\[\d+\]/g, '').trim();
    const pricePart = parts.find(p => /\$[\d]/.test(p));
    const urlPart = parts.find(p => p.includes('http'));
    return {
      title,
      price: pricePart ? extractPrice(pricePart) : null,
      url: urlPart ? extractUrl(urlPart) : null,
    };
  }).filter(p => p.title && p.price && p.url && p.title.length > 3);

  if (products.length < 3) {
    console.error('Raw content:', content);
    throw new Error(`Only found ${products.length} valid products (need 3)`);
  }
  return products.slice(0, 3);
}

async function enrichProducts(products, query) {
  const list = products.map((p, i) => `${i + 1}. ${p.title} — ${p.price}`).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'user',
      content: `User searched: "${query}"

Products:
${list}

For each write:
- 2 pros (max 5 words each)
- 1 con (max 7 words)
- 1 "best for" line (max 8 words)

Return ONLY a JSON array:
[{"pros":["",""],"con":"","summary":""},{"pros":["",""],"con":"","summary":""},{"pros":["",""],"con":"","summary":""}]`
    }],
    temperature: 0.3,
    max_tokens: 400,
  });

  const raw = completion.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No enrichment JSON');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    const products = await searchProducts(query);
    const enriched = await enrichProducts(products, query);

    const labels = ['Top Pick', 'Best Value', 'Budget'];
    const results = products.map((p, i) => ({
      label: labels[i],
      title: p.title,
      price: p.price,
      link: p.url,
      pros: enriched[i]?.pros || ['Solid choice', 'Well reviewed'],
      con: enriched[i]?.con || 'Check reviews',
      summary: enriched[i]?.summary || '',
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
