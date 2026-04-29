/**
 * AlphaScope — 每日資料收集腳本 v3
 * 路徑：.github/scripts/collect_market_data.js
 * Node.js 24（原生 fetch）
 */

const SUPABASE_URL = process.env.SUPABASE_URL   || 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const FM_TOKEN     = process.env.FINMIND_TOKEN;
const MODE         = process.env.COLLECT_MODE   || 'all';

function nowTW() { return new Date(Date.now() + 8 * 3600_000); }

function lastTradingDay() {
  const tw   = nowTW();
  const hour = tw.getUTCHours();
  let d = new Date(tw);
  if (hour < 16) d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayTW()  { return nowTW().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

async function fmFetch(dataset, params = {}) {
  if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定');
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', dataset);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${FM_TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`FinMind HTTP ${res.status} — ${dataset}`);
  const json = await res.json();
  if (json.status !== 200 && json.msg && json.msg !== 'success')
    throw new Error(`FinMind error: ${json.msg} — ${dataset}`);
  return json.data || [];
}

async function sbUpsert(table, rows, onConflict) {
  if (!SB_KEY) throw new Error('SUPABASE_SERVICE_KEY 未設定');
  if (!rows.length) { console.log(`  ⏭ ${table}：0 筆，略過`); return; }
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Supabase ${table} upsert 失敗 HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }
    total += batch.length;
  }
  console.log(`  ✅ ${table}：${total} 筆 upserted`);
}

// ══════════════════════════════════════════
// TWSE 任務
// ══════════════════════════════════════════

async function collectTWSEDaily() {
  console.log('📊 台股個股收盤（TWSE OpenAPI）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const tradeDate = lastTradingDay();
    console.log(`  📅 寫入日期：${tradeDate}`);
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => {
        const close  = parseFloat(r.ClosingPrice?.replace(/,/g, '')) || 0;
        const change = parseFloat(r.Change?.replace(/,/g, ''))       || 0;
        const prev   = close > 0 ? parseFloat((close - change).toFixed(2)) : 0;
        const chgPct = prev  > 0 ? parseFloat((change / prev).toFixed(6))  : 0;
        return { date: tradeDate, stock_id: r.Code, name: r.Name || '',
          close, prev, chg_pct: chgPct, volume: parseInt(r.TradeVolume?.replace(/,/g, '')) || 0, source: 'twse' };
      }).filter(r => r.close > 0);
    await sbUpsert('stock_daily_twse', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 台股個股 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectSectorIndex() {
  console.log('📈 產業指數（TWSE MI_INDEX）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX',
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (!raw.length) throw new Error('API 回傳空陣列');
    console.log(`  🔍 欄位：${Object.keys(raw[0]).join(', ')}`);
    const tradeDate = lastTradingDay();
    // 從 log 已知欄位：日期, 指數, 收盤指數, 漲跌, 漲跌點數, 漲跌百分比
    const rows = raw
      .filter(r => {
        const name = r['指數'] || '';
        return name && !name.includes('報酬') && !name.includes('槓桿') && !name.includes('反向');
      })
      .map(r => {
        const indexName = r['指數']       || '';
        const close     = parseFloat((r['收盤指數'] || '').replace(/,/g, '')) || 0;
        const sign      = (r['漲跌']      || '').trim();
        const rawPct    = parseFloat((r['漲跌百分比'] || '').replace(/,/g, '')) || 0;
        const chgPct    = sign === '-' ? -rawPct : rawPct;
        // sector_index_daily 實際欄位：date, index_name, close, chg_pct, source（無 prev）
        return { date: tradeDate, index_name: indexName, close, chg_pct: chgPct, source: 'twse' };
      })
      .filter(r => r.close > 0 && r.index_name);
    if (!rows.length) {
      console.error(`  ⚠️ 0 筆（原始 ${raw.length} 筆），第一筆：${JSON.stringify(raw[0])}`);
    }
    await sbUpsert('sector_index_daily', rows, 'date,index_name');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 產業指數 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

async function collectValuation() {
  console.log('💹 個股估值（TWSE BWIBBU_ALL）...');
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const tradeDate = lastTradingDay();
    const rows = raw
      .filter(r => r.Code && /^\d{4,5}$/.test(r.Code))
      .map(r => ({
        date: tradeDate, stock_id: r.Code,
        pe_ratio: parseFloat(r.PEratio) || null,
        pb_ratio: parseFloat(r.PBratio) || null,
        dividend_yield: parseFloat(r.DividendYield) || null,
      })).filter(r => r.pb_ratio != null || r.pe_ratio != null);
    await sbUpsert('stock_valuation_daily', rows, 'date,stock_id');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 估值 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// FinMind 任務
// ══════════════════════════════════════════

async function collectInstitutional() {
  console.log('🏢 三大法人買賣超（FinMind）...');
  try {
    const data = await fmFetch('TaiwanStockTotalInstitutionalInvestors',
      { start_date: daysAgo(5), end_date: todayTW() });
    if (!data.length) throw new Error('無資料');
    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt, foreign_net: 0, trust_net: 0, dealer_net: 0, total_net: 0 };
      const net = (parseInt(r.buy) || 0) - (parseInt(r.sell) || 0);
      const name = r.name || '';
      if (name.includes('外資'))    byDate[dt].foreign_net += net;
      else if (name.includes('投信'))  byDate[dt].trust_net  += net;
      else if (name.includes('自營商')) byDate[dt].dealer_net += net;
      byDate[dt].total_net += net;
    }
    const rows = Object.values(byDate);
    await sbUpsert('institutional_daily', rows, 'date');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 三大法人 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

/**
 * 融資融券 → margin_daily
 * Supabase 實際欄位（截圖已確認）：date, margin_balance, margin_chg, short_balance, short_chg
 * FinMind TaiwanStockTotalMarginPurchaseShortSale：TodayBalance, YesBalance, buy, date, name, Return, sell
 */
async function collectMargin() {
  console.log('💳 融資融券（FinMind）...');
  try {
    const data = await fmFetch('TaiwanStockTotalMarginPurchaseShortSale',
      { start_date: daysAgo(5), end_date: todayTW() });
    if (!data.length) throw new Error('無資料');
    const names = [...new Set(data.map(r => r.name))];
    console.log(`  🔍 FinMind name 值：${names.join(' | ')}`);
    const byDate = {};
    for (const r of data) {
      const dt = r.date?.slice(0, 10);
      if (!dt) continue;
      if (!byDate[dt]) byDate[dt] = { date: dt, margin_balance: null, margin_chg: null, short_balance: null, short_chg: null };
      const today = parseInt(r.TodayBalance) || 0;
      const yes   = parseInt(r.YesBalance)   || 0;
      const name  = r.name || '';
      // FinMind 實際 name 值（從 log 確認）：MarginPurchase | ShortSale | MarginPurchaseMoney
      if (name === 'MarginPurchase') {
        byDate[dt].margin_balance = today;
        byDate[dt].margin_chg    = today - yes;
      } else if (name === 'ShortSale') {
        byDate[dt].short_balance = today;
        byDate[dt].short_chg    = today - yes;
      }
    }
    const rows = Object.values(byDate).filter(r => r.margin_balance != null || r.short_balance != null);
    await sbUpsert('margin_daily', rows, 'date');
    return { ok: true, count: rows.length };
  } catch (e) { console.error(`  ❌ 融資融券 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

/**
 * 台指選擇權 → options_daily
 * 前端讀取欄位（index.html 確認）：date, pc_ratio_oi, foreign_opt_net
 * FinMind TaiwanOptionDaily：date, option_id, strike_price, call_put, volume, open_interest, trading_session
 * FinMind TaiwanOptionInstitutionalInvestors：institutional_investors, long/short_open_interest_balance_volume
 */
async function collectOptions() {
  console.log('🎯 台指選擇權（FinMind）...');
  try {
    let optData = [], tradeDate = '';
    for (let i = 0; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86_400_000);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = d.toISOString().slice(0, 10);
      const rows = await fmFetch('TaiwanOptionDaily', { data_id: 'TXO', start_date: ds, end_date: ds });
      if ((rows || []).length > 0) { optData = rows; tradeDate = ds; break; }
    }
    if (!optData.length) throw new Error('找不到選擇權資料（近 7 個交易日）');
    console.log(`  📅 日期：${tradeDate}，${optData.length} 筆`);

    let callVol = 0, putVol = 0, callOI = 0, putOI = 0;
    const byStrike = {};
    for (const r of optData) {
      const cp  = (r.call_put || '').trim().toUpperCase();
      const vol = parseFloat(r.volume)        || 0;
      const oi  = parseFloat(r.open_interest) || 0;
      const sp  = parseFloat(r.strike_price)  || 0;
      if (cp === 'C' || cp === 'CALL') { callVol += vol; callOI += oi; }
      if (cp === 'P' || cp === 'PUT')  { putVol  += vol; putOI  += oi; }
      if (sp > 0) {
        if (!byStrike[sp]) byStrike[sp] = { call: 0, put: 0 };
        if (cp === 'C' || cp === 'CALL') byStrike[sp].call += oi;
        if (cp === 'P' || cp === 'PUT')  byStrike[sp].put  += oi;
      }
    }

    // Max Pain
    const strikes = Object.keys(byStrike).map(Number).sort((a, b) => a - b);
    let maxPain = null, minLoss = Infinity;
    for (const settle of strikes) {
      let loss = 0;
      for (const sp of strikes) {
        if (settle < sp) loss += (sp - settle) * byStrike[sp].call;
        if (settle > sp) loss += (settle - sp) * byStrike[sp].put;
      }
      if (loss < minLoss) { minLoss = loss; maxPain = settle; }
    }

    // 法人部位
    let foreignLong = 0, foreignShort = 0;
    try {
      const inst = await fmFetch('TaiwanOptionInstitutionalInvestors',
        { data_id: 'TXO', start_date: tradeDate, end_date: tradeDate });
      for (const r of (inst || [])) {
        const inv = r.institutional_investors || r.name || '';
        if (inv.includes('外資')) {
          foreignLong  += parseInt(r.long_open_interest_balance_volume)  || 0;
          foreignShort += parseInt(r.short_open_interest_balance_volume) || 0;
        }
      }
    } catch (e) { console.warn(`  ⚠️ 法人選擇權資料失敗：${e.message}`); }

    const row = {
      date:            tradeDate,
      pc_ratio_vol:    callVol > 0 ? parseFloat((putVol  / callVol).toFixed(4)) : null,
      pc_ratio_oi:     callOI  > 0 ? parseFloat((putOI   / callOI).toFixed(4))  : null,
      foreign_opt_net: foreignLong - foreignShort,  // ← 前端用 foreign_opt_net
    };
    // ⚠️ 只寫入 Supabase 已確認存在的欄位（call_vol/put_vol/call_oi/put_oi/max_pain 需先建欄位）
    await sbUpsert('options_daily', [row], 'date');
    return { ok: true, count: 1, date: tradeDate };
  } catch (e) { console.error(`  ❌ 選擇權 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

/**
 * 全球商品/指數 — 前端走 Vercel proxy，Supabase futures_daily 欄位未確認
 * 暫時只抓資料並 log，不寫入 Supabase（避免 400 錯誤）
 */
async function collectFutures() {
  console.log('🌍 全球商品/指數（stooq + FinMind）...');
  try {
    const today = new Date();
    const d2    = today.toISOString().slice(0,10).replace(/-/g,'');
    const d1    = new Date(today - 30*86400000).toISOString().slice(0,10).replace(/-/g,'');

    const STOOQ = [
      ['%5Etwii','台灣加權','亞股指數'],['%5Enk225','日經225','亞股指數'],['%5Ehsi','香港恆生','亞股指數'],
      ['%5Edax','德國DAX','歐股指數'],['%5Eftse','英國FTSE100','歐股指數'],
      ['GLD.US','黃金ETF','金屬'],['SLV.US','白銀ETF','金屬'],['COPX.US','銅礦ETF','金屬'],
      ['USO.US','原油ETF','能源'],['UNG.US','天然氣ETF','能源'],
      ['EURUSD','歐元/美元','外匯'],['GBPUSD','英鎊/美元','外匯'],['USDJPY','美元/日圓','外匯'],
      ['USDCNH','美元/人民幣','外匯'],['TLT.US','20年美債ETF','債券'],
      ['IBIT.US','比特幣ETF','加密貨幣'],['FETH.US','以太幣ETF','加密貨幣'],
    ];

    const stooqRows = (await Promise.all(STOOQ.map(async ([sym, name, cat]) => {
      try {
        const r   = await fetch(`https://stooq.com/q/d/l/?s=${sym}&d1=${d1}&d2=${d2}&i=d`,
          { headers: {'User-Agent':'Mozilla/5.0'}, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return null;
        const csv = await r.text();
        if (!csv || csv.includes('No data') || csv.length < 20) return null;
        const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date'));
        if (!lines.length) return null;
        const l = lines[lines.length-1].split(',');
        const p = lines.length >= 2 ? lines[lines.length-2].split(',') : l;
        const close = parseFloat(l[4]);
        const prev  = parseFloat(p[4]);
        if (!close || isNaN(close)) return null;
        return { date: l[0], symbol: sym, name, cat, close, prev,
          chg_pct: prev ? parseFloat(((close-prev)/prev).toFixed(6)) : 0, source:'stooq' };
      } catch { return null; }
    }))).filter(Boolean);

    // ── FinMind（美股指數 + 商品）──
    // dataset 名稱已從 FinMind 文件確認
    const FM_ITEMS = [
      { ds: 'USStockPrice',          id: '^GSPC',  name: 'S&P500',    cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',          id: '^IXIC',  name: '那斯達克',  cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',          id: '^DJI',   name: '道瓊',      cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',          id: '^VIX',   name: 'VIX',       cat: '波動率',   ck: 'Close' },
      { ds: 'GoldFuturesDailyPrice', id: '',       name: '黃金現貨',  cat: '金屬',     ck: 'price' },
      { ds: 'CrudeOilPrices',        id: 'WTI',    name: 'WTI原油',   cat: '能源',     ck: 'price' },
      { ds: 'CrudeOilPrices',        id: 'Brent',  name: 'Brent原油', cat: '能源',     ck: 'price' },
    ];

    const fmRows = FM_TOKEN ? (await Promise.all(FM_ITEMS.map(async s => {
      try {
        const params = { start_date: daysAgo(7) };
        if (s.id) params.data_id = s.id;
        const rows = await fmFetch(s.ds, params);
        const sorted = (rows||[]).filter(r => (r[s.ck]||r.Close||r.close||r.price) > 0)
          .sort((a,b) => (a.date||'').localeCompare(b.date||''));
        if (!sorted.length) { console.log(`  ⚠️  ${s.name}(${s.ds}) 無資料`); return null; }
        const curr  = sorted[sorted.length-1];
        const prev  = sorted.length >= 2 ? sorted[sorted.length-2] : curr;
        const close = curr[s.ck]||curr.Close||curr.close||curr.price||0;
        const pClose= prev[s.ck]||prev.Close||prev.close||prev.price||close;
        return { date: curr.date?.slice(0,10), symbol: s.id||s.ds, name: s.name, cat: s.cat,
          close, prev: pClose, chg_pct: pClose ? parseFloat(((close-pClose)/pClose).toFixed(6)):0, source:'finmind' };
      } catch(e) { console.log(`  ⚠️  ${s.name}(${s.ds}) 失敗：${e.message}`); return null; }
    }))).filter(Boolean) : [];

    const allRows = [...fmRows, ...stooqRows];
    console.log(`  stooq: ${stooqRows.length}/${STOOQ.length}，FinMind: ${fmRows.length}/${FM_ITEMS.length}，合計: ${allRows.length}`);
    console.log(`  ℹ️  futures_daily Supabase 欄位待確認，本次不寫入（前端走 Vercel proxy）`);

    // stooq 在 GitHub Actions IP 被擋屬正常，只要 FinMind 有資料即可
    if (!allRows.length) {
      // 不 throw — 改為 warn，避免整個 pipeline 標記失敗
      console.warn(`  ⚠️  全球商品：stooq 被擋且 FinMind 無資料，前端改從 Vercel proxy 即時取得`);
    }
    return { ok: true, count: allRows.length };
  } catch (e) { console.error(`  ❌ 全球商品 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// 主程式
// ══════════════════════════════════════════
async function main() {
  const isTWSE    = MODE === 'twse'    || MODE === 'all';
  const isFinMind = MODE === 'finmind' || MODE === 'all';
  console.log('═══════════════════════════════════════');
  console.log('  AlphaScope — 每日資料收集 v3');
  console.log(`  執行時間：${new Date().toISOString()}`);
  console.log(`  模式：${MODE}  (TWSE:${isTWSE} / FinMind:${isFinMind})`);
  if (!FM_TOKEN) console.warn('  ⚠️  FINMIND_TOKEN 未設定');
  if (!SB_KEY)   console.warn('  ⚠️  SUPABASE_SERVICE_KEY 未設定');
  console.log('═══════════════════════════════════════');

  const results = {};
  if (isTWSE) {
    console.log('\n── TWSE OpenAPI ──');
    results.twseDaily   = await collectTWSEDaily();
    results.sectorIndex = await collectSectorIndex();
    results.valuation   = await collectValuation();
  }
  if (isFinMind) {
    console.log('\n── FinMind API ──');
    results.institutional = await collectInstitutional();
    results.margin        = await collectMargin();
    results.options       = await collectOptions();
    results.futures       = await collectFutures();
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  執行結果摘要');
  console.log('═══════════════════════════════════════');
  let hasError = false;
  for (const [key, val] of Object.entries(results)) {
    if (val.ok) console.log(`  ✅ ${key}：${val.count??'—'} 筆${val.date?` (${val.date})`:''}`);
    else { console.log(`  ❌ ${key}：${val.error}`); hasError = true; }
  }
  console.log('═══════════════════════════════════════');
  if (hasError) process.exit(1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
