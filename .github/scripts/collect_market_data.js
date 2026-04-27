// .github/scripts/collect_market_data.js
// 每日盤後自動抓取市場資料並存入 Supabase

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;  // service_role key（有寫入權限）
const API_BASE          = process.env.VERCEL_API_BASE || 'https://newsdigest-api.vercel.app/api/news';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 工具：fetch with timeout ──
async function fetchJson(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── 工具：upsert（有就更新，沒有就新增）──
async function upsert(table, rows, conflictCols) {
  if (!rows.length) { console.log(`  ${table}: 無資料跳過`); return; }
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictCols, ignoreDuplicates: false });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  console.log(`  ✅ ${table}: ${rows.length} 筆`);
}

// ────────────────────────────────────────
// 1. 台股個股收盤（twheatmap）
// ────────────────────────────────────────
async function collectStockDaily() {
  console.log('\n📊 台股個股收盤...');
  // 強制 refresh=1 跳過 server cache，確保拿到最新資料
  const json = await fetchJson(`${API_BASE}?endpoint=twheatmap&refresh=1`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  const date = json.data[0].date;  // YYYY-MM-DD
  const rows = json.data.map(d => ({
    date:     date,
    stock_id: d.id,
    name:     d.name,
    sector:   d.sector,
    close:    d.price,
    prev:     d.prev,
    chg_pct:  d.chgPct,
    mcap:     d.mcap,
  }));

  await upsert('stock_daily', rows, 'date,stock_id');
  console.log(`  資料日期：${date}`);
}

// ────────────────────────────────────────
// 2. 三大法人現貨買賣超
// ────────────────────────────────────────
async function collectInstitutional() {
  console.log('\n🏢 三大法人買賣超...');
  const json = await fetchJson(`${API_BASE}?endpoint=institutional`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  const latest = json.data[0];
  const row = {
    date:        latest.date,
    foreign_net: latest.detail?.['外資']  ?? null,
    trust_net:   latest.detail?.['投信']  ?? null,
    dealer_net:  latest.detail?.['自營商'] ?? null,
    total_net:   latest.net ?? null,
  };

  await upsert('institutional_daily', [row], 'date');
  console.log(`  資料日期：${latest.date}`);
}

// ────────────────────────────────────────
// 3. 融資融券
// ────────────────────────────────────────
async function collectMargin() {
  console.log('\n💳 融資融券...');
  const json = await fetchJson(`${API_BASE}?endpoint=margin`);
  if (!json.latest || !json.latestDate) { console.log('  無資料'); return; }

  const row = {
    date:           json.latestDate,
    margin_balance: json.latest.marginBalance ?? null,
    margin_chg:     json.latest.marginChange  ?? null,
    short_balance:  json.latest.shortBalance  ?? null,
    short_chg:      json.latest.shortChange   ?? null,
  };

  await upsert('margin_daily', [row], 'date');
  console.log(`  資料日期：${json.latestDate}`);
}

// ────────────────────────────────────────
// 4. 台指選擇權
// ────────────────────────────────────────
async function collectOptions() {
  console.log('\n🎯 台指選擇權...');
  const json = await fetchJson(`${API_BASE}?endpoint=options`);
  if (!json.date || !json.pcRatio) { console.log('  無資料'); return; }

  const row = {
    date:            json.date,
    pc_ratio_oi:     json.pcRatio.oi      ?? null,
    pc_ratio_vol:    json.pcRatio.volume  ?? null,
    max_pain:        json.maxPain         ?? null,
    call_oi:         json.pcRatio.callOI  ?? null,
    put_oi:          json.pcRatio.putOI   ?? null,
    foreign_opt_net: json.institution?.['外資']  ?? null,
    dealer_opt_net:  json.institution?.['自營商'] ?? null,
    trust_opt_net:   json.institution?.['投信']  ?? null,
  };

  await upsert('options_daily', [row], 'date');
  console.log(`  資料日期：${json.date}`);
}

// ────────────────────────────────────────
// 5. 全球商品/指數
// ────────────────────────────────────────
async function collectFutures() {
  console.log('\n🌍 全球商品/指數...');
  const json = await fetchJson(`${API_BASE}?endpoint=futures`);
  if (!json.data?.length) { console.log('  無資料'); return; }

  // futures 沒有明確 date，用今天台灣日期
  const twDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const rows = json.data
    .filter(d => d.price && d.symbol)
    .map(d => ({
      date:    twDate,
      symbol:  d.symbol,
      name:    d.name,
      cat:     d.cat,
      price:   d.price,
      chg_pct: d.chgPct,
    }));

  await upsert('futures_daily', rows, 'date,symbol');
  console.log(`  資料日期：${twDate}`);
}

// ────────────────────────────────────────
// 6. TWSE 個股收盤（取代 FinMind twheatmap，覆蓋全部上市股票）
// ────────────────────────────────────────
async function collectTWSEStockDaily() {
  console.log('\n📈 TWSE 個股收盤（全上市）...');
  const TWSE_BASE = 'https://openapi.twse.com.tw/v1';

  // 民國日期轉西元
  const twDateToISO = (twDate) => {
    if (!twDate) return null;
    const s = String(twDate);
    const year = parseInt(s.slice(0, s.length - 4)) + 1911;
    const mmdd = s.slice(-4);
    return `${year}-${mmdd.slice(0,2)}-${mmdd.slice(2)}`;
  };

  const data = await fetchJson(`${TWSE_BASE}/exchangeReport/STOCK_DAY_ALL`);
  if (!Array.isArray(data) || !data.length) { console.log('  無資料'); return; }

  const isoDate = twDateToISO(data[0].Date);
  if (!isoDate) { console.log('  日期解析失敗'); return; }

  // 只處理有收盤價的股票（過濾 ETF 轉換、暫停交易等）
  const rows = data
    .filter(d => d.ClosingPrice && d.ClosingPrice !== '--' && d.Code && !/[A-Z]/.test(d.Code.slice(-1)))
    .map(d => {
      const close = parseFloat(d.ClosingPrice?.replace(/,/g,'')) || null;
      const change = parseFloat(d.Change?.replace(/[+,]/g,'')) || 0;
      const prev   = close && change !== null ? close - change : null;
      return {
        date:     isoDate,
        stock_id: d.Code,
        name:     d.Name,
        close,
        prev,
        chg_pct:  close && prev && prev !== 0 ? (close - prev) / prev : null,
        volume:   parseInt(d.TradeVolume?.replace(/,/g,'')) || null,
        source:   'twse',
      };
    })
    .filter(d => d.close);

  await upsert('stock_daily_twse', rows, 'date,stock_id');
  console.log(`  資料日期：${isoDate}，${rows.length} 支`);
}

// ────────────────────────────────────────
// 7. TWSE 官方產業指數（MI_INDEX）
// ────────────────────────────────────────
async function collectSectorIndex() {
  console.log('\n📊 TWSE 官方產業指數...');
  const TWSE_BASE = 'https://openapi.twse.com.tw/v1';

  const twDateToISO = (twDate) => {
    const s = String(twDate);
    const year = parseInt(s.slice(0, s.length - 4)) + 1911;
    const mmdd = s.slice(-4);
    return `${year}-${mmdd.slice(0,2)}-${mmdd.slice(2)}`;
  };

  const data = await fetchJson(`${TWSE_BASE}/exchangeReport/MI_INDEX`);
  if (!Array.isArray(data) || !data.length) { console.log('  無資料'); return; }

  const isoDate = twDateToISO(data[0]['日期']);

  // 只保留產業類指數（過濾寶島指數、報酬指數等非產業指數）
  const sectorKeywords = ['類指數', '半導體', '金融', '電子', '航運', '鋼鐵', '塑膠', '紡織', '食品', '化學', '汽車', '建材', '觀光', '資訊', '通信', '油電'];
  const rows = data
    .filter(d => {
      const name = d['指數'] || '';
      return sectorKeywords.some(k => name.includes(k)) && d['收盤指數'] && d['收盤指數'] !== '--';
    })
    .map(d => ({
      date:       isoDate,
      index_name: d['指數'],
      close:      parseFloat(d['收盤指數']?.replace(/,/g,'')) || null,
      change:     parseFloat(d['漲跌點數']?.replace(/[+,]/g,'').replace('▲','').replace('▼','-')) || null,
      chg_pct:    parseFloat(d['漲跌百分比']?.replace(/[+%]/g,'')) || null,
    }))
    .filter(d => d.close);

  await upsert('sector_index_daily', rows, 'date,index_name');
  console.log(`  資料日期：${isoDate}，${rows.length} 個產業指數`);
}

// ────────────────────────────────────────
// 8. TWSE 個股本益比、殖利率、PBR（BWIBBU_ALL）
// ────────────────────────────────────────
async function collectStockValuation() {
  console.log('\n💹 TWSE 個股估值（PER/殖利率/PBR）...');
  const TWSE_BASE = 'https://openapi.twse.com.tw/v1';

  const twDateToISO = (twDate) => {
    const s = String(twDate);
    const year = parseInt(s.slice(0, s.length - 4)) + 1911;
    const mmdd = s.slice(-4);
    return `${year}-${mmdd.slice(0,2)}-${mmdd.slice(2)}`;
  };

  const data = await fetchJson(`${TWSE_BASE}/exchangeReport/BWIBBU_ALL`);
  if (!Array.isArray(data) || !data.length) { console.log('  無資料'); return; }

  const isoDate = twDateToISO(data[0].Date);

  const rows = data
    .filter(d => d.Code && !/[A-Z]/.test(d.Code.slice(-1)))
    .map(d => ({
      date:           isoDate,
      stock_id:       d.Code,
      name:           d.Name,
      pe_ratio:       parseFloat(d.PEratio) || null,
      dividend_yield: parseFloat(d.DividendYield) || null,
      pb_ratio:       parseFloat(d.PBratio) || null,
    }))
    .filter(d => d.pe_ratio || d.dividend_yield || d.pb_ratio);

  await upsert('stock_valuation_daily', rows, 'date,stock_id');
  console.log(`  資料日期：${isoDate}，${rows.length} 支`);
}

// ────────────────────────────────────────
// 主程式
// ────────────────────────────────────────
async function main() {
  const MODE = process.env.COLLECT_MODE || 'all';
  console.log('═══════════════════════════════════════');
  console.log('  AlphaScope — 每日資料收集');
  console.log(`  執行時間：${new Date().toISOString()}`);
  console.log(`  模式：${MODE}`);
  console.log('═══════════════════════════════════════');

  // twse  → 台灣時間 15:00，TWSE 盤後立即可取
  // finmind → 台灣時間 16:30，FinMind 法人/選擇權/融資券更新完畢
  // all   → 手動觸發時全收（向下相容）
  const tasks = [];
  const names = [];

  if (MODE === 'twse' || MODE === 'all') {
    tasks.push(collectTWSEStockDaily(), collectSectorIndex(), collectStockValuation());
    names.push('台股個股(TWSE)', '產業指數(TWSE)', '個股估值(TWSE)');
  }
  if (MODE === 'finmind' || MODE === 'all') {
    tasks.push(collectStockDaily(), collectInstitutional(), collectMargin(), collectOptions(), collectFutures());
    names.push('台股個股(FM)', '三大法人(FM)', '融資融券(FM)', '台指選擇權(FM)', '全球商品(FM)');
  }

  const results = await Promise.allSettled(tasks);

  console.log('\n═══════════════════════════════════════');
  let hasError = false;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`❌ ${names[i]} 失敗：${r.reason?.message}`);
      hasError = true;
    }
  });

  if (hasError) process.exit(1);
  console.log('✅ 所有資料收集完成');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
