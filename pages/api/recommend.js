import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

// Step 1: Use Perplexity to find real products with real prices
async function searchProducts(query) {
  const prompt = `You are a shopping assistant. Find exactly 3 specific products to buy for: "${query}"

Search for real products currently available for purchase. For each product find:
- The exact product name (brand + model)
- The current retail price
- The direct product page URL (not a category or search page — the actual individual product listing)

Return ONLY valid JSON, no markdown, no explanation:
[
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://exact-product-page-url"},
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://exact-product-page-url"},
  {"title": "Brand Model Name", "price": "$XX.XX", "url": "https://exact-product-page-url"}
]

Order: [0] = best quality, [1] = best value, [2] = most affordable
Prefer: official brand sites, Amazon individual product pages, major retailers
Never use: search result pages, category pages`;

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
    }),
  });

  if (!res.ok) throw new Error(`Perplexity error: ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;
  const citations = data.citations || [];

  // Parse JSON from response
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON in Perplexity response');
  const products = JSON.parse(match[0]);

  // Validate and fix URLs using citations if needed
  return products.map((p, i) => ({
    ...p,
    url: isValidProductUrl(p.url) ? p.url : (citations[i] || p.url),
    price: p.price || null,
  }));
}

function isValidProductUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Reject category pages, search pages
    const bad = ['/s?k=', '/search?', '/c/kp/', '/category/', '/collections/', '/browse/', '/b/'];
    return bad.every(b => !u.pathname.includes(b) && !u.search.includes('k='));
  } catch {
    return false;
  }
}

// Validate a URL is reachable
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

// Step 2: GPT picks pros/cons/summary for each product
async function enrichProducts(products, query) {
  const productList = products.map((p, i) =>
    `${i + 1}. ${p.title} — ${p.price}`
  ).join('\n');

  const prompt = `User is looking for: "${query}"

Here are 3 products found from live search:
${productList}

For each product write:
- 2 very short pros (max 5 words each)
- 1 short con (max 7 words)
- 1 "best for" line (max 8 words, no period)

Return ONLY this JSON:
[
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for who and why"},
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for who and why"},
  {"pros": ["Pro 1", "Pro 2"], "con": "Con here", "summary": "Best for who and why"}
]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0].message.content;
  // Response format wraps in object — extract array
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : (parsed.results || parsed.products || Object.values(parsed)[0]);
  return arr;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Step 1: Get real products + prices from Perplexity
    const products = await searchProducts(query);
    if (!products || products.length < 3) throw new Error('Not enough products found');

    // Step 2: Validate URLs in parallel, replace broken ones with Amazon search fallback
    const validatedProducts = await Promise.all(
      products.map(async (p) => {
        const valid = isValidProductUrl(p.url) && await validateUrl(p.url);
        return {
          ...p,
          url: valid ? p.url : `https://www.amazon.com/s?k=${encodeURIComponent(p.title)}`,
          urlValid: valid,
        };
      })
    );

    // Step 3: Enrich with pros/cons from GPT
    const enriched = await enrichProducts(validatedProducts, query);

    // Step 4: Merge
    const labels = ['Top Pick', 'Best Value', 'Budget'];
    const results = validatedProducts.map((p, i) => ({
      label: labels[i],
      title: p.title,
      price: p.price,
      link: p.url,
      pros: enriched[i]?.pros || ['Good quality', 'Reliable'],
      con: enriched[i]?.con || 'Check reviews',
      summary: enriched[i]?.summary || '',
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Recommend error:', err);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
