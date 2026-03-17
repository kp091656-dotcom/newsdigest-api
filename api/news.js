export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint = 'news', source, page = 1 } = req.query;

  // CNN Fear & Greed proxy
  if (endpoint === 'fgi') {
    try {
      const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://edition.cnn.com/',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      res.status(200).json(data);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // VIX via Yahoo Finance
  if (endpoint === 'vix') {
    try {
      const symbols = ['^VIX', '^VVIX', '^VIX9D', '^VIX3M', '^VIX6M'];
      const results = await Promise.all(symbols.map(async s => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const q = d?.chart?.result?.[0]?.meta;
        return {
          symbol: s,
          price: q?.regularMarketPrice ?? null,
          prev: q?.chartPreviousClose ?? null,
          name: q?.shortName ?? s,
        };
      }));
      res.status(200).json({ data: results });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // News proxy - fetch per source to ensure diversity
  const API_TOKEN = process.env.THENEWSAPI_TOKEN;
  if (!API_TOKEN) return res.status(500).json({ error: 'API token not configured' });

  const published_after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // If specific source requested, fetch that source only
  const domain = source || 'bloomberg.com,reuters.com,cnbc.com,wsj.com,ft.com,seekingalpha.com,finance.yahoo.com';
  const url = `https://api.thenewsapi.com/v1/news/all?api_token=${API_TOKEN}&domains=${domain}&language=en&limit=3&page=${page}&published_after=${published_after}&sort=published_at`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
