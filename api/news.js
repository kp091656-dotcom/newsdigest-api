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

  function getStooqDate(daysAgo) {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  // Global Futures via stooq.com (server-side, no CORS issues)
  if (endpoint === 'futures') {
    const SYMBOLS = [
      // 美股指數 (confirmed working)
      // 美股指數：透過 FinMind USStockPrice 取得（稍後合併）
      { symbol: '%5Edax',   name: '德國DAX',         cat: '美股指數' },
      { symbol: '%5Esox',   name: '費城半導體',      cat: '美股指數' },
      { symbol: '%5Eftse',  name: '英國FTSE100',     cat: '美股指數' },
      { symbol: '%5Ecac',   name: '法國CAC40',       cat: '美股指數' },
      // 亞股指數
      { symbol: '%5Etwii',  name: '台灣加權',        cat: '亞股指數' },
      { symbol: '%5Enk225', name: '日經225',         cat: '亞股指數' },
      { symbol: '%5Ehsi',   name: '香港恆生',        cat: '亞股指數' },
      // 金屬 ETF (confirmed working on stooq .US)
      { symbol: 'GLD.US',   name: '黃金',            cat: '金屬' },
      { symbol: 'SLV.US',   name: '白銀',            cat: '金屬' },
      { symbol: 'PPLT.US',  name: '白金',            cat: '金屬' },
      { symbol: 'PALL.US',  name: '鈀金',            cat: '金屬' },
      { symbol: 'COPX.US',  name: '銅礦ETF',         cat: '金屬' },
      // 能源 ETF
      { symbol: 'USO.US',   name: '原油',            cat: '能源' },
      { symbol: 'UNG.US',   name: '天然氣',          cat: '能源' },
      { symbol: 'XLE.US',   name: '能源類股',        cat: '能源' },
      // 外匯 (confirmed working)
      { symbol: 'EURUSD',   name: '歐元/美元',       cat: '外匯' },
      { symbol: 'GBPUSD',   name: '英鎊/美元',       cat: '外匯' },
      { symbol: 'USDJPY',   name: '美元/日圓',       cat: '外匯' },
      { symbol: 'AUDUSD',   name: '澳幣/美元',       cat: '外匯' },
      { symbol: 'USDCAD',   name: '美元/加幣',       cat: '外匯' },
      { symbol: 'USDCNH',   name: '美元/人民幣',     cat: '外匯' },
      // 債券 ETF
      { symbol: 'TLT.US',   name: '20年美債',        cat: '債券' },
      { symbol: 'IEF.US',   name: '10年美債',        cat: '債券' },
      // 加密貨幣 ETF
      { symbol: 'IBIT.US',  name: '比特幣(ETF)',     cat: '加密貨幣' },
      { symbol: 'FETH.US',  name: '以太幣(ETF)',     cat: '加密貨幣' },
    ];

    const today = new Date();
    const d2 = today.toISOString().slice(0,10).replace(/-/g,'');
    const past = new Date(today - 30*24*60*60*1000);
    const d1 = past.toISOString().slice(0,10).replace(/-/g,'');

    try {
      const results = await Promise.all(SYMBOLS.map(async s => {
        try {
          const url = `https://stooq.com/q/d/l/?s=${s.symbol}&d1=${d1}&d2=${d2}&i=d`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const csv = await r.text();
          if (!csv || csv.includes('No data') || csv.length < 20) return null;
          const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date'));
          if (lines.length < 1) return null;
          const latest = lines[lines.length-1].split(',');
          const prev   = lines.length >= 2 ? lines[lines.length-2].split(',') : latest;
          const curr  = parseFloat(latest[4]);
          const prevC = parseFloat(prev[4]);
          const hi    = parseFloat(latest[2]);
          const lo    = parseFloat(latest[3]);
          if (!curr || isNaN(curr)) return null;
          return {
            symbol: s.symbol, name: s.name, cat: s.cat,
            prev: prevC, price: curr, high: hi, low: lo,
            chg: curr - prevC,
            chgPct: prevC ? (curr - prevC) / prevC : 0,
            volPct: prevC ? (hi - lo) / prevC : 0,
          };
        } catch(e) { return null; }
      }));

      const stooqData = results.filter(r => r !== null);

      // Fetch US indices from FinMind USStockPrice
      const TOKEN = process.env.FINMIND_TOKEN;
      const usSymbols = [
        { symbol: '^GSPC', name: 'S&P500',    cat: '美股指數' },
        { symbol: '^IXIC', name: '那斯達克',  cat: '美股指數' },
        { symbol: '^DJI',  name: '道瓊',      cat: '美股指數' },
        { symbol: '^VIX',  name: 'VIX波動率', cat: '波動率' },
        { symbol: '^SOX',  name: '費城半導體', cat: '美股指數' },
        { symbol: 'GLD',   name: '黃金(GLD)', cat: '金屬' },
        { symbol: 'SLV',   name: '白銀(SLV)', cat: '金屬' },
        { symbol: 'USO',   name: 'WTI原油',   cat: '能源' },
        { symbol: 'BNO',   name: '布倫特原油', cat: '能源' },
        { symbol: 'IBIT',  name: '比特幣ETF', cat: '加密貨幣' },
        { symbol: 'FETH',  name: '以太幣ETF', cat: '加密貨幣' },
      ];

      const usData = TOKEN ? await Promise.all(usSymbols.map(async s => {
        try {
          const start = new Date(Date.now() - 5*24*60*60*1000).toISOString().slice(0,10);
          const r = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=USStockPrice&data_id=${encodeURIComponent(s.symbol)}&start_date=${start}&token=${TOKEN}`);
          const json = await r.json();
          const rows = (json.data || []).filter(d => d.Close > 0).sort((a,b) => a.date.localeCompare(b.date));
          if (rows.length < 1) return null;
          const curr = rows[rows.length-1].Close;
          const prev = rows.length >= 2 ? rows[rows.length-2].Close : curr;
          const hi   = rows[rows.length-1].High;
          const lo   = rows[rows.length-1].Low;
          return {
            symbol: s.symbol, name: s.name, cat: s.cat,
            prev, price: curr, high: hi, low: lo,
            chg: curr - prev,
            chgPct: prev ? (curr - prev) / prev : 0,
            volPct: prev ? (hi - lo) / prev : 0,
          };
        } catch(e) { return null; }
      })) : [];

      const commData = [];

      const data = [
        ...usData.filter(Boolean),
        ...stooqData,
      ];
      res.status(200).json({ data, count: data.length });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // Taiwan VIX - scrape from TAIFEX vixMinNew page
  if (endpoint === 'twvix') {
    try {
      // TAIFEX VIX daily data - POST request with date range
      // Fetch last 2 years of daily VIX data
      const allData = [];
      const today = new Date();
      
      // Fetch monthly chunks for last 2 years
      const fetches = [];
      for (let m = 0; m < 24; m++) {
        const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        fetches.push({ year, month });
      }

      const results = await Promise.all(fetches.map(async ({ year, month }) => {
        try {
          const queryDate = `${year}/${month}/01`;
          const body = new URLSearchParams({
            queryDate,
            MarketCode: '0',
            commodity_idt: 'TVIX',
          });
          const r = await fetch('https://www.taifex.com.tw/cht/7/vixMinNew', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0',
              'Referer': 'https://www.taifex.com.tw/cht/7/vixMinNew',
            },
            body: body.toString(),
          });
          const html = await r.text();
          
          // Parse table rows from HTML
          const rows = [];
          const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
          for (const tr of trMatches) {
            const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
              .map(td => td[1].replace(/<[^>]+>/g, '').trim());
            if (tds.length >= 2 && tds[0].match(/\d{4}\/\d{2}\/\d{2}/)) {
              rows.push({ date: tds[0].replace(/\//g, '-'), vix: parseFloat(tds[1]?.replace(/,/g, '')) });
            }
          }
          return rows;
        } catch(e) { return []; }
      }));

      const flat = results.flat().filter(d => d.vix > 0);
      // Deduplicate and sort
      const seen = new Set();
      const unique = flat.filter(d => { if (seen.has(d.date)) return false; seen.add(d.date); return true; })
        .sort((a, b) => a.date.localeCompare(b.date));

      res.status(200).json({ data: unique, count: unique.length, source: 'taifex-vix' });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }


  // FinMind - Commodities (Gold, Oil) for futures leaderboard
  if (endpoint === 'commodities') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });
    try {
      const today = new Date();
      const start = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [goldRes, wtiRes, brentRes] = await Promise.all([
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=GoldPrice&start_date=${start}&token=${TOKEN}`),
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=CrudeOilPrices&data_id=WTI&start_date=${start}&token=${TOKEN}`),
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=CrudeOilPrices&data_id=Brent&start_date=${start}&token=${TOKEN}`),
      ]);

      const [goldJson, wtiJson, brentJson] = await Promise.all([
        goldRes.json(), wtiRes.json(), brentRes.json()
      ]);

      // Gold: take last 2 daily closes (group 5-min data by date)
      const goldByDate = {};
      for (const d of goldJson.data || []) {
        const date = d.date.slice(0, 10);
        goldByDate[date] = d.Price;
      }
      const goldDates = Object.keys(goldByDate).sort();
      const goldCurr = goldByDate[goldDates[goldDates.length - 1]] || 0;
      const goldPrev = goldByDate[goldDates[goldDates.length - 2]] || goldCurr;

      // Oil: last 2 entries
      const wti   = wtiJson.data   || [];
      const brent = brentJson.data || [];
      const mkItem = (name, cat, arr) => {
        if (arr.length < 1) return null;
        const curr = arr[arr.length - 1].price;
        const prev = arr.length >= 2 ? arr[arr.length - 2].price : curr;
        return { symbol: name, name, cat, price: curr, prev, high: curr, low: curr,
          chg: curr - prev, chgPct: prev ? (curr - prev) / prev : 0, volPct: 0 };
      };

      const data = [
        goldCurr ? { symbol: 'GOLD', name: '黃金(即時)', cat: '金屬', price: goldCurr, prev: goldPrev, high: goldCurr, low: goldCurr,
          chg: goldCurr - goldPrev, chgPct: goldPrev ? (goldCurr - goldPrev) / goldPrev : 0, volPct: 0 } : null,
        mkItem('WTI原油', '能源', wti),
        mkItem('布倫特原油', '能源', brent),
      ].filter(Boolean);

      res.status(200).json({ data, count: data.length });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // FinMind - Taiwan Futures OHLCV data
  if (endpoint === 'finmind') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });

    const { dataset = 'TaiwanFuturesDaily', symbol = 'TX', start = '2024-01-01' } = req.query;
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${symbol}&start_date=${start}&token=${TOKEN}`;

    try {
      const r = await fetch(url);
      const data = await r.json();
      res.status(200).json(data);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // ── PTT Stock 板 RSS proxy + 內文摘要 ──
  if (endpoint === 'ptt') {
    // PTT Stock Atom RSS — 不爬內文（Vercel 10s 限制），只抓標題+時間
    // 推文數從 Atom summary 欄位估算（部分條目有帶）
    const mkC = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c; };
    const PTT_HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1', 'Accept': 'application/xml,text/xml' };

    const parseAtom = (xml) => {
      const out = [];
      const re = /<entry>([\s\S]*?)<\/entry>/gi;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const blk = m[1];
        const getTag = (tag) => {
          const rx = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
          return (blk.match(rx) || ['',''])[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#[0-9]+;/g,'').trim();
        };
        const title   = getTag('title');
        const updated = getTag('updated');
        // PTT Atom summary 含推文數，格式如「推:12 噓:2 →:5」
        const summary = getTag('summary');
        const pushM   = summary.match(/推\s*[:：]\s*(\d+)/);
        const booM    = summary.match(/噓\s*[:：]\s*(\d+)/);
        const pushes  = (parseInt(pushM?.[1]||0)) - (parseInt(booM?.[1]||0));
        const linkM   = blk.match(/<link[^>]+href="([^"]+)"/i);
        const link    = linkM ? linkM[1].trim() : '';
        if (!title || ['[公告]','[板規]','Fw:'].some(p => title.startsWith(p))) continue;
        out.push({ title, updated, link, pushes, body: summary.slice(0, 150) });
      }
      return out;
    };

    let entries = [];
    try {
      const r = await fetch('https://www.ptt.cc/atom/Stock.xml', {
        headers: PTT_HEADERS, signal: mkC(9000).signal,
      });
      if (r.ok) entries = parseAtom(await r.text());
    } catch(e) {}

    // HTML fallback（只取標題，推文數為 0）
    if (entries.length === 0) {
      try {
        const r2 = await fetch('https://www.ptt.cc/bbs/Stock/index.html', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
          signal: mkC(9000).signal,
        });
        if (r2.ok) {
          const html = await r2.text();
          // 連同推文數一起解析（nrec span）
          const rowRe = /<div class="r-ent">([\s\S]*?)<\/div>\s*<\/div>/gi;
          let hm;
          while ((hm = rowRe.exec(html)) !== null) {
            const row = hm[1];
            const titleM = row.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
            if (!titleM) continue;
            const t = titleM[2].trim();
            if (['[公告]','[板規]','Fw:'].some(p => t.startsWith(p))) continue;
            const nrecM = row.match(/<span[^>]*>(\d+|爆|X+)<\/span>/i);
            const nrecRaw = nrecM ? nrecM[1] : '0';
            const pushes = nrecRaw === '爆' ? 99 : (nrecRaw.startsWith('X') ? -nrecRaw.length*10 : parseInt(nrecRaw)||0);
            entries.push({ title: t, updated: new Date().toISOString(), link: 'https://www.ptt.cc' + titleM[1], pushes, body: '' });
          }
        }
      } catch(e) {}
    }

    res.status(200).json({ data: entries.slice(0, 25), count: entries.length });
    return;
  }

  // ── Reddit proxy（RSS，含內文摘要）──
  if (endpoint === 'reddit') {
    const { sub = 'wallstreetbets', sort = 'hot', limit = '25' } = req.query;
    const allowedSubs  = ['wallstreetbets', 'investing', 'stocks', 'StockMarket'];
    const allowedSorts = ['hot', 'new', 'top'];
    if (!allowedSubs.includes(sub) || !allowedSorts.includes(sort)) {
      return res.status(400).json({ error: 'invalid params' });
    }
    const mkC = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c; };
    const rssUrl = `https://www.reddit.com/r/${sub}/${sort}.rss?limit=${Math.min(parseInt(limit)||25,50)}`;
    try {
      const r = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: mkC(12000).signal,
      });
      if (!r.ok) throw new Error(`Reddit RSS HTTP ${r.status}`);
      const xml = await r.text();

      const cleanHtml = (s) => s
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
        .replace(/&#[0-9]+;/g,'').replace(/\s+/g,' ').trim();

      const posts = [];
      const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
      let m;
      while ((m = entryRe.exec(xml)) !== null) {
        const blk = m[1];
        const getTag = (tag) => {
          const rx = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
          const found = blk.match(rx);
          return found ? cleanHtml(found[1]) : '';
        };
        const title    = getTag('title');
        const updated  = getTag('updated') || getTag('published');
        const idTag    = getTag('id');
        const score    = parseInt(getTag('score')) || 0;
        const numComm  = parseInt(getTag('comments') || getTag('slash:comments')) || 0;
        const linkM    = blk.match(/<link[^>]+href="([^"]+)"/i);
        const link     = linkM ? linkM[1] : '';
        // Extract selftext from <content> or <media:description>
        const contentRx = /<(?:content|media:description)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content|media:description)>/i;
        const contentM = blk.match(contentRx);
        const body = contentM ? cleanHtml(contentM[1]).slice(0, 200) : '';
        const idMatch  = idTag.match(/t3_([a-z0-9]+)/i);
        const id       = idMatch ? idMatch[1] : Math.random().toString(36).slice(2);
        const created  = updated ? Math.floor(new Date(updated).getTime() / 1000) : 0;
        if (!title || title.length < 3) continue;
        posts.push({ id, title, body, score, url: link, created, num_comments: numComm });
      }

      // RSS 2.0 fallback
      if (posts.length === 0) {
        const itemRe = /<item>([\s\S]*?)<\/item>/gi;
        while ((m = itemRe.exec(xml)) !== null) {
          const blk = m[1];
          const getTag = (tag) => {
            const rx = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
            const found = blk.match(rx);
            return found ? cleanHtml(found[1]) : '';
          };
          const title   = getTag('title');
          const pubDate = getTag('pubDate');
          const link    = getTag('link') || (blk.match(/<link>([^<]+)<\/link>/i)?.[1] || '').trim();
          const body    = getTag('description').slice(0, 200);
          const created = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;
          if (!title || title.length < 3) continue;
          posts.push({ id: Math.random().toString(36).slice(2), title, body, score: 0, url: link, created, num_comments: 0 });
        }
      }

      res.status(200).json({ data: posts.slice(0, parseInt(limit)||25), count: posts.length, sub, sort, source: 'rss' });
    } catch(e) {
      res.status(500).json({ error: e.message, sub, sort });
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
          signal: (()=>{ const c=new AbortController(); setTimeout(()=>c.abort(),8000); return c.signal; })(),
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
