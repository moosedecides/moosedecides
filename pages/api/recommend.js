import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

async function perplexity(prompt, options = {}) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      ...options,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return { content: data.choices[0].message.content, citations: data.citations || [] };
}

function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/\$[\d,]+(\.\d{1,2})?/);
  return match ? match[0] : null;
}

// Step 1: Get product names + prices
async function getRecommendations(query) {
  const prompt = `I want to buy: "${query}". Find exactly 3 specific products currently for sale with exact prices.

Format each product on its own line:
Product Name (brand + model) | $price

Include a citation number [1] after each line.
Order: best quality first, then best value, then lowest price.
No extra text, just the 3 lines.`;

  const { content } = await perplexity(prompt, { return_citations: true });

  const lines = content.split('\n').filter(l => l.includes('|') && /\$[\d]/.test(l));
  const products = lines.slice(0, 5).map(line => {
    const clean = line.replace(/\*\*/g, '').replace(/^\s*[-\d.)+*]+\s*/, '').replace(/\[\d+\]/g, '').trim();
    const parts = clean.split('|').map(s => s.trim());
    const title = parts[0].replace(/^\*+|\*+$/g, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    const pricePart = parts.find(p => /\$[\d]/.test(p));
    return {
      title,
      price: pricePart ? extractPrice(pricePart) : null,
    };
  }).filter(p => p.title && p.price && p.title.length > 3);

  if (products.length < 3) throw new Error(`Only found ${products.length} products`);
  return products.slice(0, 3);
}

// Step 2: For each product, find the real Amazon URL via ASIN lookup
async function findProductUrl(productName) {
  const prompt = `What is the Amazon ASIN for: "${productName}"? Reply with ONLY the 10-character ASIN like B09HMK7ZL8. Nothing else.`;

  const { content } = await perplexity(prompt, {
    search_domain_filter: ['amazon.com'],
  });

  const asin = content.trim().match(/\b[A-Z0-9]{10}\b/)?.[0];
  if (asin) return `https://www.amazon.com/dp/${asin}`;

  // Fallback: try to extract full URL from response
  const urlMatch = content.match(/https?:\/\/www\.amazon\.com\/[^\s\n"<\]]+/);
  if (urlMatch) return urlMatch[0].replace(/[.,\][\)]+$/, '');

  return `https://www.amazon.com/s?k=${encodeURIComponent(productName)}`;
}

// Step 3: Enrich with pros/cons/summary
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
[{"pros":["",""],"con":"","summary":""},{"pros":["",""],"con":"","summary":""},{"pros":["",""],"con":"","summary":""}]`,
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
    // Step 1: Get product names + prices
    const products = await getRecommendations(query);

    // Step 2: Fetch real Amazon URLs in parallel, retry once if fallback
    let urls = await Promise.all(products.map(p => findProductUrl(p.title)));
    // Retry any search-URL fallbacks once with a more specific query
    urls = await Promise.all(urls.map(async (url, i) => {
      if (url.includes('/s?k=')) {
        const retry = await findProductUrl(`${products[i].title} buy now`);
        return retry.includes('/dp/') ? retry : url;
      }
      return url;
    }));

    // Step 3: Enrich with pros/cons
    const enriched = await enrichProducts(products, query);

    // Step 4: Build final results
    const labels = ['Top Pick', 'Best Value', 'Budget'];
    const results = products.map((p, i) => ({
      label: labels[i],
      title: p.title,
      price: p.price,
      link: urls[i],
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
