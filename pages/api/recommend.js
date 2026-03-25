import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY;

const PREFERRED_RETAILERS = [
  'amazon.com', 'apple.com', 'target.com', 'bestbuy.com', 'walmart.com',
  'rei.com', 'zappos.com', 'adidas.com', 'nike.com', 'trekbikes.com',
  'homedepot.com', 'lowes.com', 'bhphotovideo.com', 'newegg.com',
  'costco.com', 'nordstrom.com', 'macys.com', 'dickssportinggoods.com'
];

// ——— SIMPLE IN-MEMORY CACHE (24 hours) ———
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCacheKey(query, priceRange) {
  const norm = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const pr = priceRange ? `${priceRange[0]}-${priceRange[1]}` : 'any';
  return `${norm}|${pr}`;
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  // Prevent memory bloat — cap at 500 entries
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

// ——— STEP 0: Screen query (jokes, NSFW, directions, advice, services) ———
async function screenQuery(query, priceRange) {
  let priceContext = '';
  if (priceRange && (priceRange[0] > 0 || priceRange[1] < 10000)) {
    priceContext = `\nPrice range set: $${priceRange[0]} to $${priceRange[1]}`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You screen queries for MooseDecides, a product recommendation site. Determine if this is a legitimate PRODUCT PURCHASE search.

ONLY flag as NOT legit if the query is:
- Asking for sex workers, prostitutes, escorts, or sexual services
- Asking to harm or kill someone
- Pure gibberish with no meaning
- Asking for illegal drugs by name
- A joke that has NOTHING to do with any purchasable product
- Asking for DIRECTIONS or LOCATIONS ("where is", "near me", "find a", "around me") for services like restaurants, stores, mechanics, etc. — these are not product searches
- Asking for ADVICE or LIFE HELP ("what should I do", "how do I deal with", "help me with my") — not product searches
- Asking about PEOPLE by name in a non-product context
- Asking questions that aren't about buying something

NEVER flag:
- Any real purchasable product, no matter how niche
- Budget products — cheap products exist everywhere
- Anything that COULD be a real product
- Sports equipment, electronics, appliances, parts, accessories, tools, clothing, bikes, etc.

For price ranges, ONLY roast if COMICALLY impossible: $0-$25 for a car, $0-$10 for a laptop. If ANY chance products exist at that price, let it through.

If legit: {"legit": true}
If not legit: {"legit": false, "response": "<funny 1-2 sentence roast tailored to their query>"}

Roast examples:
- Prostitute: "There's a shortage in your area and they're hiring. Based on your search, you'd be a great fit — want to apply?"
- Directions to jiffy lube: "Moose finds products, not oil change shops. Try Google Maps — it's free and won't judge you."
- "What should I do about my friend": "Moose sells products, not life advice. But between us... you already know the answer."
- Harm someone: "Moose recommends a therapist instead. Way better ROI."
- Laptop for $10: "For $10, Moose can get you a very convincing drawing of a laptop."

When in doubt, respond {"legit": true}.`
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

// ——— STEP 1: Smart query preprocessing ———
async function buildSmartQuery(originalQuery) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You are a product search expert. Convert the user's query into the BEST Google Shopping search query.

Rules:
- If user mentions a model number and wants a COMPATIBLE PART, figure out the exact part. Example: "water filter for GE GNE27JYMNFFS" → "GE XWFE refrigerator water filter"
- If user mentions body size (height, weight) for sized products (bikes, clothing, shoes), include the appropriate size in the query. Examples:
  - "hybrid bike for 6'2 250lb man" → "hybrid bike XL frame"
  - "running shoes for wide feet size 12" → "running shoes wide size 12"
  - "wetsuit for 5'10 180lb" → "wetsuit large tall"
- Remove filler words ("best", "good", "recommend")
- Keep under 10 words
- Translate use cases to features: "chair for 10hr sitting" → "ergonomic office chair lumbar support"
- If unsure about compatibility, keep model number as fallback

Return JSON:
{"query": "optimized search", "note": "1-sentence context or '' if nothing special", "size": "detected size like XL, size 12, etc. or '' if none"}`
    }, {
      role: 'user',
      content: originalQuery
    }],
    temperature: 0.2,
    max_tokens: 120,
  });

  const raw = completion.choices[0].message.content.trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { query: originalQuery, note: '', size: '' };
}

// ——— STEP 2: Search Google Shopping ———
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

// ——— STEP 3: Get retailer link ———
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

// ——— STEP 4: GPT ranks — strict price enforcement, all 3 must be different ———
async function rankAndEnrich(products, query, refinement, priceRange, smartNote) {
  const productList = products.map((p, i) =>
    `${i}: ${p.title} | ${p.price || '?'} | rating: ${p.rating || '?'} | reviews: ${p.reviews || 0}`
  ).join('\n');

  let userContext = `User wants: "${query}"`;
  if (refinement) userContext += `\nUser's refinement: "${refinement}"`;
  if (priceRange && (priceRange[0] > 0 || priceRange[1] < 10000)) {
    userContext += `\nBudget: $${priceRange[0]} – $${priceRange[1]}. STRICT: Every pick MUST have a price within this range. If a product costs more than $${priceRange[1]} or less than $${priceRange[0]}, do NOT pick it.`;
  }
  if (smartNote) userContext += `\nContext: ${smartNote}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'system',
      content: `You are Moose. Pick the best products. Brutally honest. Never favor brands.

CRITICAL RULES:
1. If user set a budget, EVERY pick must have a price WITHIN that range. Parse the dollar amount from the price field and compare it to the budget. If the price exceeds the max budget, DO NOT pick it.
2. All 3 picks MUST be DIFFERENT products. Never pick the same product twice.
3. BUDGET pick must be the CHEAPEST of the three. TOP PICK can be any price in range. BEST VALUE should balance quality and price.
4. If a smart context note identifies a specific compatible product, prioritize it.`
    }, {
      role: 'user',
      content: `${userContext}

Products:
${productList}

Pick 3 DIFFERENT products:
- TOP PICK: best overall for their needs (within budget)
- BEST VALUE: best quality per dollar (within budget)
- BUDGET: cheapest good option (must be lowest price of the 3)

Rules:
- Skip anything below 3.5 stars or under 10 reviews
- ALL prices must be within budget range
- All 3 must be DIFFERENT products (different index numbers)
- Budget must be the cheapest of the three
- If nothing qualifies within budget, pick closest options and note it

Return for each:
- "index": product number (all 3 must be different)
- "summary": why this fits (MAX 15 words)
- "pros": 1-3 strengths (MAX 5 words each)
- "con": 1 weakness (MAX 6 words) or ""

ONLY return JSON:
[{"index":0,"summary":"","pros":[""],"con":""},{"index":1,"summary":"","pros":[""],"con":""},{"index":2,"summary":"","pros":[""],"con":""}]`
    }],
    temperature: 0.2,
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON from GPT');
  const parsed = JSON.parse(match[0]);

  // Enforce: all 3 must have different indices
  const indices = parsed.map(p => p.index);
  if (new Set(indices).size < 3) {
    // Deduplicate by picking next available product
    const used = new Set();
    for (const pick of parsed) {
      if (used.has(pick.index)) {
        for (let j = 0; j < products.length; j++) {
          if (!used.has(j)) { pick.index = j; break; }
        }
      }
      used.add(pick.index);
    }
  }

  return parsed;
}

// ——— MAIN HANDLER ———
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query, refinement, priceRange } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Check cache first
    const cacheKey = getCacheKey(refinement ? `${query} ${refinement}` : query, priceRange);
    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Run screening AND smart query in PARALLEL
    const searchText = refinement ? `${query} ${refinement}` : query;
    const [screen, smart] = await Promise.all([
      screenQuery(searchText, priceRange),
      buildSmartQuery(searchText),
    ]);

    // Check screening result
    if (!screen.legit) {
      const response = { easter_egg: true, message: screen.response || "Moose can't help with that one." };
      return res.status(200).json(response);
    }

    const smartQuery = smart.query || searchText;

    // Search with smart query
    let shoppingResults = await searchGoogleShopping(smartQuery, priceRange);

    // Fallback: original query with price filter
    if (!shoppingResults.length && smartQuery !== searchText) {
      shoppingResults = await searchGoogleShopping(searchText, priceRange);
    }

    // Fallback: smart query without price filter
    if (!shoppingResults.length && priceRange) {
      shoppingResults = await searchGoogleShopping(smartQuery, null);
    }

    // Fallback: simplified query
    if (!shoppingResults.length) {
      const simple = query.split(' ').slice(0, 4).join(' ');
      shoppingResults = await searchGoogleShopping(simple, null);
    }

    if (!shoppingResults.length) throw new Error('No products found');

    // If price range set, pre-filter results that are way outside budget
    let filtered = shoppingResults;
    if (priceRange && priceRange[1] < 10000) {
      const maxBudget = priceRange[1];
      const minBudget = priceRange[0];
      filtered = shoppingResults.filter(p => {
        if (!p.price) return true;
        const num = parseFloat(p.price.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return true;
        return num >= minBudget * 0.9 && num <= maxBudget * 1.1; // 10% tolerance
      });
      // If filtering removed everything, use unfiltered
      if (filtered.length < 3) filtered = shoppingResults;
    }

    // Rank with context
    const ranked = await rankAndEnrich(
      filtered.slice(0, 15), query, refinement, priceRange, smart.note
    );
    const selectedProducts = ranked.map(r => filtered[r.index]);
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

    const response = { results, note: smart.note || null };

    // Cache the result
    setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Failed to get recommendations. Please try again.' });
  }
}
