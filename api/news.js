export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint = 'news', page = 1 } = req.query;

  // CNN Fear & Greed proxy (no API key needed)
  if (endpoint === 'fgi') {
    try {
      const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata');
      const data = await r.json();
      res.status(200).json(data);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // News proxy
  const API_TOKEN = process.env.THENEWSAPI_TOKEN;
  if (!API_TOKEN) return res.status(500).json({ error: 'API token not configured' });

  const domains = 'bloomberg.com,reuters.com,cnbc.com,wsj.com,ft.com,seekingalpha.com,finance.yahoo.com';
  const published_after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.thenewsapi.com/v1/news/all?api_token=${API_TOKEN}&domains=${domains}&language=en&limit=3&page=${page}&published_after=${published_after}&sort=published_at`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
