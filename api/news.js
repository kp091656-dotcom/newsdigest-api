export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_TOKEN = process.env.THENEWSAPI_TOKEN;
  if (!API_TOKEN) return res.status(500).json({ error: 'API token not configured' });

  const { type = 'all', page = 1 } = req.query;

  const domains = 'bloomberg.com,reuters.com,cnbc.com,wsj.com,ft.com,seekingalpha.com,finance.yahoo.com';
  const published_after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let url;
  if (type === 'top') {
    url = `https://api.thenewsapi.com/v1/news/top?api_token=${API_TOKEN}&language=en&limit=10&page=${page}&categories=business,tech,politics`;
  } else {
    url = `https://api.thenewsapi.com/v1/news/all?api_token=${API_TOKEN}&domains=${domains}&language=en&limit=10&page=${page}&published_after=${published_after}&sort=published_at`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
