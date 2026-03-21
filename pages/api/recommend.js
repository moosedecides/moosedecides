import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

const BAD_URL_PATTERNS = [
  '/s?k=', '/search?', '/search/', '/c/kp/', '/category/', '/browse/',
  '/collections/', '/b/', 'sb2/', '/kp/', 'N-5yc', '/pdp/search',
  '?q=', '&q=', '/results?',
];

const BAD_DOMAINS = [
  'rtings.com', 'wirecutter.com', 'cnet.com', 'pcmag.com', 'tomsguide.com',
  'techradar.com', 'reviewed.com', 'consumerreports.org', 'theverge.com',
  'youtube.com', 'reddit.com', 'wikipedia.org',
];

function isDirectProductUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (BAD_DOMAINS.some(d => u.hostname.includes(d))) return false;
    return BAD_URL_PATTERNS.every(p => !url.includes(p));
  } catch {
    return false;
  }
}

async function validateUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res.ok || res.status === 405 || res.status === 403;
  } catch {
    return false;
  }
}

async function searchProducts(query) {
  const prompt = `Find 3 specific products available for purchase right now for: "${query}"

Requirements:
- URL must be a RETAILER product page (Amazon, Target, Best Buy, Walmart, Wayfair, brand store, etc.)
- URL must be a direct individual product listing — NOT a review site, NOT a search page, NOT a category page
- Price must be an exact dollar amount like $49.99 — NOT "under $100" or "starting at" or a range
- If you cannot find an exact price, skip that product and find another

GOOD urls: https://www.amazon.com/dp/B0XXXXXXXX or https://www.bestbuy.com/site/product/XXXXX.p or https://www.target.com/p/product/-/A-XXXXX
BAD urls: https://www.rtings.com/... or any review site, any /search/, any /s?k=, any /category/

Return ONLY this JSON array — no text before or after:
[
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://retailer.com/product/..."},
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://retailer.com/product/..."},
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://retailer.com/product/..."}
]

Order: [0] best quality, [1] best value, [2] most affordable`;

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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  // Extract JSON array from response
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in Perplexity response');

  const products = JSON.parse(match[0]);
  if (!Array.isArray(products) || products.length < 3) throw new Error('Not enough products returned');

  return products;
}

async function enrichProducts(products, query) {
  const productList = products.map((p, i) =>
    `${i + 1}. ${p.title} — ${p.price}`
  ).join('\n');

  const prompt = `User searched for: "${query}"

Products found:
${productList}

Write for each product:
- 2 short pros (max 5 words each)  
- 1 short con (max 7 words)
- 1 "best for" line (max 8 words, no period)

Return ONLY this JSON array:
[
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for line"},
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for line"},
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for line"}
]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in GPT response');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Step 1: Perplexity finds real products with real prices and direct URLs
    const products = await searchProducts(query);

    // Reject products with vague prices
    const cleanProducts = products.map(p => ({
      ...p,
      price: /\$\d+(\.\d{2})?/.test(p.price) ? p.price.match(/\$[\d,]+(\.\d{2})?/)[0] : null,
    }));

    // Step 2: Validate URLs — reject category/search pages, verify reachable
    const validatedProducts = await Promise.all(
      cleanProducts.map(async (p) => {
        const isDirect = isDirectProductUrl(p.url);
        const isReachable = isDirect ? await validateUrl(p.url) : false;
        return {
          ...p,
          validUrl: isDirect && isReachable,
        };
      })
    );

    // Step 3: GPT enriches with pros/cons/summary
    const enriched = await enrichProducts(validatedProducts, query);

    // Step 4: Build final results
    const labels = ['Top Pick', 'Best Value', 'Budget'];
    const results = validatedProducts.map((p, i) => ({
      label: labels[i],
      title: p.title,
      price: p.price || null,
      link: p.validUrl ? p.url : `https://www.amazon.com/s?k=${encodeURIComponent(p.title)}`,
      linkDirect: p.validUrl,
      pros: enriched[i]?.pros || ['Quality option', 'Reliable'],
      con: enriched[i]?.con || 'Check reviews first',
      summary: enriched[i]?.summary || '',
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Recommend error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
