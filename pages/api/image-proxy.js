export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://serpapi.com',
      },
    });

    if (!response.ok) return res.status(response.status).end();

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch {
    res.status(500).end();
  }
}
