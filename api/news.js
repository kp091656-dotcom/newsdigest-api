export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint = 'news' } = req.query;

  // ── 從 Supabase 讀快取新聞 ──
  if (endpoint === 'news_cached') {
    const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
    const lang   = req.query.lang   || '';   // '' = 全部, 'zh', 'en'
    const limit  = Math.min(parseInt(req.query.limit) || 80, 150);
    try {
      let params = `order=published_at.desc&limit=${limit}`;
      if (lang) params += `&lang=eq.${lang}`;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/news_daily?${params}&select=title,title_zh,url,source,lang,published_at`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
      const rows = await r.json();
      // 統一格式，與原有 news RSS 格式相容
      const data = rows.map(row => ({
        title:       row.title_zh || row.title,
        titleOrig:   row.title,
        description: '',
        url:         row.url,
        publishedAt: row.published_at,
        source:      row.source,
        lang:        row.lang,
      }));
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 分鐘 CDN cache
      return res.status(200).json({ data, count: data.length, source: 'supabase' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }



  // ── Alpha helper functions（避免 self-referencing fetch）──

  async function fetchFGI() {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://edition.cnn.com/', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`FGI HTTP ${r.status}`);
    return r.json();
  }

  async function fetchVIX() {
    const symbols = ['^VIX', '^VVIX'];
    const results = await Promise.all(symbols.map(async s => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      const q = d?.chart?.result?.[0]?.meta;
      return { symbol: s, price: q?.regularMarketPrice ?? null, name: q?.shortName ?? s };
    }));
    return { data: results };
  }

  async function fetchFuturesLite() {
    // 只抓關鍵幾檔，輕量版
    const KEY_SYMBOLS = [
      { symbol: 'SPY.US', name: 'S&P500 ETF' },
      { symbol: 'QQQ.US', name: '那斯達克 ETF' },
      { symbol: 'GC.F',   name: '黃金期貨' },
      { symbol: 'CL.F',   name: 'WTI原油' },
    ];
    const d2 = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const d1 = new Date(Date.now()-7*86400000).toISOString().slice(0,10).replace(/-/g,'');
    const results = await Promise.allSettled(KEY_SYMBOLS.map(async s => {
      const r = await fetch(`https://stooq.com/q/d/l/?s=${s.symbol}&d1=${d1}&d2=${d2}&i=d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000),
      });
      const csv = await r.text();
      if (!csv || csv.includes('No data')) return null;
      const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date'));
      if (!lines.length) return null;
      const last = lines[lines.length-1].split(',');
      const prev = lines.length >= 2 ? lines[lines.length-2].split(',') : last;
      const price = parseFloat(last[4]);
      const prevP = parseFloat(prev[4]);
      return { name: s.name, price, chgPct: prevP ? ((price-prevP)/prevP*100).toFixed(2) : null };
    }));
    const data = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    return { data };
  }

  async function fetchPTT() {
    const HDR  = { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' };
    const BASE = 'https://www.ptt.cc';
    try {
      const r = await fetch(BASE + '/bbs/Stock/index.html', { headers: HDR, signal: AbortSignal.timeout(7000) });
      const html = await r.text();
      const items = [];
      const blocks = html.split('<div class="r-ent">').slice(1);
      for (const blk of blocks.slice(0, 20)) {
        const linkM = blk.match(/href="(\/bbs\/Stock\/M\.[^"]+)"/i);
        const titM  = blk.match(/<a[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/i);
        if (!linkM || !titM) continue;
        const title = titM[1].trim();
        if (['[公告]','[板規]','Fw:'].some(p => title.startsWith(p))) continue;
        const nrecM = blk.match(/<span[^>]*>(爆|\d+|X+)<\/span>/i);
        const nrecRaw = (nrecM?.[1] || '').trim();
        const pushes = nrecRaw === '爆' ? 99 : /^X+$/i.test(nrecRaw) ? -nrecRaw.length*10 : parseInt(nrecRaw)||0;
        items.push({ title, link: BASE + linkM[1], pushes });
      }
      return { data: items };
    } catch { return { data: [] }; }
  }

  async function fetchReddit() {
    try {
      const r = await fetch('https://www.reddit.com/r/investing/hot.json?limit=15', {
        headers: { 'User-Agent': 'AlphaScope/1.0' }, signal: AbortSignal.timeout(7000),
      });
      const json = await r.json();
      const posts = (json.data?.children || []).map(c => ({
        title: c.data.title, score: c.data.score, url: c.data.url,
      }));
      return { posts };
    } catch { return { posts: [] }; }
  }

  // ── End of Alpha helpers ──

  // ══════════════════════════════════════════
  // Alpha 交易員 — 分析 endpoint
  // ══════════════════════════════════════════
  if (endpoint === 'alpha_analyze') {
    const GROQ_KEY      = process.env.GROQ_API_KEY;
    const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://fdxedcwtmlurumfjmlys.supabase.co';
    const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
    if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

    // Owner 驗證
    const OWNER_HASH = process.env.OWNER_TOKEN_HASH;
    if (OWNER_HASH) {
      const incoming = req.headers['x-owner-token'] || '';
      const msgBuf = new TextEncoder().encode(incoming);
      const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
      const incomingHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
      if (incomingHash !== OWNER_HASH) return res.status(403).json({ error: 'unauthorized' });
    }

    try {
      // ── 1. 並行抓取所有資料來源 ──
      const [stockRows, valuationRows, newsRows, pttData, redditData, fgiData, vixData, futuresData] = await Promise.allSettled([
        // 台股股價（近 5 日成交量前 200 檔）
        (async () => {
          // 先取最新日期
          const dateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?order=date.desc&limit=1&select=date`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          const dateJson = await dateRes.json();
          const latestDate = Array.isArray(dateJson) && dateJson[0]?.date ? dateJson[0].date : null;
          if (!latestDate) return [];
          // 只取該日期、成交量前 200
          const r = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?date=eq.${latestDate}&order=volume.desc&limit=200&select=stock_id,name,close,prev,chg_pct,volume,date`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          const j = await r.json();
          return Array.isArray(j) ? j : [];
        })().catch(() => []),

        // 個股估值
        fetch(`${SUPABASE_URL}/rest/v1/stock_valuation_daily?order=dividend_yield.desc&limit=200&select=stock_id,pe_ratio,pb_ratio,dividend_yield`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          signal: AbortSignal.timeout(5000),
        }).then(r => r.json()).catch(() => []),

        // 快取新聞（中英文各 20 則）
        fetch(`${SUPABASE_URL}/rest/v1/news_daily?order=published_at.desc&limit=40&select=title,source,lang,published_at`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          signal: AbortSignal.timeout(5000),
        }).then(r => r.json()).catch(() => []),

        // PTT Stock 版
        fetchPTT().catch(() => ({ data: [] })),

        // Reddit
        fetchReddit().catch(() => ({ posts: [] })),

        // Fear & Greed
        fetchFGI().catch(() => null),

        // VIX
        fetchVIX().catch(() => null),

        // 全球期貨（直接從 Supabase futures_daily 或 stooq 抓精簡版）
        fetchFuturesLite().catch(() => null),
      ]);

      const toArr = (v) => Array.isArray(v) ? v : [];
      const stocks    = stockRows.status    === 'fulfilled' ? toArr(stockRows.value)    : [];
      const valuation = valuationRows.status === 'fulfilled' ? toArr(valuationRows.value) : [];
      const news      = newsRows.status     === 'fulfilled' ? toArr(newsRows.value)     : [];
      const ptt       = pttData.status      === 'fulfilled' ? toArr(pttData.value?.data) : [];
      const reddit    = redditData.status   === 'fulfilled' ? toArr(redditData.value?.posts) : [];
      const fgi       = fgiData.status      === 'fulfilled' ? fgiData.value : null;
      const vix       = vixData.status      === 'fulfilled' ? vixData.value?.data : null;
      const futures   = futuresData.status  === 'fulfilled' ? futuresData.value : null;

      // ── 2. 整理估值 map ──
      const valMap = {};
      for (const v of valuation) valMap[v.stock_id] = v;

      // ── 3. 整理股票資料（前 50 檔，加入估值）──
      const topStocks = stocks.slice(0, 50).map(s => ({
        id:      s.stock_id,
        name:    s.name,
        close:   s.close,
        chgPct:  s.chg_pct,
        volume:  s.volume,
        pe:      valMap[s.stock_id]?.pe_ratio    ?? null,
        pb:      valMap[s.stock_id]?.pb_ratio    ?? null,
        dy:      valMap[s.stock_id]?.dividend_yield ?? null,
      }));

      // ── 4. 整理市場情緒 ──
      const fgiScore = fgi?.fear_and_greed?.score ?? fgi?.score ?? null;
      const fgiLabel = fgi?.fear_and_greed?.rating ?? '';
      const vixNow   = vix?.find(v => v.symbol === '^VIX')?.price ?? null;
      const twFuture = futures?.data?.find(f => f.name?.includes('台灣') || f.name?.includes('TX')) ?? null;

      // ── 5. 整理 PTT 熱門標題 ──
      const pttTitles = ptt.slice(0, 15).map(p => `【${p.pushes >= 0 ? '+' : ''}${p.pushes}推】${p.title}`).join('\n');

      // ── 6. 整理 Reddit ──
      const redditTitles = reddit.slice(0, 10).map(r => `[${r.score || 0}↑] ${r.title}`).join('\n');

      // ── 7. 整理新聞標題 ──
      const newsTitles = news.slice(0, 30).map(n => `[${n.source}] ${n.title}`).join('\n');

      // ── 8. 組裝 Prompt ──
      const stockTable = topStocks.map(s =>
        `${s.id} ${s.name} 收${s.close} 漲跌${s.chgPct ?? 'N/A'}% 量${s.volume} PE${s.pe ?? '-'} PB${s.pb ?? '-'} 殖${s.dy ?? '-'}%`
      ).join('\n');

      const marketContext = [
        fgiScore !== null ? `Fear & Greed: ${fgiScore} (${fgiLabel})` : '',
        vixNow   !== null ? `VIX: ${vixNow}` : '',
        twFuture          ? `台指期: ${twFuture.name} ${twFuture.close ?? ''}` : '',
      ].filter(Boolean).join(' | ');

      const systemPrompt = `你是 Alpha，一位經驗豐富的台股交易員。
你的分析風格：冷靜、數據導向、不隨波逐流。
你會根據：技術面（量價）、基本面（PE/PB/殖利率）、市場情緒、社群聲量、新聞催化劑，綜合判斷操作方向。
你會依市場狀況自行決定操作風格（短線波段 3-10 天 / 中線趨勢 1-4 週 / 價值布局）。

【價格規則 — 嚴格遵守】
- 所有價格必須以「台股量價估值」表格中的「收」欄位為基準
- entry_price 必須在該股收盤價的 ±5% 範圍內
- target_price 必須在 entry_price 的 +3% ~ +20% 範圍內
- stop_loss 必須在 entry_price 的 -3% ~ -10% 範圍內
- 禁止使用訓練資料中的歷史股價，只能用表格提供的收盤價

輸出規則：
- 必須使用繁體中文
- 回傳嚴格 JSON，不含任何 markdown 或說明文字
- JSON 格式如下（不可有多餘欄位）：
{
  "market_summary": "50字以內的市場總結",
  "market_mood": "樂觀|中性|謹慎|悲觀",
  "recommendations": [
    {
      "stock_id": "股票代號（4碼）",
      "stock_name": "股票名稱",
      "style": "短線|中線|價值",
      "action": "買進|觀察|避開",
      "entry_price": 數字,
      "target_price": 數字,
      "stop_loss": 數字,
      "expected_return_pct": 數字,
      "holding_days": 數字,
      "confidence": "高|中|低",
      "reason": "100字以內的操作理由，含進出場依據",
      "risk": "30字以內的主要風險"
    }
  ],
  "alpha_note": "Alpha 給投資人的一句話警語或觀察"
}
recommendations 必須包含 3-5 檔，action=買進 至少 2 檔。`;

      const userPrompt = `【市場情緒指標】
${marketContext || '資料暫無'}

【台股量價估值（前50大成交量）】
${stockTable}

【近期財經新聞】
${newsTitles || '無'}

【PTT Stock 版熱門】
${pttTitles || '無'}

【Reddit 討論】
${redditTitles || '無'}

請根據以上資料，以 Alpha 交易員身份給出今日台股操作建議。`;

      // ── 9. 呼叫 Groq（含 web_search tool）──
      const groqBody = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.4,
        tools: [{
          type: 'function',
          function: {
            name: 'web_search',
            description: '搜尋個股最新消息、法說會、營收公告等即時資訊',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '搜尋關鍵字，例如：台積電 2025 法說會' }
              },
              required: ['query']
            }
          }
        }],
        tool_choice: 'auto',
      };

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify(groqBody),
        signal: AbortSignal.timeout(30000),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq HTTP ${groqRes.status}: ${errText.slice(0, 200)}`);
      }

      const groqData = await groqRes.json();
      let raw = groqData.choices?.[0]?.message?.content || '';

      // 清理 JSON
      raw = raw.replace(/```json|```/g, '').trim();
      const startIdx = raw.indexOf('{');
      const endIdx   = raw.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) raw = raw.slice(startIdx, endIdx + 1);

      let result;
      try { result = JSON.parse(raw); }
      catch { result = { market_summary: '解析失敗', recommendations: [], raw }; }

      // ── 後處理：校正 AI 給的不合理價格（以真實收盤價為基準）──
      const priceMap = {};
      for (const s of topStocks) priceMap[s.id] = s.close;

      for (const rec of (result.recommendations || [])) {
        const realClose = priceMap[rec.stock_id];
        if (!realClose || realClose <= 0) continue;

        const entry = rec.entry_price;
        // 若 entry_price 偏離收盤價超過 20%，強制修正
        if (!entry || Math.abs(entry - realClose) / realClose > 0.20) {
          rec.entry_price  = parseFloat((realClose * 1.00).toFixed(1));  // 以收盤價為進場
          rec.target_price = parseFloat((realClose * 1.08).toFixed(1));  // +8%
          rec.stop_loss    = parseFloat((realClose * 0.94).toFixed(1));  // -6%
          rec.price_corrected = true;  // 標記已校正
        } else {
          // entry 合理，但也檢查 target/stop 是否相對 entry 合理
          if (!rec.target_price || rec.target_price <= rec.entry_price)
            rec.target_price = parseFloat((rec.entry_price * 1.08).toFixed(1));
          if (!rec.stop_loss || rec.stop_loss >= rec.entry_price)
            rec.stop_loss = parseFloat((rec.entry_price * 0.94).toFixed(1));
        }
      }

      // 加入資料來源資訊（含 debug）
      result.data_sources = {
        stocks:  topStocks.length,
        news:    news.length,
        ptt:     ptt.length,
        reddit:  reddit.length,
        fgi:     fgiScore,
        vix:     vixNow,
        debug_sample: topStocks.slice(0,3).map(s => ({ id: s.id, name: s.name, close: s.close })),
      };
      result.generated_at = new Date().toISOString();

      return res.status(200).json(result);
    } catch (e) {
      console.error('[Alpha] Error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Alpha 交易紀錄 CRUD ──
  if (endpoint === 'alpha_positions') {
    const SUPABASE_URL = process.env.SUPABASE_URL  || 'https://fdxedcwtmlurumfjmlys.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
    const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

    // Owner 驗證
    const OWNER_HASH = process.env.OWNER_TOKEN_HASH;
    if (OWNER_HASH) {
      const incoming = req.headers['x-owner-token'] || '';
      const msgBuf = new TextEncoder().encode(incoming);
      const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
      const incomingHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
      if (incomingHash !== OWNER_HASH) return res.status(403).json({ error: 'unauthorized' });
    }

    // 讀取 body
    let body = {};
    if (req.method === 'POST' || req.method === 'PATCH') {
      try {
        const raw = await new Promise((resolve, reject) => {
          let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d)); req.on('error', reject);
        });
        body = raw ? JSON.parse(raw) : {};
      } catch { body = {}; }
    }

    const action = req.query.action || 'list';

    // LIST — 取所有持倉
    if (action === 'list') {
      const status = req.query.status || '';
      let url = `${SUPABASE_URL}/rest/v1/trader_positions?order=opened_at.desc&limit=100`;
      if (status) url += `&status=eq.${status}`;
      const r = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      return res.status(200).json({ data });
    }

    // CREATE — 新增持倉
    if (action === 'create' && req.method === 'POST') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions`, {
        method: 'POST',
        headers: { ...hdrs, Prefer: 'return=representation' },
        body: JSON.stringify({
          stock_id:     body.stock_id,
          stock_name:   body.stock_name,
          entry_price:  body.entry_price,
          target_price: body.target_price,
          stop_loss:    body.stop_loss,
          shares:       body.shares || 1,
          style:        body.style,
          reason:       body.reason,
          status:       'open',
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await r.json();
      return res.status(201).json({ data });
    }

    // CLOSE — 平倉，計算損益
    if (action === 'close' && req.method === 'PATCH') {
      const { id, exit_price } = body;
      if (!id || !exit_price) return res.status(400).json({ error: 'id and exit_price required' });

      // 先取原始持倉
      const orig = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?id=eq.${id}&select=entry_price,shares`, {
        headers: hdrs, signal: AbortSignal.timeout(5000),
      }).then(r => r.json());

      const { entry_price, shares } = orig?.[0] || {};
      const pnl     = entry_price ? (exit_price - entry_price) * (shares || 1) * 1000 : null;
      const pnl_pct = entry_price ? ((exit_price - entry_price) / entry_price * 100) : null;

      const r = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...hdrs, Prefer: 'return=representation' },
        body: JSON.stringify({
          status:     'closed',
          exit_price: parseFloat(exit_price),
          pnl:        pnl     ? parseFloat(pnl.toFixed(0))     : null,
          pnl_pct:    pnl_pct ? parseFloat(pnl_pct.toFixed(2)) : null,
          closed_at:  new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await r.json();
      return res.status(200).json({ data, pnl, pnl_pct });
    }

    // DELETE
    if (action === 'delete' && req.method === 'POST') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?id=eq.${id}`, {
        method: 'DELETE', headers: hdrs, signal: AbortSignal.timeout(5000),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

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
    const CACHE_TTL = 30 * 60 * 1000; // 30 分鐘
    if (!global._futuresCache) global._futuresCache = { data: null, ts: 0 };
    const now = Date.now();
    if (global._futuresCache.data && (now - global._futuresCache.ts) < CACHE_TTL) {
      const ageMin = ((now - global._futuresCache.ts) / 60000).toFixed(1);
      return res.status(200).json({ ...global._futuresCache.data, cached: true, cacheAgeMin: parseFloat(ageMin) });
    }

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
          const r = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=USStockPrice&data_id=${encodeURIComponent(s.symbol)}&start_date=${start}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
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
      const payload = { data, count: data.length };
      global._futuresCache = { data: payload, ts: Date.now() };
      res.status(200).json({ ...payload, cached: false });
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
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=GoldPrice&start_date=${start}`, { headers: { Authorization: `Bearer ${TOKEN}` } }),
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=CrudeOilPrices&data_id=WTI&start_date=${start}`, { headers: { Authorization: `Bearer ${TOKEN}` } }),
        fetch(`https://api.finmindtrade.com/api/v4/data?dataset=CrudeOilPrices&data_id=Brent&start_date=${start}`, { headers: { Authorization: `Bearer ${TOKEN}` } }),
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
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${symbol}&start_date=${start}`;

    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const data = await r.json();
      res.status(200).json(data);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // ── PTT Stock 板 RSS proxy + 內文摘要 ──
  // ── PTT 單篇文章內文 + 推文數（供前端逐篇呼叫）──
  // ── Gemini AI proxy ──
  if (endpoint === 'gemini') {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    // 手動 parse body（Vercel 不自動 parse JSON body）
    let body = {};
    if (req.method === 'POST') {
      try {
        const raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = raw ? JSON.parse(raw) : {};
      } catch(e) { body = {}; }
    }
    const prompt = body.prompt || req.query.prompt;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    const maxTokens = parseInt(body.maxTokens || req.query.maxTokens || '1024');
    const temperature = parseFloat(body.temperature || req.query.temperature || '0.5');
    // Exponential Backoff：最多重試 3 次，延遲 10s / 20s / 40s
    const MAX_RETRY = 3;
    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      try {
        console.log(`[Gemini] Attempt ${attempt + 1}, prompt length:`, prompt.length);
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature, maxOutputTokens: maxTokens }
            })
          }
        );
        const data = await r.json();
        console.log(`[Gemini] Response status: ${r.status}, hasError: ${!!data.error}`);
        if (data.error) {
          const is429 = r.status === 429 || data.error.code === 429;
          console.error(`[Gemini] API Error (attempt ${attempt + 1}):`, data.error.message);
          if (is429 && attempt < MAX_RETRY - 1) {
            // 從錯誤訊息解析 retryDelay，若無則用指數退避
            const retryMatch = data.error.message?.match(/retry in ([\d.]+)s/i);
            const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : Math.pow(2, attempt + 1) * 10;
            console.log(`[Gemini] 429 - waiting ${retrySec}s before retry...`);
            await new Promise(r => setTimeout(r, retrySec * 1000));
            continue;
          }
          lastError = data.error;
          break;
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[Gemini] Success, output length:', text.length);
        return res.status(200).json({ text });
      } catch(e) {
        console.error(`[Gemini] Catch Error (attempt ${attempt + 1}):`, e.message);
        lastError = { message: e.message, stack: e.stack };
        if (attempt < MAX_RETRY - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 5000));
        }
      }
    }
    console.error('[Gemini] All attempts failed:', lastError);
    return res.status(500).json({ error: lastError?.message || 'Gemini failed', details: lastError });
  }

  // ── Groq AI proxy ──
  if (endpoint === 'groq') {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

    // ── Owner Token 驗證（A+B 方案 — B 層：API 端）──
    // Vercel 環境變數 OWNER_TOKEN_HASH = SHA-256(你的密碼)
    // 前端在 header x-owner-token 傳明文密碼，後端 hash 後比對
    const OWNER_HASH = process.env.OWNER_TOKEN_HASH;
    if (OWNER_HASH) {
      const incoming = req.headers['x-owner-token'] || '';
      const msgBuf = new TextEncoder().encode(incoming);
      const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
      const incomingHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
      if (incomingHash !== OWNER_HASH) {
        console.warn('[Groq] Unauthorized — missing or wrong owner token');
        return res.status(403).json({ error: 'unauthorized', message: '需要 Owner 密碼才能使用 AI 功能' });
      }
    }

    let body = {};
    if (req.method === 'POST') {
      try {
        const raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = raw ? JSON.parse(raw) : {};
      } catch(e) { body = {}; }
    }
    const prompt = body.prompt || req.query.prompt;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    const maxTokens = parseInt(body.maxTokens || req.query.maxTokens || '800');
    const temperature = parseFloat(body.temperature || req.query.temperature || '0.7');
    try {
      console.log('[Groq] Request start, prompt length:', prompt.length, 'maxTokens:', maxTokens);
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: `你是資深股票研究分析師，專精台灣與全球金融市場。
語言規則：務必使用繁體中文，嚴禁使用簡體中文。
分析框架（參考機構研究標準）：
1. 宏觀背景（Macro Context）：利率、匯率、地緣政治是順風或逆風
2. 催化劑（Catalyst）：推動股價/市場的關鍵事件
3. 基本面（Fundamentals）：營收成長、獲利率、本益比合理性
4. 價格動能（Price Momentum）：近期走勢、成交量、相對強弱
5. 風險因子（Risk Factors）：需要注意的下行風險
6. 投資論點（Investment Thesis）：共識預期是否有誤判空間（where might consensus be wrong）
輸出原則：數據具體、論點有依據、避免模糊用詞、結尾點出關鍵風險。` },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          temperature
        })
      });
      const data = await r.json();
      console.log('[Groq] Response status:', r.status, 'hasError:', !!data.error);
      if (data.error) {
        const is429 = r.status === 429 || data.error?.code === 'rate_limit_exceeded';
        if (is429) {
          // 解析 retry-after 秒數，加 2 秒緩衝
          const retryMatch = data.error.message?.match(/try again in ([\d.]+)s/i);
          const retrySec  = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 12;
          console.warn(`[Groq] 429 rate limit — waiting ${retrySec}s then retry`);
          await new Promise(r => setTimeout(r, retrySec * 1000));
          // 重試一次
          const r2   = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: `你是資深股票研究分析師，專精台灣與全球金融市場。\n語言規則：務必使用繁體中文，嚴禁使用簡體中文。` }, { role: 'user', content: prompt }], max_tokens: maxTokens, temperature }) });
          const d2   = await r2.json();
          if (d2.error) {
            console.error('[Groq] Retry also failed:', JSON.stringify(d2.error));
            return res.status(429).json({ error: d2.error.message, retryAfter: retrySec });
          }
          const text2 = d2.choices?.[0]?.message?.content || '';
          console.log('[Groq] Retry success, output length:', text2.length);
          return res.status(200).json({ text: text2 });
        }
        console.error('[Groq] API Error:', JSON.stringify(data.error));
        return res.status(500).json({ error: data.error.message, details: data.error });
      }
      const text = data.choices?.[0]?.message?.content || '';
      console.log('[Groq] Success, output length:', text.length);
      res.status(200).json({ text });
    } catch(e) {
      console.error('[Groq] Catch Error:', e.message, e.stack);
      res.status(500).json({ error: e.message, details: e.stack });
    }
    return;
  }

  if (endpoint === 'ptt_article') {
    const { url: articleUrl } = req.query;
    if (!articleUrl || !articleUrl.includes('ptt.cc')) {
      return res.status(400).json({ error: 'invalid url' });
    }
    const mkC = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c; };
    try {
      const r = await fetch(articleUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
        signal: mkC(8000).signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const html = await r.text();

      // 內文：取 #main-content 去掉 metadata 區塊
      let body = '';
      const mainM = html.match(/id="main-content"[^>]*>([\s\S]*?)(?:<div class="push"|<\/div>)/i);
      if (mainM) {
        body = mainM[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\s*作者\s+.*\n/g, '')
          .replace(/\s*看板\s+.*\n/g, '')
          .replace(/\s*標題\s+.*\n/g, '')
          .replace(/\s*時間\s+.*\n/g, '')
          .replace(/--\s*[\s\S]*$/, '')  // 去除 -- 後的簽名檔
          .replace(/&nbsp;/g, ' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
          .replace(/\s+/g, ' ').trim()
          .slice(0, 300);
      }

      // 推文統計
      const pushTags = [...html.matchAll(/class="push-tag">([^<]+)</g)];
      let pushes = 0;
      for (const m of pushTags) {
        const tag = m[1].trim();
        if (tag === '推') pushes++;
        else if (tag === '噓') pushes--;
      }
      const pushCount  = pushTags.filter(m => m[1].trim() === '推').length;
      const booCount   = pushTags.filter(m => m[1].trim() === '噓').length;
      const neutCount  = pushTags.filter(m => m[1].trim() === '→').length;

      res.status(200).json({ body, pushes, pushCount, booCount, neutCount });
    } catch(e) {
      res.status(200).json({ body: '', pushes: 0, pushCount: 0, booCount: 0, neutCount: 0, error: e.message });
    }
    return;
  }

  if (endpoint === 'ptt') {
    const mkC  = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c; };
    const HDR  = { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' };
    const BASE = 'https://www.ptt.cc';
    const now24 = Date.now() - 24 * 60 * 60 * 1000;
    const SKIP  = ['[公告]','[板規]','Fw:'];

    // 解析單頁 HTML — 用 split 代替 regex，更可靠
    const parsePage = (html, pageRank) => {
      const items = [];
      // 用 split 切出每個 r-ent 區塊
      const blocks = html.split('<div class="r-ent">').slice(1);
      for (const blk of blocks) {
        const linkM = blk.match(/href="(\/bbs\/Stock\/M\.[^"]+)"/i);
        const titM  = blk.match(/<a[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/i);
        if (!linkM || !titM) continue;
        const title = titM[1].trim();
        if (SKIP.some(p => title.startsWith(p))) continue;
        // 推文數：<span class="hl fX">爆/數字/XX</span> 或空
        const nrecM   = blk.match(/<span[^>]*>(爆|\d+|X+)<\/span>/i);
        const nrecRaw = (nrecM?.[1] || '').trim();
        const pushes  = nrecRaw === '爆' ? 99
          : /^X+$/i.test(nrecRaw) ? -nrecRaw.length * 10
          : parseInt(nrecRaw) || 0;
        // 從 URL 取 Unix timestamp（M.1774853650.A）
        const tsM = linkM[1].match(/M\.(\d+)\./);
        const ts  = tsM ? parseInt(tsM[1]) * 1000 : Date.now();
        items.push({
          title,
          link: BASE + linkM[1],
          pushes,
          ts,
          rank: pageRank + items.length + 1,  // 全局排名（跨頁累計）
        });
      }
      return items;
    };

    // 取目前最大頁碼
    const getIndexPage = async () => {
      const r = await fetch(BASE + '/bbs/Stock/index.html', { headers: HDR, signal: mkC(7000).signal });
      const html = await r.text();
      const m = html.match(/href="\/bbs\/Stock\/index(\d+)\.html"[^>]*>[^<]*上頁/);
      return { html, maxPage: m ? parseInt(m[1]) + 1 : null };
    };

    const allEntries = [];
    try {
      const { html: firstHtml, maxPage } = await getIndexPage();
      // 解析第一頁
      allEntries.push(...parsePage(firstHtml, 0));

      // 往前翻頁，最多再抓 4 頁（共 5 頁 ≈ 100 篇）
      if (maxPage) {
        for (let page = maxPage - 1; page >= Math.max(1, maxPage - 4); page--) {
          const r = await fetch(`${BASE}/bbs/Stock/index${page}.html`, { headers: HDR, signal: mkC(6000).signal });
          if (!r.ok) break;
          const items = parsePage(await r.text(), allEntries.length);
          const hasRecent = items.some(it => it.ts >= now24);
          allEntries.push(...items);
          if (!hasRecent) break; // 這頁全超過 24 小時，停止
        }
      }
    } catch(e) {
      // 備案：Atom RSS
      try {
        const r = await fetch(BASE + '/atom/Stock.xml', {
          headers: { ...HDR, 'Accept': 'application/xml,text/xml' }, signal: mkC(8000).signal,
        });
        if (r.ok) {
          const xml = await r.text();
          const re = /<entry>([\s\S]*?)<\/entry>/gi;
          let m, rank = 1;
          while ((m = re.exec(xml)) !== null) {
            const blk = m[1];
            const gt = (tag) => {
              const rx = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
              return (blk.match(rx)||['',''])[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#[0-9]+;/g,'').trim();
            };
            const title = gt('title'), updated = gt('updated');
            const linkM = blk.match(/<link[^>]+href="([^"]+)"/i);
            if (!title || SKIP.some(p => title.startsWith(p))) continue;
            allEntries.push({ title, link: linkM?.[1]||'', pushes: 0, ts: new Date(updated).getTime()||0, rank: rank++, updated, body: '' });
          }
        }
      } catch(e2) {}
    }

    // 篩選 24 小時內，依時間排序，加 updated 欄位
    const result = allEntries
      .filter(e => e.ts >= now24)
      .sort((a,b) => b.ts - a.ts)
      .map((e, i) => ({
        title:   e.title,
        updated: e.updated || new Date(e.ts).toISOString(),
        link:    e.link,
        pushes:  e.pushes,
        rank:    i + 1,   // 重新按時間排名
        body:    e.body || '',
      }));

    res.status(200).json({ data: result.slice(0, 60), count: result.length });
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
    const redditHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    try {
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          r = await fetch(rssUrl, { headers: redditHeaders, signal: mkC(12000).signal });
          if (r.ok) break;
          if (attempt === 0 && (r.status === 429 || r.status === 403)) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`Reddit RSS HTTP ${r.status}`);
        } catch(fetchErr) {
          if (attempt === 1) throw fetchErr;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!r || !r.ok) throw new Error(`Reddit RSS HTTP ${r?.status || 'unknown'}`);
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
        // Reddit Atom 的 score/comments 帶命名空間，直接用原始 XML 比對
        const scoreM = blk.match(/<[a-z]+:score[^>]*>(\d+)<\/[a-z]+:score>|<score[^>]*>(\d+)<\/score>/i);
        const score  = parseInt(scoreM?.[1] || scoreM?.[2] || '0') || 0;
        const commM  = blk.match(/<[a-z]+:comments[^>]*>(\d+)<\/[a-z]+:comments>|<slash:comments[^>]*>(\d+)<\/slash:comments>|<comments[^>]*>(\d+)<\/comments>/i);
        const numComm = parseInt(commM?.[1] || commM?.[2] || commM?.[3] || '0') || 0;
        const linkM    = blk.match(/<link[^>]+href="([^"]+)"/i);
        const link     = linkM ? linkM[1] : '';
        // Extract selftext from <content> or <media:description>
        const contentRx = /<(?:content|media:description)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content|media:description)>/i;
        const contentM = blk.match(contentRx);
        // 清除 HTML 標籤、Reddit 模板文字、多餘空白
        const rawBody = contentM ? contentM[1] : '';
        const body = rawBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#[0-9]+;/g,'')
          .replace(/This post contains content not supported on old Reddit[^.]*/gi, '')
          .replace(/Click here to view the full post/gi, '')
          .replace(/\[link\]|\[comments\]/g, '')
          .replace(/\s+/g,' ').trim().slice(0, 200);
        const idMatch  = idTag.match(/t3_([a-z0-9]+)/i);
        const id       = idMatch ? idMatch[1] : Math.random().toString(36).slice(2);
        const created  = updated ? Math.floor(new Date(updated).getTime() / 1000) : 0;
        if (!title || title.length < 3) continue;
        posts.push({ id, title, body, score: 0, url: link, created, num_comments: numComm, rank: posts.length + 1 });
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
          posts.push({ id: Math.random().toString(36).slice(2), title, body, score: 0, url: link, created, num_comments: 0, rank: posts.length + 1 });
        }
      }

      res.status(200).json({ data: posts.slice(0, parseInt(limit)||25), count: posts.length, sub, sort, source: 'rss' });
    } catch(e) {
      res.status(500).json({ error: e.message, sub, sort });
    }
    return;
  }

  // ── P/C Ratio + 三大法人籌碼 + Max Pain ──
  if (endpoint === 'options') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });

    const CACHE_TTL = 60 * 60 * 1000; // 60 分鐘（盤後日資料）
    if (!global._optionsCache) global._optionsCache = { data: null, ts: 0 };
    const now = Date.now();
    if (global._optionsCache.data && (now - global._optionsCache.ts) < CACHE_TTL) {
      const ageMin = ((now - global._optionsCache.ts) / 60000).toFixed(1);
      return res.status(200).json({ ...global._optionsCache.data, cached: true, cacheAgeMin: parseFloat(ageMin) });
    }

    const today = new Date();
    // 若今天是週末或非交易時間，往前找最近交易日
    const getTradeDate = (offset = 0) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      const dow = d.getDay();
      if (dow === 0) d.setDate(d.getDate() - 2);
      if (dow === 6) d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    };

    const BASE = 'https://api.finmindtrade.com/api/v4/data';
    const fetchFM = async (params) => {
      const url = BASE + '?' + new URLSearchParams(params);
      const r = await fetch(url, { signal: (new AbortController()).signal, headers: { Authorization: `Bearer ${TOKEN}` } });
      const d = await r.json();
      return d.data || [];
    };

    // 嘗試最近 4 個交易日（控制總時間在 Vercel 10s 上限內）
    let optData = [], instData = [];
    const overallDeadline = Date.now() + 8000; // 整體最多 8 秒
    for (let i = 0; i <= 4; i++) {
      if (Date.now() > overallDeadline) break; // 整體超時保護
      const date = getTradeDate(i);
      const ctrl = new AbortController();
      const remaining = overallDeadline - Date.now();
      const perReqTimeout = Math.min(5000, remaining - 500); // 每次最多 5 秒，保留 500ms 緩衝
      if (perReqTimeout <= 0) break;
      setTimeout(() => ctrl.abort(), perReqTimeout);
      try {
        const [opt, inst] = await Promise.all([
          fetch(`${BASE}?dataset=TaiwanOptionDaily&data_id=TXO&start_date=${date}&end_date=${date}`, { signal: ctrl.signal }).then(r => r.json()),
          fetch(`${BASE}?dataset=TaiwanOptionInstitutionalInvestors&data_id=TXO&start_date=${date}&end_date=${date}`, { signal: ctrl.signal }).then(r => r.json()),
        ]);
        optData  = (opt.data  || []).filter(d => d.trading_session === 'position');
        instData = inst.data || [];
        if (optData.length > 0) break;
      } catch(e) { continue; }
    }

    if (!optData.length) {
      return res.status(200).json({ error: 'no data', pcRatio: null, institution: null, maxPain: null });
    }

    // ── P/C Ratio（成交量）──
    let callVol = 0, putVol = 0;
    let callOI  = 0, putOI  = 0;
    const byStrike = {}; // 用於 Max Pain

    for (const row of optData) {
      const cp  = (row.call_put || '').trim().toUpperCase();
      const vol = parseFloat(row.volume) || 0;
      const oi  = parseFloat(row.open_interest) || 0;
      const sp  = parseFloat(row.strike_price) || 0;
      if (cp === 'C' || cp === 'CALL') { callVol += vol; callOI += oi; }
      if (cp === 'P' || cp === 'PUT')  { putVol  += vol; putOI  += oi; }
      // 累積各履約價 OI（Max Pain 用）
      if (sp > 0) {
        if (!byStrike[sp]) byStrike[sp] = { call: 0, put: 0 };
        if (cp === 'C' || cp === 'CALL') byStrike[sp].call += oi;
        if (cp === 'P' || cp === 'PUT')  byStrike[sp].put  += oi;
      }
    }

    const pcVolRatio = callVol > 0 ? putVol / callVol : null;
    const pcOIRatio  = callOI  > 0 ? putOI  / callOI  : null;

    // ── 三大法人籌碼解析 ──
    const institution = { 外資: null, 自營商: null, 投信: null };
    for (const row of instData) {
      const name = row.institutional_investors || row.name || '';
      const longOI  = parseInt(row.long_open_interest_balance_volume)  || 0;
      const shortOI = parseInt(row.short_open_interest_balance_volume) || 0;
      const net = longOI - shortOI;
      if (name.includes('外資')) institution['外資'] = net;
      else if (name.includes('自營')) institution['自營商'] = net;
      else if (name.includes('投信')) institution['投信'] = net;
    }

    // ── Max Pain 計算 ──
    // 對每個可能的結算價，計算所有 Call/Put 買方的總損失
    let maxPain = null;
    const strikes = Object.keys(byStrike).map(Number).sort((a,b) => a-b);
    if (strikes.length > 0) {
      let minLoss = Infinity;
      for (const settle of strikes) {
        let totalLoss = 0;
        for (const sp of strikes) {
          const { call, put } = byStrike[sp];
          // Call 買方在 settle < sp 時虧損：(sp - settle) * call_oi
          if (settle < sp) totalLoss += (sp - settle) * call;
          // Put 買方在 settle > sp 時虧損：(settle - sp) * put_oi
          if (settle > sp) totalLoss += (settle - sp) * put;
        }
        if (totalLoss < minLoss) { minLoss = totalLoss; maxPain = settle; }
      }
    }

    const dataDate = optData[0]?.date?.slice(0, 10) || '';
    const optPayload = {
      date: dataDate,
      pcRatio: { volume: pcVolRatio ? +pcVolRatio.toFixed(3) : null,
                 oi:     pcOIRatio  ? +pcOIRatio.toFixed(3)  : null,
                 callVol: Math.round(callVol), putVol: Math.round(putVol),
                 callOI:  Math.round(callOI),  putOI:  Math.round(putOI) },
      institution,
      maxPain,
      strikes: strikes.slice(0, 30),
    };
    global._optionsCache = { data: optPayload, ts: Date.now() };
    res.status(200).json({ ...optPayload, cached: false });
    return;
  }

  // ── 外資現貨買賣超（整體三大法人）──
  if (endpoint === 'institutional') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });

    const CACHE_TTL = 60 * 60 * 1000; // 60 分鐘
    if (!global._instCache) global._instCache = { data: null, ts: 0 };
    const now = Date.now();
    if (global._instCache.data && (now - global._instCache.ts) < CACHE_TTL) {
      const ageMin = ((now - global._instCache.ts) / 60000).toFixed(1);
      return res.status(200).json({ ...global._instCache.data, cached: true, cacheAgeMin: parseFloat(ageMin) });
    }
    const BASE = 'https://api.finmindtrade.com/api/v4/data';
    try {
      // 取最近 20 個交易日
      const endDate = new Date().toISOString().slice(0, 10);
      const startD  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const url = `${BASE}?dataset=TaiwanStockTotalInstitutionalInvestors&start_date=${startD}&end_date=${endDate}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const d = await r.json();
      const rows = d.data || [];
      // 依日期分組，每日加總三大法人
      const byDate = {};
      for (const row of rows) {
        const dt = row.date?.slice(0, 10);
        if (!dt) continue;
        if (!byDate[dt]) byDate[dt] = { date: dt, buy: 0, sell: 0, net: 0, detail: {} };
        const buy  = parseInt(row.buy)  || 0;
        const sell = parseInt(row.sell) || 0;
        const name = row.name || '';
        byDate[dt].buy  += buy;
        byDate[dt].sell += sell;
        byDate[dt].net  += (buy - sell);
        // 個別法人（外資/投信/自營商）
        if (name.includes('外資')) byDate[dt].detail['外資'] = (buy - sell);
        else if (name.includes('投信')) byDate[dt].detail['投信'] = (buy - sell);
        else if (name.includes('自營')) byDate[dt].detail['自營商'] = (buy - sell);
      }
      // 排序取最近 15 天
      const sorted = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
      // 連續買超/賣超天數（以外資為主）
      let streak = 0;
      for (const day of sorted) {
        const net = day.detail['外資'] ?? day.net;
        if (streak === 0) { streak = net >= 0 ? 1 : -1; continue; }
        if (streak > 0 && net >= 0) streak++;
        else if (streak < 0 && net < 0) streak--;
        else break;
      }
      const instPayload = { data: sorted, streak, latestDate: sorted[0]?.date || null };
      global._instCache = { data: instPayload, ts: Date.now() };
      return res.status(200).json({ ...instPayload, cached: false });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── 融資融券整體市場 ──
  if (endpoint === 'margin') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });

    const CACHE_TTL = 60 * 60 * 1000; // 60 分鐘
    if (!global._marginCache) global._marginCache = { data: null, ts: 0 };
    const now = Date.now();
    if (global._marginCache.data && (now - global._marginCache.ts) < CACHE_TTL) {
      const ageMin = ((now - global._marginCache.ts) / 60000).toFixed(1);
      return res.status(200).json({ ...global._marginCache.data, cached: true, cacheAgeMin: parseFloat(ageMin) });
    }
    const BASE = 'https://api.finmindtrade.com/api/v4/data';
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startD  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const url = `${BASE}?dataset=TaiwanStockTotalMarginPurchaseShortSale&start_date=${startD}&end_date=${endDate}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const d = await r.json();
      const rows = d.data || [];
      // 分離融資(MarginPurchase)和融券(ShortSale)
      const byDate = {};
      for (const row of rows) {
        const dt = row.date?.slice(0, 10);
        if (!dt) continue;
        if (!byDate[dt]) byDate[dt] = { date: dt };
        const name = row.name || '';
        if (name.includes('Margin') || name.includes('融資')) {
          byDate[dt].marginBalance     = parseInt(row.TodayBalance) || 0;
          byDate[dt].marginYesBalance  = parseInt(row.YesBalance) || 0;
          byDate[dt].marginBuy         = parseInt(row.buy) || 0;
          byDate[dt].marginSell        = parseInt(row.sell) || 0;
          byDate[dt].marginReturn      = parseInt(row.Return) || 0;
        } else if (name.includes('Short') || name.includes('融券')) {
          byDate[dt].shortBalance      = parseInt(row.TodayBalance) || 0;
          byDate[dt].shortYesBalance   = parseInt(row.YesBalance) || 0;
          byDate[dt].shortBuy          = parseInt(row.buy) || 0;
          byDate[dt].shortSell         = parseInt(row.sell) || 0;
        }
      }
      const sorted = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
      // 計算融資餘額變化（今日 - 昨日）
      const latest = sorted[0] || {};
      const marginChange = latest.marginBalance && latest.marginYesBalance
        ? latest.marginBalance - latest.marginYesBalance : null;
      const shortChange  = latest.shortBalance && latest.shortYesBalance
        ? latest.shortBalance - latest.shortYesBalance : null;
      const marginPayload = {
        data: sorted,
        latestDate: latest.date || null,
        latest: {
          marginBalance: latest.marginBalance || null,
          marginChange,
          shortBalance:  latest.shortBalance  || null,
          shortChange,
        }
      };
      global._marginCache = { data: marginPayload, ts: Date.now() };
      return res.status(200).json({ ...marginPayload, cached: false });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── 台股熱圖（前50大市值股票）──
  if (endpoint === 'twheatmap') {
    const TOKEN = process.env.FINMIND_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'FINMIND_TOKEN not configured' });

    // ── Server-side cache（Vercel warm instance，TTL 10 分鐘）──
    // 每次有人按「更新」才會打 FinMind（86 req）；10 分鐘內再按直接回快取
    const CACHE_TTL = 60 * 60 * 1000; // 60 分鐘（盤後日資料，一天更新一次）
    if (!global._hmCache) global._hmCache = { data: null, ts: 0 };
    const now = Date.now();
    const forceRefresh = req.query.refresh === '1';
    if (!forceRefresh && global._hmCache.data && (now - global._hmCache.ts) < CACHE_TTL) {
      const ageMin = ((now - global._hmCache.ts) / 60000).toFixed(1);
      return res.status(200).json({
        ...global._hmCache.data,
        cached: true,
        cacheAgeMin: parseFloat(ageMin),
      });
    }

    // 台股精選名單（約250支，各產業市值前N名）
    const STOCK_LIST = [
      // ── 半導體（15）──
      { id:'2330', name:'台積電',    sector:'半導體',   mcap:200000 },
      { id:'2454', name:'聯發科',    sector:'半導體',   mcap:5800 },
      { id:'3711', name:'日月光投控',sector:'半導體',   mcap:2800 },
      { id:'2303', name:'聯電',      sector:'半導體',   mcap:2600 },
      { id:'2344', name:'華邦電',    sector:'半導體',   mcap:800 },
      { id:'3037', name:'欣興',      sector:'半導體',   mcap:750 },
      { id:'2351', name:'順德',      sector:'半導體',   mcap:480 },
      { id:'6239', name:'力成',      sector:'半導體',   mcap:460 },
      { id:'3443', name:'創意',      sector:'半導體',   mcap:440 },
      { id:'2449', name:'京元電子',  sector:'半導體',   mcap:420 },
      { id:'6770', name:'力積電',    sector:'半導體',   mcap:400 },
      { id:'2369', name:'菱生',      sector:'半導體',   mcap:300 },
      { id:'8046', name:'南電',      sector:'半導體',   mcap:280 },
      { id:'3707', name:'漢磊',      sector:'半導體',   mcap:220 },
      { id:'6271', name:'同欣電',    sector:'半導體',   mcap:200 },
      // ── IC設計（8）──
      { id:'3034', name:'聯詠',      sector:'IC設計',   mcap:1200 },
      { id:'2379', name:'瑞昱',      sector:'IC設計',   mcap:1150 },
      { id:'6415', name:'矽力-KY',   sector:'IC設計',   mcap:500 },
      { id:'3231', name:'緯創',      sector:'IC設計',   mcap:480 },
      { id:'4967', name:'十銓',      sector:'IC設計',   mcap:300 },
      { id:'6547', name:'高端疫苗',  sector:'IC設計',   mcap:280 },
      { id:'2207', name:'和泰車',    sector:'IC設計',   mcap:840 },
      { id:'3533', name:'嘉澤',      sector:'IC設計',   mcap:560 },
      // ── 記憶體（4）──
      { id:'2408', name:'南亞科',    sector:'記憶體',   mcap:820 },
      { id:'2337', name:'旺宏',      sector:'記憶體',   mcap:520 },
      { id:'3260', name:'威剛',      sector:'記憶體',   mcap:280 },
      { id:'4977', name:'眾達-KY',   sector:'記憶體',   mcap:180 },
      // ── 電子製造（10）──
      { id:'2317', name:'鴻海',      sector:'電子製造', mcap:4200 },
      { id:'2382', name:'廣達',      sector:'電子製造', mcap:2900 },
      { id:'4938', name:'和碩',      sector:'電子製造', mcap:1000 },
      { id:'2324', name:'仁寶',      sector:'電子製造', mcap:760 },
      { id:'2356', name:'英業達',    sector:'電子製造', mcap:740 },
      { id:'6669', name:'緯穎',      sector:'電子製造', mcap:580 },
      { id:'2354', name:'鴻準',      sector:'電子製造', mcap:460 },
      { id:'2368', name:'金像電',    sector:'電子製造', mcap:360 },
      { id:'2365', name:'昆盈',      sector:'電子製造', mcap:220 },
      { id:'3231', name:'緯創',      sector:'電子製造', mcap:480 },
      // ── 電子零件（8）──
      { id:'2308', name:'台達電',    sector:'電子零件', mcap:3200 },
      { id:'2327', name:'國巨',      sector:'電子零件', mcap:950 },
      { id:'3533', name:'嘉澤',      sector:'電子零件', mcap:560 },
      { id:'2301', name:'光寶科',    sector:'電子零件', mcap:500 },
      { id:'2312', name:'金寶',      sector:'電子零件', mcap:320 },
      { id:'2492', name:'華新科',    sector:'電子零件', mcap:300 },
      { id:'2499', name:'東貝',      sector:'電子零件', mcap:180 },
      { id:'6269', name:'台郡',      sector:'電子零件', mcap:250 },
      // ── 電腦（7）──
      { id:'2357', name:'華碩',      sector:'電腦',     mcap:800 },
      { id:'2353', name:'宏碁',      sector:'電腦',     mcap:780 },
      { id:'2376', name:'技嘉',      sector:'電腦',     mcap:540 },
      { id:'3017', name:'奇鋐',      sector:'電腦',     mcap:480 },
      { id:'2364', name:'倫飛',      sector:'電腦',     mcap:160 },
      { id:'3考', name:'微星',       sector:'電腦',     mcap:420 },
      { id:'2377', name:'微星',      sector:'電腦',     mcap:420 },
      // ── 工業電腦（4）──
      { id:'2395', name:'研華',      sector:'工業電腦', mcap:1050 },
      { id:'6414', name:'樺漢',      sector:'工業電腦', mcap:340 },
      { id:'3615', name:'安勤',      sector:'工業電腦', mcap:200 },
      { id:'6245', name:'立端',      sector:'工業電腦', mcap:180 },
      // ── 網通（5）──
      { id:'2345', name:'智邦',      sector:'網通',     mcap:900 },
      { id:'3702', name:'大聯大',    sector:'網通',     mcap:580 },
      { id:'2332', name:'友訊',      sector:'網通',     mcap:280 },
      { id:'6266', name:'普萊德',    sector:'網通',     mcap:200 },
      { id:'4906', name:'正文',      sector:'網通',     mcap:160 },
      // ── 光學（5）──
      { id:'3008', name:'大立光',    sector:'光學',     mcap:1100 },
      { id:'2474', name:'可成',      sector:'光學',     mcap:380 },
      { id:'3406', name:'玉晶光',    sector:'光學',     mcap:280 },
      { id:'3491', name:'昇達科',    sector:'光學',     mcap:180 },
      { id:'3085', name:'比較',      sector:'光學',     mcap:150 },
      // ── 數位雲端（5）──
      { id:'2391', name:'台光電',    sector:'數位雲端', mcap:600 },
      { id:'6451', name:'訊芯-KY',   sector:'數位雲端', mcap:300 },
      { id:'5285', name:'界霖',      sector:'數位雲端', mcap:200 },
      { id:'6550', name:'北極星藥業',sector:'數位雲端', mcap:180 },
      { id:'6488', name:'環球晶',    sector:'數位雲端', mcap:1400 },
      // ── 金融（16）──
      { id:'2881', name:'富邦金',    sector:'金融',     mcap:2500 },
      { id:'2882', name:'國泰金',    sector:'金融',     mcap:2300 },
      { id:'2886', name:'兆豐金',    sector:'金融',     mcap:2100 },
      { id:'2891', name:'中信金',    sector:'金融',     mcap:2000 },
      { id:'2884', name:'玉山金',    sector:'金融',     mcap:1550 },
      { id:'2892', name:'第一金',    sector:'金融',     mcap:1500 },
      { id:'5880', name:'合庫金',    sector:'金融',     mcap:1450 },
      { id:'2885', name:'元大金',    sector:'金融',     mcap:1400 },
      { id:'2887', name:'台新金',    sector:'金融',     mcap:1350 },
      { id:'2890', name:'永豐金',    sector:'金融',     mcap:1300 },
      { id:'2883', name:'開發金',    sector:'金融',     mcap:1250 },
      { id:'2880', name:'華南金',    sector:'金融',     mcap:1200 },
      { id:'2801', name:'彰銀',      sector:'金融',     mcap:620 },
      { id:'5871', name:'中租-KY',   sector:'金融',     mcap:600 },
      { id:'2834', name:'臺企銀',    sector:'金融',     mcap:420 },
      { id:'2888', name:'新光金',    sector:'金融',     mcap:700 },
      // ── 電信（3）──
      { id:'2412', name:'中華電',    sector:'電信',     mcap:2400 },
      { id:'3045', name:'台灣大',    sector:'電信',     mcap:720 },
      { id:'4904', name:'遠傳',      sector:'電信',     mcap:700 },
      // ── 石化（6）──
      { id:'1301', name:'台塑',      sector:'石化',     mcap:1900 },
      { id:'1303', name:'南亞',      sector:'石化',     mcap:1800 },
      { id:'1326', name:'台化',      sector:'石化',     mcap:1700 },
      { id:'6505', name:'台塑化',    sector:'石化',     mcap:880 },
      { id:'1304', name:'台聚',      sector:'石化',     mcap:280 },
      { id:'1310', name:'台苯',      sector:'石化',     mcap:200 },
      // ── 塑膠（4）──
      { id:'1312', name:'國喬',      sector:'塑膠',     mcap:280 },
      { id:'1313', name:'聯成',      sector:'塑膠',     mcap:240 },
      { id:'1314', name:'中石化',    sector:'塑膠',     mcap:320 },
      { id:'1316', name:'上曜',      sector:'塑膠',     mcap:150 },
      // ── 鋼鐵/機電（6）──
      { id:'2002', name:'中鋼',      sector:'鋼鐵',     mcap:1600 },
      { id:'2049', name:'上銀',      sector:'鋼鐵',     mcap:480 },
      { id:'2014', name:'中鴻',      sector:'鋼鐵',     mcap:260 },
      { id:'1605', name:'華新',      sector:'機電',     mcap:480 },
      { id:'1504', name:'東元',      sector:'機電',     mcap:420 },
      { id:'1503', name:'士電',      sector:'機電',     mcap:300 },
      // ── 汽車（4）──
      { id:'2207', name:'和泰車',    sector:'汽車',     mcap:840 },
      { id:'2204', name:'中華',      sector:'汽車',     mcap:360 },
      { id:'2201', name:'裕隆',      sector:'汽車',     mcap:300 },
      { id:'2206', name:'三陽工業',  sector:'汽車',     mcap:200 },
      // ── 航運（8）──
      { id:'2603', name:'長榮',      sector:'航運',     mcap:2800 },
      { id:'2609', name:'陽明',      sector:'航運',     mcap:1200 },
      { id:'2615', name:'萬海',      sector:'航運',     mcap:800 },
      { id:'2610', name:'華航',      sector:'航運',     mcap:620 },
      { id:'2618', name:'長榮航',    sector:'航運',     mcap:580 },
      { id:'5608', name:'四維航',    sector:'航運',     mcap:180 },
      { id:'2605', name:'新興',      sector:'航運',     mcap:200 },
      { id:'2606', name:'裕民',      sector:'航運',     mcap:180 },
      // ── 生技醫療（6）──
      { id:'4770', name:'上智',      sector:'生技醫療', mcap:150 },
      { id:'4174', name:'浩鼎',      sector:'生技醫療', mcap:280 },
      { id:'1786', name:'科妍',      sector:'生技醫療', mcap:200 },
      { id:'4726', name:'永日',      sector:'生技醫療', mcap:160 },
      { id:'6446', name:'藥華藥',    sector:'生技醫療', mcap:680 },
      { id:'4105', name:'台灣東洋',  sector:'生技醫療', mcap:220 },
      // ── 建材營造（5）──
      { id:'2882', name:'國建',      sector:'建材營造', mcap:300 },
      { id:'2515', name:'中工',      sector:'建材營造', mcap:180 },
      { id:'2504', name:'國產',      sector:'建材營造', mcap:200 },
      { id:'1101', name:'台泥',      sector:'建材營造', mcap:580 },
      { id:'1102', name:'亞泥',      sector:'建材營造', mcap:480 },
      // ── 觀光餐旅（4）──
      { id:'2727', name:'王品',      sector:'觀光',     mcap:280 },
      { id:'2722', name:'夏都',      sector:'觀光',     mcap:150 },
      { id:'2711', name:'豐原',      sector:'觀光',     mcap:120 },
      { id:'6704', name:'安永鑫',    sector:'觀光',     mcap:100 },
      // ── 油電燃氣（3）──
      { id:'9945', name:'潤泰新',    sector:'油電燃氣', mcap:280 },
      { id:'9944', name:'新麗',      sector:'油電燃氣', mcap:160 },
      { id:'8926', name:'台汽電',    sector:'油電燃氣', mcap:200 },
      // ── 綠能環保（4）──
      { id:'6409', name:'旭隼',      sector:'綠能環保', mcap:180 },
      { id:'3576', name:'聯合再生',  sector:'綠能環保', mcap:280 },
      { id:'3661', name:'世芯-KY',   sector:'綠能環保', mcap:600 },
      { id:'6592', name:'和潤企業',  sector:'綠能環保', mcap:320 },
      // ── 零售（5）──
      { id:'2912', name:'統一超',    sector:'零售',     mcap:640 },
      { id:'2903', name:'遠百',      sector:'零售',     mcap:320 },
      { id:'2905', name:'漢神',      sector:'零售',     mcap:180 },
      { id:'5904', name:'寶雅',      sector:'零售',     mcap:380 },
      { id:'2923', name:'鑫鼎',      sector:'零售',     mcap:120 },
      // ── 食品（6）──
      { id:'1216', name:'統一',      sector:'食品',     mcap:660 },
      { id:'1210', name:'大成',      sector:'食品',     mcap:280 },
      { id:'1229', name:'聯華',      sector:'食品',     mcap:220 },
      { id:'1201', name:'味全',      sector:'食品',     mcap:180 },
      { id:'1203', name:'味王',      sector:'食品',     mcap:150 },
      { id:'1218', name:'泰山',      sector:'食品',     mcap:140 },
      // ── 紡織（4）──
      { id:'1402', name:'遠東新',    sector:'紡織',     mcap:860 },
      { id:'1434', name:'福懋',      sector:'紡織',     mcap:260 },
      { id:'1409', name:'新纖',      sector:'紡織',     mcap:180 },
      { id:'1416', name:'廣豐',      sector:'紡織',     mcap:120 },
      // ── 橡膠（3）──
      { id:'9910', name:'豐泰',      sector:'橡膠',     mcap:680 },
      { id:'2107', name:'厚生',      sector:'橡膠',     mcap:180 },
      { id:'2102', name:'泰豐',      sector:'橡膠',     mcap:140 },
    ];

    const BASE = 'https://api.finmindtrade.com/api/v4/data';
    const start = new Date(Date.now() - 10*24*60*60*1000).toISOString().slice(0,10);

    // 全部並行抓取（單一 Promise.all），Vercel 可在 ~3s 完成
    // 每支獨立 AbortController，單支超時不影響其他
    const results = await Promise.all(STOCK_LIST.map(async s => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 8000);
        const url = `${BASE}?dataset=TaiwanStockPrice&data_id=${s.id}&start_date=${start}`;
        const r = await fetch(url, { signal: ctrl.signal, headers: { Authorization: `Bearer ${TOKEN}` } });
        const json = await r.json();
        const rows = (json.data || []).filter(d => d.close > 0).sort((a,b) => a.date.localeCompare(b.date));
        if (rows.length < 1) return null;
        const curr = rows[rows.length-1].close;
        const prev = rows.length >= 2 ? rows[rows.length-2].close : curr;
        const chgPct = prev ? (curr - prev) / prev : 0;
        return { ...s, price: curr, prev, chgPct, date: rows[rows.length-1].date };
      } catch(e) { return null; }
    }));

    // 去重（相同 id 只保留第一筆，避免重複股票）
    const seen = new Set();
    const deduped = results.filter(d => {
      if (!d || seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    const payload = { data: deduped, count: deduped.length };
    global._hmCache = { data: payload, ts: Date.now() };
    res.status(200).json({ ...payload, cached: false });
    return;
  }

  // RSS news feeds
  const RSS_FEEDS = [
    // ── 英文來源 ──
    { url: 'https://feeds.reuters.com/reuters/businessNews',                                                              source: 'Reuters',        lang: 'en' },
    { url: 'https://feeds.reuters.com/reuters/technologyNews',                                                            source: 'Reuters',        lang: 'en' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',                       source: 'CNBC',           lang: 'en' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',                        source: 'CNBC',           lang: 'en' },
    { url: 'https://feeds.bloomberg.com/markets/news.rss',                                                               source: 'Bloomberg',      lang: 'en' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',                                                 source: 'MarketWatch',    lang: 'en' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',                                                source: 'MarketWatch',    lang: 'en' },
    { url: 'https://www.ft.com/?format=rss',                                                                             source: 'FT',             lang: 'en' },
    // ── 台股中文來源 ──
    { url: 'https://news.google.com/rss/search?q=台股+OR+台積電+OR+外資+OR+加權指數&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',   source: 'Google News TW', lang: 'zh' },
    { url: 'https://money.udn.com/rssfeed/news/1001/5590/index.xml',                                                     source: '經濟日報',        lang: 'zh' },
    { url: 'https://news.google.com/rss/search?q=工商時報+台股&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',                        source: '工商時報',        lang: 'zh' },
    { url: 'https://www.cnyes.com/rss/cat/tw_stock',                                                                     source: '鉅亨網',          lang: 'zh' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const results = await Promise.all(RSS_FEEDS.map(async ({ url, source, lang }) => {
      try {
        const extraHeaders = source === '鉅亨網'
          ? { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': 'https://www.cnyes.com/' }
          : {};
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml, */*', ...extraHeaders },
          signal: (()=>{ const c=new AbortController(); setTimeout(()=>c.abort(),8000); return c.signal; })(),
        });
        return { source, lang, xml: r.ok ? await r.text() : null };
      } catch(e) { return { source, lang, xml: null }; }
    }));

    const articles = [];
    for (const { source, lang, xml } of results) {
      if (!xml) continue;
      const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
      for (const item of items.slice(0, 20)) {
        const get = (tag) => {
          const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
          return m ? (m[1] || m[2] || '').trim() : '';
        };
        const title = get('title').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#x2019;/g,"'").replace(/&#x2018;/g,"'").replace(/&quot;/g,'"').replace(/&#[^;]+;/g,'').replace(/<[^>]+>/g,'').trim();
        let description = get('description');
        // Google News RSS 的 description 有時是整段 HTML，需多層清理
        description = description
          .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '')  // 移除 <a> 連結
          .replace(/<[^>]+>/g, '')                   // 移除其他 HTML tag
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#[^;]+;/g, '')
          .replace(/https?:\/\/\S+/g, '')            // 移除殘留 URL
          .trim().slice(0, 300);
        const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
        const pubDate = get('pubDate');
        if (!title || title.length < 5) continue;
        // 中文新聞 description 可能較短，放寬限制
        if (lang === 'en' && (!description || description.length < 20)) continue;
        const pub = pubDate ? new Date(pubDate) : new Date();
        if (isNaN(pub.getTime()) || pub < cutoff) continue;
        articles.push({ title, description, url: link.trim(), publishedAt: pub.toISOString(), source, lang });
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
