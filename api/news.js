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

  // Global Futures via Yahoo Finance spark endpoint (works server-side)
  if (endpoint === 'futures') {
    const FUTURES = [
      { symbol: 'YM=F',      name: '小道瓊',     cat: '美股指數' },
      { symbol: 'ES=F',      name: '小SP500',     cat: '美股指數' },
      { symbol: 'NQ=F',      name: '小那斯達克',  cat: '美股指數' },
      { symbol: 'RTY=F',     name: '羅素2000',    cat: '美股指數' },
      { symbol: '^GDAXI',    name: '德國DAX',     cat: '美股指數' },
      { symbol: '^SOX',      name: '費城半導體',  cat: '美股指數' },
      { symbol: 'TW=F',      name: '台指期',      cat: '亞股指數' },
      { symbol: '^N225',     name: '日經225',     cat: '亞股指數' },
      { symbol: '^HSI',      name: '香港恆生',    cat: '亞股指數' },
      { symbol: '000300.SS', name: '中國滬深300', cat: '亞股指數' },
      { symbol: 'CL=F',      name: '輕原油',      cat: '能源' },
      { symbol: 'HO=F',      name: '燃料油',      cat: '能源' },
      { symbol: 'RB=F',      name: '汽油',        cat: '能源' },
      { symbol: 'NG=F',      name: '天然氣',      cat: '能源' },
      { symbol: 'GC=F',      name: '黃金',        cat: '金屬' },
      { symbol: 'SI=F',      name: '白銀',        cat: '金屬' },
      { symbol: 'PL=F',      name: '白金',        cat: '金屬' },
      { symbol: 'HG=F',      name: '銅',          cat: '金屬' },
      { symbol: 'PA=F',      name: '鈀金',        cat: '金屬' },
      { symbol: 'ZS=F',      name: '黃豆',        cat: '農產品' },
      { symbol: 'ZC=F',      name: '玉米',        cat: '農產品' },
      { symbol: 'ZW=F',      name: '小麥',        cat: '農產品' },
      { symbol: 'SB=F',      name: '11號糖',      cat: '農產品' },
      { symbol: 'CC=F',      name: '可可',        cat: '農產品' },
      { symbol: 'KC=F',      name: '咖啡',        cat: '農產品' },
      { symbol: 'CT=F',      name: '棉花',        cat: '農產品' },
      { symbol: 'LE=F',      name: '活牛',        cat: '農產品' },
      { symbol: 'HE=F',      name: '瘦豬',        cat: '農產品' },
      { symbol: 'ZO=F',      name: '燕麥',        cat: '農產品' },
      { symbol: 'ZL=F',      name: '大豆油',      cat: '農產品' },
      { symbol: 'ZM=F',      name: '大豆粉',      cat: '農產品' },
      { symbol: 'DX=F',      name: '美元指數',    cat: '外匯' },
      { symbol: 'EURUSD=X',  name: '歐元',        cat: '外匯' },
      { symbol: 'GBPUSD=X',  name: '英鎊',        cat: '外匯' },
      { symbol: 'JPY=X',     name: '日圓',        cat: '外匯' },
      { symbol: 'AUDUSD=X',  name: '澳幣',        cat: '外匯' },
      { symbol: 'CADUSD=X',  name: '加幣',        cat: '外匯' },
      { symbol: 'ZF=F',      name: '5年美債',     cat: '債券' },
      { symbol: 'ZN=F',      name: '10年美債',    cat: '債券' },
      { symbol: 'ZB=F',      name: '30年美債',    cat: '債券' },
      { symbol: 'BTC=F',     name: '比特幣',      cat: '加密貨幣' },
      { symbol: 'ETH=F',     name: '以太幣',      cat: '加密貨幣' },
    ];

    try {
      // Use Yahoo Finance spark endpoint - batch all symbols
      const syms = FUTURES.map(f => encodeURIComponent(f.symbol)).join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${syms}&range=1d&interval=1d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com',
        }
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch(e) {
        return res.status(500).json({ error: 'parse error', raw: text.slice(0, 200) });
      }

      const symMap = Object.fromEntries(FUTURES.map(f => [f.symbol, f]));
      const results = [];

      const sparkData = data?.spark?.result || [];
      for (const item of sparkData) {
        const sym = item?.symbol;
        const resp = item?.response?.[0];
        const meta = resp?.meta;
        if (!meta || !sym) continue;
        const info = symMap[sym] || { name: sym, cat: '其他' };
        const curr = meta.regularMarketPrice || 0;
        const prev = meta.chartPreviousClose || meta.previousClose || curr;
        const hi   = meta.regularMarketDayHigh || curr;
        const lo   = meta.regularMarketDayLow  || curr;
        if (!curr) continue;
        results.push({
          symbol: sym, name: info.name, cat: info.cat,
          prev, price: curr, high: hi, low: lo,
          chg: curr - prev,
          chgPct: prev ? (curr - prev) / prev : 0,
          volPct: prev ? (hi - lo) / prev : 0,
        });
      }

      res.status(200).json({ data: results, count: results.length });
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
