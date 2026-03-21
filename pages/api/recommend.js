import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

// Review/content sites — not retail
const BAD_DOMAINS = [
  'rtings.com', 'wirecutter.com', 'cnet.com', 'pcmag.com', 'tomsguide.com',
  'techradar.com', 'reviewed.com', 'consumerreports.org', 'theverge.com',
  'youtube.com', 'reddit.com', 'wikipedia.org', 'businessinsider.com',
  'forbes.com', 'nytimes.com', 'buzzfeed.com',
  // Short link / affiliate redirect domains
  'geni.us', 'bit.ly', 'amzn.to', 'tinyurl.com', 'ow.ly', 'short.io',
];

// URL patterns that are search/category pages
const BAD_URL_PATTERNS = [
  '/s?k=', '/search?', '/search/', '/c/kp/', '/category/', '/browse/',
  '/collections/', 'sb2/', '/kp/', 'N-5yc', '?q=', '&q=', '/results?',
];

function isRetailerProductUrl(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const u = new URL(url);
    if (BAD_DOMAINS.some(d => u.hostname.includes(d))) return false;
    if (BAD_URL_PATTERNS.some(p => url.includes(p))) return false;
    return true;
  } catch {
    return false;
  }
}

function extractPrice(raw) {
  if (!raw) return null;
  const match = raw.match(/\$[\d,]+(\.\d{1,2})?/);
  return match ? match[0] : null;
}

async function searchProducts(query) {
  const prompt = `Find 3 specific products available to buy right now for: "${query}"

I need:
1. The exact product name (brand + model)
2. The exact current retail price (like $49.99 — not "under $100", not a range)
3. A working retailer product page URL (Amazon, Walmart, Target, Best Buy, Wayfair, brand site, etc.)
   - Must be an individual product page, not a search or category page
   - Amazon URLs should look like: https://www.amazon.com/dp/XXXXXXXXX
   - Other retailers: use the actual full product listing URL
   - Do NOT use shortened URLs (geni.us, bit.ly, amzn.to, tinyurl, etc.)

Return ONLY this JSON array with no text before or after:
[
  {"title": "Brand Model", "price": "$XX.XX", "url": "https://..."},
  {"title": "Brand Model", "price": "$XX.XX", "url": "https://..."},
  {"title": "Brand Model", "price": "$XX.XX", "url": "https://..."}
]

Index 0 = best quality, index 1 = best value, index 2 = lowest price`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;

  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No product list returned');
  return JSON.parse(match[0]);
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

For each, write:
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
    // Step 1: Get real products from Perplexity live search
    const raw = await searchProducts(query);

    // Step 2: Clean up each product
    const products = raw.slice(0, 3).map(p => {
      const price = extractPrice(p.price);
      const url = isRetailerProductUrl(p.url)
        ? p.url
        : `https://www.amazon.com/s?k=${encodeURIComponent(p.title.replace(/\s+/g, '+'))}`;
      return { title: p.title, price, url };
    });

    // Step 3: Enrich with pros/cons/summary
    const enriched = await enrichProducts(products, query);

    // Step 4: Build response
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
