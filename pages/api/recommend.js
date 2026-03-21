import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

// Sites that are NOT shopping destinations
const CONTENT_DOMAINS = [
  'rtings.com', 'wirecutter.com', 'cnet.com', 'pcmag.com', 'tomsguide.com',
  'techradar.com', 'reviewed.com', 'consumerreports.org', 'theverge.com',
  'youtube.com', 'reddit.com', 'wikipedia.org', 'businessinsider.com',
  'forbes.com', 'nytimes.com', 'buzzfeed.com', 'runnersworld.com',
  'outdoorgearlab.com', 'theruntesters.com', 'supwell.com', 'izreview.com',
  'tomshardware.com', 'tomsguide.com', 'keurigcoffee.blog',
  'geni.us', 'bit.ly', 'amzn.to', 'tinyurl.com',
];

// URL patterns that indicate category/search/browse pages
const CATEGORY_PATTERNS = [
  '/s?k=', '/search?', '/search/', '/c/', '/category/', '/browse/',
  '/collections/', 'sb2/', '?q=', '&q=', '/results?',
  '/mens/shoes/', '/womens/shoes/', '/mens-running-shoes/',
  '/shop/mac/', '/all-products', '/accessories/',
];

function isValidProductPage(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const u = new URL(url);
    if (CONTENT_DOMAINS.some(d => u.hostname.includes(d))) return false;
    if (CATEGORY_PATTERNS.some(p => url.includes(p))) return false;
    // Must have a meaningful path
    const path = u.pathname.replace(/\/$/, '');
    if (path.split('/').filter(Boolean).length < 1) return false;
    return true;
  } catch { return false; }
}

function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/\$[\d,]+(\.\d{1,2})?/);
  return match ? match[0] : null;
}

async function perplexity(prompt, opts = {}) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      ...opts,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    citations: data.citations || [],
  };
}

// Step 1: Get product recommendations with prices
async function getRecommendations(query) {
  const prompt = `I want to buy: "${query}". Give me exactly 3 specific products currently for sale with exact current prices.

For each product provide:
- Exact brand and model name
- Exact current retail price (like $49.99 — not a range, not "starting at")
- The best place to buy it (could be Amazon, manufacturer site, Best Buy, Zappos, REI, Target, Walmart, etc.)

Format each as one line:
Brand Model Name | $price | best-retailer-domain.com

Order: index 0 = best quality, index 1 = best value for money, index 2 = lowest price
Include citation numbers [1] [2] [3] after each line.`;

  const { content, citations } = await perplexity(prompt, { return_citations: true });
  return { content, citations };
}

// Step 2: For each product, find a real working product page URL
async function findBestUrl(productName, hintDomain, citations) {
  // First: check if any citation from the right domain is a valid product page
  if (hintDomain) {
    const matchingCitation = citations.find(c => {
      try {
        const clean = c.replace(/\[\d+\].*$/, '').trim();
        return new URL(clean).hostname.includes(hintDomain) && isValidProductPage(clean);
      } catch { return false; }
    });
    if (matchingCitation) return matchingCitation.replace(/\[\d+\].*$/, '').trim();
  }

  // Second: ask Perplexity to find the direct product page
  const siteHint = hintDomain ? ` on ${hintDomain}` : '';
  const prompt = `Find the direct product page URL for: "${productName}"${siteHint}.

Requirements:
- Must be a specific individual product listing page (not a search, category, or review page)
- Prefer the official brand site or major retailer
- Examples of good URLs: https://www.amazon.com/dp/B09XXXXXX or https://www.adidas.com/us/ultraboost-22-shoes/GX5591.html or https://www.rei.com/product/XXXXX/product-name

Reply with ONLY the URL. Nothing else.`;

  const { content } = await perplexity(prompt);
  const urlMatch = content.trim().match(/https?:\/\/[^\s\n"<\[]+/);
  if (urlMatch) {
    const url = urlMatch[0].replace(/[.,;)\][\s]+$/, '');
    if (isValidProductPage(url)) return url;
  }

  // Third: try to get it from a retailer search
  const { content: c2, citations: cits2 } = await perplexity(
    `Where can I buy "${productName}" online right now? Give me the direct product page URL from any major retailer or the brand's own website. Reply with ONLY the URL.`,
    { return_citations: true }
  );

  // Check citations first (most reliable)
  for (const cit of cits2) {
    if (isValidProductPage(cit)) return cit;
  }

  const urlMatch2 = c2.trim().match(/https?:\/\/[^\s\n"<\]]+/);
  if (urlMatch2) {
    const url = urlMatch2[0].replace(/[.,;)\][\s]+$/, '');
    if (isValidProductPage(url)) return url;
  }

  // Last resort: Google Shopping
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(productName)}`;
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
    // Step 1: Get product names + prices + retailer hints
    const { content, citations } = await getRecommendations(query);

    // Parse products
    const lines = content.split('\n').filter(l => l.includes('|') && /\$[\d]/.test(l));
    const parsed = lines.slice(0, 6).map(line => {
      const clean = line.replace(/\*\*/g, '').replace(/^\s*[-\d.)+*]+\s*/, '').replace(/\[\d+\]/g, '').trim();
      const parts = clean.split('|').map(s => s.trim());
      const title = parts[0].replace(/^\*+|\*+$/g, '').replace(/\s*\(.*?\)\s*$/, '').trim();
      const pricePart = parts.find(p => /\$[\d]/.test(p));
      const rawDomain = parts[2] ? parts[2].replace(/\[\d+\]/g, '').trim() : null;
      const domainPart = rawDomain ? rawDomain.replace(/https?:\/\//, '').split('/')[0].toLowerCase() : null;
      return {
        title,
        price: pricePart ? extractPrice(pricePart) : null,
        hintDomain: domainPart,
      };
    }).filter(p => p.title && p.price && p.title.length > 3).slice(0, 3);

    if (parsed.length < 3) throw new Error(`Only found ${parsed.length} products`);

    // Step 2: Find real URLs (sequential to avoid rate limits)
    const products = [];
    for (const p of parsed) {
      const url = await findBestUrl(p.title, p.hintDomain, citations);
      products.push({ ...p, url });
    }

    // Step 3: Enrich
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
