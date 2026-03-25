import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY;

const PREFERRED_RETAILERS = [
  'amazon.com', 'apple.com', 'target.com', 'bestbuy.com', 'walmart.com',
  'rei.com', 'zappos.com', 'adidas.com', 'nike.com', 'trekbikes.com',
  'homedepot.com', 'lowes.com', 'bhphotovideo.com', 'newegg.com',
  'costco.com', 'nordstrom.com', 'macys.com', 'dickssportinggoods.com'
];

// Step 0: Screen for jokes/NSFW/absurd pricing
async function screenQuery(query, priceRange) {
  let priceContext = '';
  if (priceRange && (priceRange[0] > 0 || priceRange[1] < 10000)) {
    priceContext = `\nPrice range set: $${priceRange[0]} to $${priceRange[1]}`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You screen queries for MooseDecides, a product recommendation site.

IMPORTANT: Be VERY lenient. Almost everything should pass as legit.

ONLY flag as not legit if the query is:
- Explicitly asking for sex workers, prostitutes, escorts, or sexual services (not sexual products — those are fine)
- Explicitly asking to harm or kill someone
- Pure gibberish with no meaning whatsoever
- Asking for illegal drugs by name
- Clearly a joke that has NOTHING to do with any purchasable product

NEVER flag:
- Any real product, no matter how niche or unusual
- Budget products or cheap items — cheap products exist in every category
- Anything that COULD be a real product even if it sounds weird
- Sports equipment, home improvement, electronics, appliances, filters, parts, accessories
- Any product with an adjective like "fixed", "outdoor", "hybrid", "portable", etc.

For price ranges, ONLY roast if the budget is COMICALLY impossible — like $0-$25 for a car, $0-$10 for a laptop, $0-$5 for furniture. If there's ANY chance products exist at that price point, let it through. When in doubt, LET IT THROUGH.

If legit: {"legit": true}
If not legit: {"legit": false, "response": "<funny 1-2 sentence roast>"}

Examples:
- Prostitute query: "There's a shortage in your area and they're hiring. You'd be a great fit — want to apply?"
- Knife to stab husband: "Moose recommends a therapist instead. Way better ROI."
- Laptop for $0-$10: "For $10, Moose can get you a very convincing drawing of a laptop."
- Car for $0-$25: "We haven't seen those prices since horse-and-buggy days, kiddo."

When in doubt, respond {"legit": true}. False positives are much worse than letting a joke through.`
    }, {
      role: 'user',
      content: `Query: "${query}"${priceContext}`
    }],
    temperature: 0.3,
    max_tokens: 150,
  });

  const raw = completion.choices[0].message.content.trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { legit: true };
}

// Step 1: Smart query preprocessing — AI figures out what to actually search for
async function buildSmartQuery(originalQuery) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You are a product search expert. Convert the user's query into the BEST possible Google Shopping search query.

Key rules:
- If the user mentions a specific model number, appliance, or device and wants a COMPATIBLE PART or ACCESSORY, figure out the exact compatible product and search for THAT. Example: "water filter for GE GNE27JYMNFFS" → compatible filter is GE XWFE → search "GE XWFE refrigerator water filter"
- If the query is already a good product search, clean it up and return it
- Remove filler words like "best", "good", "recommend" — Google Shopping doesn't need them
- Keep it under 10 words
- If the user mentions a use case, translate to product features. Example: "chair for someone who sits 10 hours" → "ergonomic office chair lumbar support"
- If unsure about compatibility, keep the model number in the search as a fallback

Return JSON:
{"query": "optimized search query", "note": "1-sentence note about what you found, like 'The compatible filter for this model is the GE XWFE' or '' if nothing special"}`
    }, {
      role: 'user',
      content: originalQuery
    }],
    temperature: 0.2,
    max_tokens: 100,
  });

  const raw = completion.choices[0].message.content.trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { query: originalQuery, note: '' };
}

// Step 2: Search Google Shopping
async function searchGoogleShopping(query, priceRange) {
  let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=us&hl=en&num=20&api_key=${SERP_KEY}`;
  if (priceRange) {
    if (priceRange[0] > 0) url += `&price_low=${priceRange[0]}`;
    if (priceRange[1] < 10000) url += `&price_high=${priceRange[1]}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);
  const data = await res.json();
  return data.shopping_results || [];
}

// Step 3: Get direct retailer link
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

// Step 4: GPT ranks and enriches with context
async function rankAndEnrich(products, query, refinement, priceRange, smartNote) {
  const productList = products.map((p, i) =>
    `${i}: ${p.title} | ${p.price || '?'} | rating: ${p.rating || '?'} | reviews: ${p.reviews || 0}`
  ).join('\n');

  let userContext = `User wants: "${query}"`;
  if (refinement) userContext += `\nUser's refinement: "${refinement}"`;
  if (priceRange && (priceRange[0] > 0 || priceRange[1] < 10000)) {
    userContext += `\nBudget: $${priceRange[0]} – $${priceRange[1]}. All picks MUST be within this range.`;
  }
  if (smartNote) {
    userContext += `\nImportant context: ${smartNote}`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You are Moose. Pick the best product for the user's needs. Brutally honest. Never favor brands or popularity. If there is "Important context" provided, use it to make better picks — for example if it says a specific model is compatible, prioritize that exact model.`
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
- ALL picks MUST be within budget if one was set
- If important context identifies a specific compatible product, prioritize it
- If user gave a refinement, weight it heavily
- If nothing qualifies, pick highest rated within budget

Return for each:
- "index": product number
- "summary": why this fits them (MAX 15 words, specific to needs)
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

// Main handler
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query, refinement, priceRange } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Screen for jokes/NSFW/absurd pricing
    const screen = await screenQuery(refinement || query, priceRange);
    if (!screen.legit) {
      return res.status(200).json({
        easter_egg: true,
        message: screen.response || "Moose can't help with that one.",
      });
    }

    // Smart query preprocessing
    let searchText = query;
    if (refinement) searchText = `${query} ${refinement}`;
    const smart = await buildSmartQuery(searchText);
    const smartQuery = smart.query || searchText;

    // Search with smart query
    let shoppingResults = await searchGoogleShopping(smartQuery, priceRange);

    // Fallback: try original query if smart query returned nothing
    if (!shoppingResults.length && smartQuery !== searchText) {
      shoppingResults = await searchGoogleShopping(searchText, priceRange);
    }

    // Fallback: try without price filter
    if (!shoppingResults.length && priceRange) {
      shoppingResults = await searchGoogleShopping(smartQuery, null);
    }

    // Fallback: try simplified original query
    if (!shoppingResults.length) {
      const simpleQuery = query.split(' ').slice(0, 4).join(' ');
      shoppingResults = await searchGoogleShopping(simpleQuery, null);
    }

    if (!shoppingResults.length) throw new Error('No products found');

    // Rank with full context including smart note
    const ranked = await rankAndEnrich(
      shoppingResults.slice(0, 15), query, refinement, priceRange, smart.note
    );
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

    return res.status(200).json({ results, note: smart.note || null });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
