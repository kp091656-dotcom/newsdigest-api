export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint = 'news' } = req.query;

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
        return { symbol: s, price: q?.regularMarketPrice ?? null, prev: q?.chartPreviousClose ?? null, name: q?.shortName ?? s };
      }));
      res.status(200).json({ data: results });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // Global Futures via stooq.com (free, no API key, no CORS issues)
  if (endpoint === 'futures') {
    const FUTURES = [
      // 美股指數 - stooq format
      { symbol: '%5Edji',   name: '道瓊',        cat: '美股指數' },
      { symbol: '%5Espx',   name: 'S&P500',      cat: '美股指數' },
      { symbol: '%5Endx',   name: '那斯達克100', cat: '美股指數' },
      { symbol: '%5Erut',   name: '羅素2000',    cat: '美股指數' },
      { symbol: '%5Esox',   name: '費城半導體',  cat: '美股指數' },
      { symbol: '%5Edax',   name: '德國DAX',     cat: '美股指數' },
      // 亞股
      { symbol: '%5Etwii',  name: '台灣加權',    cat: '亞股指數' },
      { symbol: '%5Enk225', name: '日經225',     cat: '亞股指數' },
      { symbol: '%5Ehsi',   name: '香港恆生',    cat: '亞股指數' },
      { symbol: '%5Essi',   name: '新加坡STI',   cat: '亞股指數' },
      // 能源 - stooq NYMEX/ICE futures
      { symbol: 'cl.f',    name: '輕原油',      cat: '能源' },
      { symbol: 'ng.f',    name: '天然氣',      cat: '能源' },
      { symbol: 'ho.f',    name: '燃料油',      cat: '能源' },
      { symbol: 'rb.f',    name: '汽油',        cat: '能源' },
      // 金屬 - COMEX
      { symbol: 'gc.f',    name: '黃金',        cat: '金屬' },
      { symbol: 'si.f',    name: '白銀',        cat: '金屬' },
      { symbol: 'pl.f',    name: '白金',        cat: '金屬' },
      { symbol: 'hg.f',    name: '銅',          cat: '金屬' },
      { symbol: 'pa.f',    name: '鈀金',        cat: '金屬' },
      // 農產品 - CBOT
      { symbol: 'zs.f',    name: '黃豆',        cat: '農產品' },
      { symbol: 'zc.f',    name: '玉米',        cat: '農產品' },
      { symbol: 'zw.f',    name: '小麥',        cat: '農產品' },
      { symbol: 'sb.f',    name: '11號糖',      cat: '農產品' },
      { symbol: 'cc.f',    name: '可可',        cat: '農產品' },
      { symbol: 'kc.f',    name: '咖啡',        cat: '農產品' },
      { symbol: 'ct.f',    name: '棉花',        cat: '農產品' },
      { symbol: 'le.f',    name: '活牛',        cat: '農產品' },
      { symbol: 'he.f',    name: '瘦豬',        cat: '農產品' },
      // 外匯
      { symbol: 'eurusd',  name: '歐元/美元',   cat: '外匯' },
      { symbol: 'gbpusd',  name: '英鎊/美元',   cat: '外匯' },
      { symbol: 'usdjpy',  name: '美元/日圓',   cat: '外匯' },
      { symbol: 'audusd',  name: '澳幣/美元',   cat: '外匯' },
      { symbol: 'usdcad',  name: '美元/加幣',   cat: '外匯' },
      // 債券殖利率
      { symbol: '10usy.b', name: '10年美債殖利率', cat: '債券' },
      { symbol: '30usy.b', name: '30年美債殖利率', cat: '債券' },
      // 加密貨幣
      { symbol: 'btcusd',  name: '比特幣',      cat: '加密貨幣' },
      { symbol: 'ethusd',  name: '以太幣',      cat: '加密貨幣' },
    ];

    try {
      // Support pagination: page=0 returns all, page=1,2,3 returns batches of 12
      const page = parseInt(req.query.page || '0');
      const BATCH_SIZE = 12;
      const batch = page > 0
        ? FUTURES.slice((page-1)*BATCH_SIZE, page*BATCH_SIZE)
        : FUTURES;

      const results = await Promise.all(batch.map(async f => {
        try {
          const url = `https://stooq.com/q/d/l/?s=${f.symbol}&i=d`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const csv = await r.text();
          if (csv.includes('No data') || csv.includes('Brak') || csv.length < 20) return null;
          const lines = csv.trim().split('\n');
          if (lines.length < 2) return null;
          const latest = lines[lines.length - 1].split(',');
          const prevLine = lines.length >= 3 ? lines[lines.length - 2].split(',') : latest;
          const curr  = parseFloat(latest[4]);
          const prevC = parseFloat(prevLine[4]);
          const hi    = parseFloat(latest[2]);
          const lo    = parseFloat(latest[3]);
          if (!curr || isNaN(curr)) return null;
          return {
            symbol: f.symbol, name: f.name, cat: f.cat,
            prev: prevC, price: curr, high: hi, low: lo,
            chg: curr - prevC,
            chgPct: prevC ? (curr - prevC) / prevC : 0,
            volPct: prevC ? (hi - lo) / prevC : 0,
          };
        } catch(e) { return null; }
      }));

      const data = results.filter(r => r !== null);
      res.status(200).json({ data, count: data.length, total: FUTURES.length, pages: Math.ceil(FUTURES.length / BATCH_SIZE) });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }
  // RSS news feeds
  const RSS_FEEDS = [
    { url: 'https://feeds.reuters.com/reuters/businessNews',                                       source: 'Reuters' },
    { url: 'https://feeds.reuters.com/reuters/technologyNews',                                     source: 'Reuters' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'CNBC' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',  source: 'CNBC' },
    { url: 'https://feeds.bloomberg.com/markets/news.rss',                                         source: 'Bloomberg' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',                          source: 'MarketWatch' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',                         source: 'MarketWatch' },
    { url: 'https://www.ft.com/?format=rss',                                                       source: 'FT' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const results = await Promise.all(RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(8000),
        });
        return { source, xml: await r.text() };
      } catch(e) { return { source, xml: null }; }
    }));

    const articles = [];
    for (const { source, xml } of results) {
      if (!xml) continue;
      const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
      for (const item of items.slice(0, 20)) {
        const get = (tag) => {
          const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
          return m ? (m[1] || m[2] || '').trim() : '';
        };
        const title = get('title').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#x2019;/g,"'").replace(/&#x2018;/g,"'").replace(/&quot;/g,'"').replace(/&#[^;]+;/g,'');
        const description = get('description').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#[^;]+;/g,'').trim().slice(0,300);
        const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
        const pubDate = get('pubDate');
        if (!title || title.length < 5 || !description || description.length < 20) continue;
        const pub = pubDate ? new Date(pubDate) : new Date();
        if (pub < cutoff) continue;
        articles.push({ title, description, url: link.trim(), publishedAt: pub.toISOString(), source });
      }
    }
    const seen = new Set();
    const unique = articles
      .filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true; })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.status(200).json({ data: unique, count: unique.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
