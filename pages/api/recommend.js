import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Step 1: Use web search to find real product pages + extract prices
async function findProductWithLiveData(productName, query) {
  const searchPrompt = `Find a real product page for: "${productName}" (context: user searched for "${query}")

Search for the exact product on major retailers (brand site, Amazon, Target, Best Buy, Home Depot, etc.).

Return ONLY this JSON structure, nothing else:
{
  "title": "exact product name from the page",
  "price": "$XX.XX or null if not found",
  "link": "https://direct-product-page-url",
  "retailer": "Amazon/Target/BestBuy/etc"
}

Rules:
- link must be a direct product page (not a search results page)
- price must come from the actual page content
- if you cannot find a real product page with a verifiable price, set price to null
- prefer brand official site > Amazon > Target > other retailers`;

  try {
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: searchPrompt,
    });

    // Extract text from response
    const text = response.output
      .filter(b => b.type === 'message')
      .flatMap(b => b.content)
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('');

    // Parse JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (err) {
    console.error('Web search error for', productName, err.message);
  }
  return null;
}

// Step 2: Use web search to get the 3 best recommendations
async function getRecommendations(query) {
  const prompt = `You are a product recommendation expert. For the query: "${query}"

Recommend exactly 3 products:
1. Top Pick — best overall quality
2. Best Value — best quality for the price
3. Budget — lowest price option that still works

For each product provide:
- Specific brand and model name (e.g. "Herman Miller Aeron Chair" not just "ergonomic chair")
- Exactly 2 short pros (max 6 words each)
- Exactly 1 short con (max 8 words)
- Exactly 1 summary sentence (max 12 words)

Return ONLY this JSON, no other text:
{
  "results": [
    {
      "title": "Brand Model Name",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con here",
      "summary": "One sentence summary max 12 words."
    },
    {
      "title": "Brand Model Name",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con here",
      "summary": "One sentence summary max 12 words."
    },
    {
      "title": "Brand Model Name",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con here",
      "summary": "One sentence summary max 12 words."
    }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  if (!parsed.results || parsed.results.length !== 3) {
    throw new Error('Invalid recommendation structure');
  }
  return parsed.results;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

  try {
    // Step 1: Get product recommendations
    const recommendations = await getRecommendations(query);

    // Step 2: For each recommendation, find real product page with live price
    // Run all 3 in parallel for speed
    const liveData = await Promise.all(
      recommendations.map(r => findProductWithLiveData(r.title, query))
    );

    // Step 3: Merge
    const results = recommendations.map((rec, i) => {
      const live = liveData[i];
      return {
        title: live?.title || rec.title,
        price: live?.price || null,
        pros: rec.pros,
        con: rec.con,
        summary: rec.summary,
        link: live?.link || `https://www.amazon.com/s?k=${encodeURIComponent(rec.title)}`,
        retailer: live?.retailer || null,
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Recommend error:', err);
    return res.status(500).json({ error: 'Failed to get recommendations' });
  }
}
