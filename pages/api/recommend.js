import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY;
const PPLX_KEY = process.env.PERPLEXITY_API_KEY;

// Preferred retailers for link selection
const PREFERRED_RETAILERS = ['amazon.com', 'apple.com', 'target.com', 'bestbuy.com', 'walmart.com', 'rei.com', 'zappos.com', 'adidas.com', 'nike.com', 'trekbikes.com'];

// Step 1: Search Google Shopping for real products
async function searchGoogleShopping(query) {
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=us&hl=en&num=10&api_key=${SERP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);
  const data = await res.json();
  return data.shopping_results || [];
}

// Step 2: For a given shopping result, get direct retailer links via immersive product API
async function getProductLink(result) {
  if (!result.serpapi_immersive_product_api) {
    return null;
  }

  try {
    const url = result.serpapi_immersive_product_api + `&api_key=${SERP_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const stores = data.product_results?.stores || [];

    if (stores.length === 0) return null;

    // Pick preferred retailer first
    const preferred = stores.find(s =>
      PREFERRED_RETAILERS.some(r => s.link?.toLowerCase().includes(r))
    );
    const store = preferred || stores[0];
    return store?.link || null;
  } catch {
    return null;
  }
}

// Step 3: GPT selects Top Pick / Best Value / Budget and writes pros/cons
async function rankAndEnrich(products, query) {
  const productList = products.map((p, i) =>
    `${i}: ${p.title} | ${p.price} | ${p.source}`
  ).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'user',
      content: `User searched for: "${query}"

Available products:
${productList}

Pick the best 3 products:
- Index 0: Top Pick (best overall quality and value)
- Index 1: Best Value (best quality per dollar)
- Index 2: Budget (lowest price that still works well)

For each selected product write:
- "index": the product index number from the list
- "pros": array of exactly 2 short pros (max 5 words each)
- "con": exactly 1 short con (max 7 words)
- "summary": exactly 1 "best for" line (max 8 words, no period)

Return ONLY this JSON array:
[
  {"index": N, "pros": ["",""], "con": "", "summary": ""},
  {"index": N, "pros": ["",""], "con": "", "summary": ""},
  {"index": N, "pros": ["",""], "con": "", "summary": ""}
]`
    }],
    temperature: 0.3,
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON from GPT');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Step 1: Get real products from Google Shopping
    const shoppingResults = await searchGoogleShopping(query);
    if (!shoppingResults.length) throw new Error('No products found');

    // Step 2: GPT picks best 3 and enriches with pros/cons
    const ranked = await rankAndEnrich(shoppingResults.slice(0, 15), query);

    // Step 3: Get real retailer links for selected products (in parallel)
    const selectedProducts = ranked.map(r => shoppingResults[r.index]);
    const links = await Promise.all(selectedProducts.map(p => getProductLink(p)));

    // Step 4: Build final results
    const labels = ['Top Pick', 'Best Value', 'Budget'];
    const results = ranked.map((r, i) => {
      const product = selectedProducts[i];
      const link = links[i] || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(product.title)}`;
      return {
        label: labels[i],
        title: product.title,
        price: product.price,
        source: product.source,
        link,
        image: product.thumbnail || null,
        rating: product.rating ? Math.round(product.rating * 2 * 10) / 10 : null,
        reviews: product.reviews || null,
        pros: r.pros || ['Great choice', 'Well reviewed'],
        con: r.con || 'Check reviews',
        summary: r.summary || '',
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
