import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY;

const PREFERRED_RETAILERS = [
  'amazon.com', 'apple.com', 'target.com', 'bestbuy.com', 'walmart.com',
  'rei.com', 'zappos.com', 'adidas.com', 'nike.com', 'trekbikes.com',
  'homedepot.com', 'lowes.com', 'bhphotovideo.com', 'newegg.com',
  'costco.com', 'nordstrom.com', 'macys.com', 'dickssportinggoods.com'
];

async function searchGoogleShopping(query, priceRange) {
  let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=us&hl=en&num=20&api_key=${SERP_KEY}`;
  if (priceRange && priceRange[0] > 0) url += `&price_low=${priceRange[0]}`;
  if (priceRange && priceRange[1] < 10000) url += `&price_high=${priceRange[1]}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);
  const data = await res.json();
  return data.shopping_results || [];
}

async function getProductLink(result) {
  if (!result.serpapi_immersive_product_api) return null;
  try {
    const url = result.serpapi_immersive_product_api + `&api_key=${SERP_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const stores = data.product_results?.stores || [];
    if (stores.length === 0) return null;
    const preferred = stores.find(s =>
      PREFERRED_RETAILERS.some(r => s.link?.toLowerCase().includes(r))
    );
    return (preferred || stores[0])?.link || null;
  } catch {
    return null;
  }
}

async function rankAndEnrich(products, query, refinement, priceRange) {
  const productList = products.map((p, i) =>
    `${i}: ${p.title} | ${p.price || '?'} | rating: ${p.rating || '?'} | reviews: ${p.reviews || 0}`
  ).join('\n');

  let userContext = `User wants: "${query}"`;
  if (refinement) userContext += `\nUser's refinement: "${refinement}"`;
  if (priceRange && (priceRange[0] > 0 || priceRange[1] < 10000)) {
    userContext += `\nBudget: $${priceRange[0]} – $${priceRange[1]}`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You are Moose. You pick the single best product for what the user actually needs. Brutally honest. Never favor brands or popularity. If the user gave a refinement, prioritize that feedback heavily.`
    }, {
      role: 'user',
      content: `${userContext}

Products:
${productList}

Pick 3:
- TOP PICK: best overall for what they asked
- BEST VALUE: best quality per dollar
- BUDGET: cheapest that genuinely works

Rules:
- Skip anything below 3.5 stars or under 10 reviews
- If user gave a budget, all picks MUST be in range
- If user gave a refinement, weight it heavily
- If nothing qualifies, pick highest rated

Return for each:
- "index": product number
- "summary": why this product fits them (MAX 15 words, be specific to their needs)
- "pros": array of 1-3 strengths (MAX 5 words each)
- "con": 1 honest weakness (MAX 6 words) or "" if none

ONLY return JSON:
[{"index":0,"summary":"","pros":[""],"con":""},{"index":0,"summary":"","pros":[""],"con":""},{"index":0,"summary":"","pros":[""],"con":""}]`
    }],
    temperature: 0.2,
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON from GPT');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query, refinement, priceRange } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    let searchQuery = query;
    if (refinement) searchQuery = `${query} ${refinement}`;

    const shoppingResults = await searchGoogleShopping(searchQuery, priceRange);
    if (!shoppingResults.length) throw new Error('No products found');

    const ranked = await rankAndEnrich(shoppingResults.slice(0, 15), query, refinement, priceRange);
    const selectedProducts = ranked.map(r => shoppingResults[r.index]);
    const links = await Promise.all(selectedProducts.map(p => getProductLink(p)));

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
        rating: (product.rating && product.reviews >= 10) ? Math.round(product.rating * 2 * 10) / 10 : null,
        reviews: (product.reviews >= 10) ? product.reviews : null,
        pros: r.pros || ['Well reviewed'],
        con: r.con || '',
        summary: r.summary || '',
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
