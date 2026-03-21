import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a product recommendation engine. When given a query, return ONLY valid JSON with exactly 3 product recommendations: Top Pick, Best Value, and Budget options.

Return this exact JSON structure with no extra text, no markdown, no explanation:
{
  "results": [
    {
      "title": "Product Name",
      "price": "$XX",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con",
      "summary": "One sentence summary.",
      "link": "https://www.amazon.com/s?k=product+name+url+encoded"
    },
    {
      "title": "Product Name",
      "price": "$XX",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con",
      "summary": "One sentence summary.",
      "link": "https://www.amazon.com/s?k=product+name+url+encoded"
    },
    {
      "title": "Product Name",
      "price": "$XX",
      "pros": ["Pro 1", "Pro 2"],
      "con": "One con",
      "summary": "One sentence summary.",
      "link": "https://www.amazon.com/s?k=product+name+url+encoded"
    }
  ]
}

Rules:
- ONLY return JSON. Nothing else.
- Each result must have exactly 2 pros and exactly 1 con
- Summary must be exactly 1 sentence
- Price must be realistic and accurate
- Recommendations must match the query precisely
- For the "link" field, generate an Amazon search URL using the exact brand and model name
- Format: https://www.amazon.com/s?k=Brand+Model+Name (URL encode spaces as +)
- Make the search query very specific: include brand name, model name, and key distinguishing feature
- Example: https://www.amazon.com/s?k=Herman+Miller+Aeron+Chair+No+Lumbar
- These links must always work and land on relevant results
- First result = best overall (Top Pick), second = best value for money, third = lowest price option`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const content = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(content);

    if (!parsed.results || parsed.results.length !== 3) {
      throw new Error('Invalid response structure');
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('OpenAI error:', err);
    return res.status(500).json({ error: 'Failed to get recommendations' });
  }
}
