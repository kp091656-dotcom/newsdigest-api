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
    signal: AbortSignal.timeout(45_000), // 45 秒
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
        const chgPts    = parseFloat((r['漲跌點數'] || '').replace(/,/g, '')) || 0;
        const rawPct    = parseFloat((r['漲跌百分比'] || '').replace(/,/g, '')) || 0;
        const chgPct    = sign === '-' ? -rawPct : rawPct;
        const change    = sign === '-' ? -chgPts : chgPts;
        return { date: tradeDate, index_name: indexName, close, change, chg_pct: chgPct };
      })
      .filter(r => r.close > 0 && r.index_name);
    if (!rows.length) {
      console.error(`  ⚠️ 0 筆（原始 ${raw.length} 筆），第一筆：${JSON.stringify(raw[0])}`);
    }
    await sbUpsert('sector_index_daily', rows, 'date,index_name');

    // ── 額外：把「發行量加權股價指數」寫入 stock_daily_twse（stock_id='TAIEX'）──
    const taiexRow = rows.find(r => r.index_name === '發行量加權股價指數');
    if (taiexRow) {
      const prev = taiexRow.close - taiexRow.change;
      const chgPct = prev > 0 ? parseFloat((taiexRow.change / prev).toFixed(6)) : 0;
      await sbUpsert('stock_daily_twse', [{
        date:     taiexRow.date,
        stock_id: 'TAIEX',
        name:     '台灣加權指數',
        close:    taiexRow.close,
        prev:     parseFloat(prev.toFixed(2)),
        chg_pct:  chgPct,
        volume:   0,
        source:   'twse_index',
      }], 'date,stock_id');
      console.log(`  📊 台灣加權指數寫入 stock_daily_twse：${taiexRow.close}（${chgPct >= 0 ? '+' : ''}${(chgPct*100).toFixed(2)}%）`);
    }

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
        name: r.Name || null,
        pe_ratio: (() => {
          const v = parseFloat(r.PEratio);
          return (!isNaN(v) && v > 0 && v <= 200) ? v : null;
        })(),
        pb_ratio: (() => {
          const v = parseFloat(r.PBratio);
          return (!isNaN(v) && v > 0) ? v : null;
        })(),
        dividend_yield: (() => {
          const v = parseFloat(r.DividendYield);
          return (!isNaN(v) && v >= 0) ? v : null;
        })(),
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
      foreign_opt_net: foreignLong - foreignShort,
    };
    await sbUpsert('options_daily', [row], 'date');
    return { ok: true, count: 1, date: tradeDate };
  } catch (e) { console.error(`  ❌ 選擇權 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

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

    const FM_ITEMS = [
      { ds: 'USStockPrice',   id: '^GSPC',  name: 'S&P500',    cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',   id: '^IXIC',  name: '那斯達克',  cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',   id: '^DJI',   name: '道瓊',      cat: '美股指數', ck: 'Close' },
      { ds: 'USStockPrice',   id: '^VIX',   name: 'VIX',       cat: '波動率',   ck: 'Close' },
      { ds: 'GoldPrice',      id: '',       name: '黃金現貨',  cat: '金屬',     ck: 'price' },
      { ds: 'CrudeOilPrices', id: 'WTI',    name: 'WTI原油',   cat: '能源',     ck: 'price' },
      { ds: 'CrudeOilPrices', id: 'Brent',  name: 'Brent原油', cat: '能源',     ck: 'price' },
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

    if (!allRows.length) {
      console.warn(`  ⚠️  全球商品：stooq 被擋且 FinMind 無資料，前端改從 Vercel proxy 即時取得`);
    }
    return { ok: true, count: allRows.length };
  } catch (e) { console.error(`  ❌ 全球商品 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// 籌碼資料任務 v2（含小台/微台/選擇權）
// ══════════════════════════════════════════

async function collectChips() {
  console.log('📡 籌碼資料（FinMind 現貨法人 + TAIFEX 期貨/選擇權三大法人）...');
  const tradeDate = lastTradingDay();

  const result = {
    date: tradeDate,
    spot_dealer_buy: null, spot_dealer_sell: null, spot_dealer_net: null,
    spot_trust_buy:  null, spot_trust_sell:  null, spot_trust_net:  null,
    spot_foreign_buy:null, spot_foreign_sell:null, spot_foreign_net:null,
    spot_total_net:  null,
    fut_tx_dealer_long: null, fut_tx_dealer_short: null, fut_tx_dealer_net: null,
    fut_tx_trust_long:  null, fut_tx_trust_short:  null, fut_tx_trust_net:  null,
    fut_tx_foreign_long:null, fut_tx_foreign_short:null, fut_tx_foreign_net:null,
    fut_tx_total_net:   null,
    fut_mtx_dealer_net: null, fut_mtx_trust_net: null, fut_mtx_foreign_net: null, fut_mtx_total_net: null,
    fut_tmf_dealer_net: null, fut_tmf_trust_net: null, fut_tmf_foreign_net: null, fut_tmf_total_net: null,
    opt_call_dealer_long: null, opt_call_dealer_short: null, opt_call_dealer_net: null,
    opt_call_trust_long:  null, opt_call_trust_short:  null, opt_call_trust_net:  null,
    opt_call_foreign_long:null, opt_call_foreign_short:null, opt_call_foreign_net:null,
    opt_put_dealer_long:  null, opt_put_dealer_short:  null, opt_put_dealer_net:  null,
    opt_put_trust_long:   null, opt_put_trust_short:   null, opt_put_trust_net:   null,
    opt_put_foreign_long: null, opt_put_foreign_short: null, opt_put_foreign_net: null,
  };

  // ── 1. 現貨三大法人（多 endpoint 嘗試）──
  // 嘗試順序：MI_INST → BFIA01 → FinMind（若有 token）
  try {
    const toB = (str) => {
      const n = parseFloat((str || '').replace(/,/g, ''));
      return isNaN(n) ? null : parseFloat((n / 100000).toFixed(2)); // 千元 → 億元
    };
    const parseSpot = (raw, keyMap) => {
      // keyMap: { typeKey, buyKey, sellKey, netKey }
      for (const row of raw) {
        const type = (row[keyMap.typeKey] || '').trim();
        const buy  = toB(row[keyMap.buyKey]  || '');
        const sell = toB(row[keyMap.sellKey] || '');
        const net  = toB(row[keyMap.netKey]  || '');
        if (type.includes('自營商') && (type.includes('自行') || !type.includes('避險'))) {
          result.spot_dealer_buy = buy; result.spot_dealer_sell = sell; result.spot_dealer_net = net;
        } else if (type.includes('投信')) {
          result.spot_trust_buy  = buy; result.spot_trust_sell  = sell; result.spot_trust_net  = net;
        } else if (type.includes('外資') && !type.includes('自營')) {
          result.spot_foreign_buy = buy; result.spot_foreign_sell = sell; result.spot_foreign_net = net;
        } else if (type.includes('合計') || type.includes('三大法人')) {
          result.spot_total_net = net;
        }
      }
      if (result.spot_total_net === null &&
          result.spot_dealer_net !== null && result.spot_trust_net !== null && result.spot_foreign_net !== null) {
        result.spot_total_net = parseFloat((result.spot_dealer_net + result.spot_trust_net + result.spot_foreign_net).toFixed(2));
      }
    };

    let spotOK = false;

    // 嘗試 MI_INST
    if (!spotOK) {
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_INST',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) });
        const t = await r.text();
        if (!t.includes('<!') && !t.includes('<html')) {
          const raw = JSON.parse(t);
          if (raw.length > 0) {
            console.log(`  🔍 MI_INST 欄位：${Object.keys(raw[0]).join(', ')}`);
            parseSpot(raw, { typeKey: '買賣別', buyKey: '買進金額', sellKey: '賣出金額', netKey: '買賣超額' });
            spotOK = true;
            console.log(`  ✅ 現貨（MI_INST）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億，自營 ${result.spot_dealer_net?.toFixed(2)} 億`);
          }
        }
      } catch(e) { console.log(`  ℹ️  MI_INST 失敗（${e.message}）`); }
    }

    // 嘗試 BFIA01
    if (!spotOK) {
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BFIA01',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) });
        const t = await r.text();
        if (!t.includes('<!') && !t.includes('<html')) {
          const raw = JSON.parse(t);
          if (raw.length > 0) {
            console.log(`  🔍 BFIA01 欄位：${Object.keys(raw[0]).join(', ')}`);
            parseSpot(raw, { typeKey: '買賣別', buyKey: '買進金額', sellKey: '賣出金額', netKey: '買賣超額' });
            spotOK = true;
            console.log(`  ✅ 現貨（BFIA01）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億，自營 ${result.spot_dealer_net?.toFixed(2)} 億`);
          }
        }
      } catch(e) { console.log(`  ℹ️  BFIA01 失敗（${e.message}）`); }
    }

    // 嘗試 FinMind（需要 FM_TOKEN，MODE=finmind 或 all 時才有）
    if (!spotOK && FM_TOKEN) {
      try {
        const data = await fmFetch('TaiwanStockTotalInstitutionalInvestors', { start_date: daysAgo(3) });
        if (data.length > 0) {
          console.log(`  🔍 FinMind 欄位：${Object.keys(data[0]).join(', ')}`);
          // FinMind 欄位：date, name, buy, sell（單位：千元）
          const latest = data.sort((a,b) => b.date.localeCompare(a.date))[0].date.slice(0,10);
          for (const r of data.filter(r => r.date?.slice(0,10) === latest)) {
            const name = (r.name || '').trim();
            // FinMind buy/sell 單位是 100,000 元（十萬元），除以 1,000 = 億元
            // 驗算：外資 4,075,982.84 ÷ 1,000 = 4,075.98 億（官網 407,598,284,294 元 = 4,075.98 億）✅
            const buyRaw  = parseFloat(String(r.buy  ?? 0).replace(/,/g, ''));
            const sellRaw = parseFloat(String(r.sell ?? 0).replace(/,/g, ''));
            if (isNaN(buyRaw) || isNaN(sellRaw)) continue;
            const buy  = parseFloat((buyRaw  / 1_000).toFixed(2));
            const sell = parseFloat((sellRaw / 1_000).toFixed(2));
            const net  = parseFloat((buy - sell).toFixed(2));
            console.log(`    ${name}：買${buy.toFixed(2)} 賣${sell.toFixed(2)} 超${net.toFixed(2)} 億`);
            // FinMind name 值（英文，從 log 確認）：
            // Dealer_self=自營商(自行買賣), Investment_Trust=投信, Foreign_Investor=外資及陸資(不含外資自營商)
            if (name === 'Dealer_self') {
              result.spot_dealer_buy = buy; result.spot_dealer_sell = sell; result.spot_dealer_net = net;
            } else if (name === 'Investment_Trust') {
              result.spot_trust_buy  = buy; result.spot_trust_sell  = sell; result.spot_trust_net  = net;
            } else if (name === 'Foreign_Investor') {
              result.spot_foreign_buy  = buy;
              result.spot_foreign_sell = sell;
              result.spot_foreign_net  = net;
            }
          }
          if (result.spot_dealer_net !== null && result.spot_trust_net !== null && result.spot_foreign_net !== null)
            result.spot_total_net = parseFloat((result.spot_dealer_net + result.spot_trust_net + result.spot_foreign_net).toFixed(2));
          spotOK = true;
          console.log(`  ✅ 現貨（FinMind ${latest}）：外資 ${result.spot_foreign_net?.toFixed(2)} 億，投信 ${result.spot_trust_net?.toFixed(2)} 億`);
        }
      } catch(e) { console.log(`  ℹ️  FinMind 現貨失敗（${e.message}）`); }
    }

    if (!spotOK) console.warn('  ⚠️  現貨三大法人：所有來源均失敗，欄位保持 null');
  } catch (e) {
    console.error(`  ❌ 現貨三大法人 失敗：${e.message}`);
  }

  // ── 2. TAIFEX 期貨三大法人（TX / MTX / TMF）──
  // 策略：一次取全部資料，記憶體內 filter 各商品（contractCode 參數無效）
  // 真實欄位（log 確認）：Date, ContractCode, Item（身份別）
  //   OpenInterest(Long/Short/Net) = 未平倉多方/空方/淨額口數
  try {
    const dateStr = tradeDate.replace(/-/g, '');
    const toInt   = (v) => { const n = parseInt((String(v||'')).replace(/,/g,'')); return isNaN(n) ? null : n; };

    // 一次取全部期貨商品資料
    const futUrl = `https://openapi.taifex.com.tw/v1/MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate?queryDate=${dateStr}`;
    const futRes = await fetch(futUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) });
    if (!futRes.ok) throw new Error(`HTTP ${futRes.status}`);
    const allFut = await futRes.json();
    if (!Array.isArray(allFut) || !allFut.length) throw new Error('無資料');

    // Debug：印出欄位和所有商品代碼
    console.log(`  🔍 TAIFEX 期貨欄位：${Object.keys(allFut[0]).join(', ')}`);
    // ContractCode 是中文商品名稱（臺股期貨/小型臺指期貨/微型臺指期貨）
    const getCode  = (r) => (r.ContractCode || r.commodity_id || '').trim();
    const getIdent = (r) => (r.Item || r.institutional_traders_name || r['身份別'] || '').trim();
    const allCodes = [...new Set(allFut.map(getCode))];
    console.log(`  📊 商品代碼：${allCodes.slice(0,6).join(', ')}，共 ${allFut.length} 筆`);

    // 印出臺股期貨外資那筆確認欄位
    const txForeignRaw = allFut.find(r => r.ContractCode === '臺股期貨' && getIdent(r).includes('外資'));
    if (txForeignRaw) console.log(`  🔍 臺股期貨外資原始：${JSON.stringify(txForeignRaw)}`);

    const parseFut = (rows, prefix) => {
      let totalNet = 0;
      for (const row of rows) {
        const ident    = getIdent(row);
        const longVol  = toInt(row['OpenInterest(Long)']  || row.open_interest_long_volume  || 0);
        const shortVol = toInt(row['OpenInterest(Short)'] || row.open_interest_short_volume || 0);
        const netVol   = toInt(row['OpenInterest(Net)']   || row.open_interest_net_volume   || null);
        const finalNet = netVol !== null ? netVol : (longVol !== null && shortVol !== null ? longVol - shortVol : null);

        if (ident.includes('自營商') && !ident.includes('避險')) {
          result[`${prefix}_dealer_long`]  = longVol;
          result[`${prefix}_dealer_short`] = shortVol;
          result[`${prefix}_dealer_net`]   = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        } else if (ident.includes('投信')) {
          result[`${prefix}_trust_long`]   = longVol;
          result[`${prefix}_trust_short`]  = shortVol;
          result[`${prefix}_trust_net`]    = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        } else if (ident.includes('外資') && !ident.includes('自營商')) {
          result[`${prefix}_foreign_long`]  = longVol;
          result[`${prefix}_foreign_short`] = shortVol;
          result[`${prefix}_foreign_net`]   = finalNet;
          if (finalNet !== null) totalNet += finalNet;
        }
      }
      if (result[`${prefix}_dealer_net`] !== null || result[`${prefix}_trust_net`] !== null || result[`${prefix}_foreign_net`] !== null)
        result[`${prefix}_total_net`] = totalNet;
    };

    // TX 台指期
    // ContractCode 是中文名稱，用中文過濾
    const txRows  = allFut.filter(r => r.ContractCode === '臺股期貨');
    const mtxRows = allFut.filter(r => r.ContractCode === '小型臺指期貨');
    const tmfRows = allFut.filter(r => r.ContractCode === '微型臺指期貨');

    // TX 台指期（臺股期貨）
    if (txRows.length) {
      parseFut(txRows, 'fut_tx');
      console.log(`  ✅ TX（臺股期貨）：外資 多${result.fut_tx_foreign_long}/空${result.fut_tx_foreign_short}/淨${result.fut_tx_foreign_net} 口，投信淨${result.fut_tx_trust_net}，自營淨${result.fut_tx_dealer_net}`);
    } else console.warn('  ⚠️  TX（臺股期貨）無資料');

    // MTX 小型台指
    if (mtxRows.length) {
      parseFut(mtxRows, 'fut_mtx');
      console.log(`  ✅ MTX（小型臺指期貨）：外資淨 ${result.fut_mtx_foreign_net} 口，投信淨 ${result.fut_mtx_trust_net}，自營淨 ${result.fut_mtx_dealer_net}`);
    } else console.warn('  ⚠️  MTX（小型臺指期貨）無資料');

    // TMF 微型台指
    if (tmfRows.length) {
      parseFut(tmfRows, 'fut_tmf');
      console.log(`  ✅ TMF（微型臺指期貨）：外資淨 ${result.fut_tmf_foreign_net} 口，投信淨 ${result.fut_tmf_trust_net}，自營淨 ${result.fut_tmf_dealer_net}`);
    } else console.warn('  ⚠️  TMF（微型臺指期貨）無資料');

  } catch (e) {
    console.error(`  ❌ TAIFEX 期貨法人 失敗：${e.message}`);
  }

  // ── 3. TAIFEX 選擇權三大法人（TXO CALL / PUT）──
  // 使用 FinMind TaiwanOptionInstitutionalInvestors（有 call_put 欄位）
  // TAIFEX OpenAPI 的選擇權 endpoint 不提供 CALL/PUT 分開資料
  try {
    if (!FM_TOKEN) throw new Error('FINMIND_TOKEN 未設定，選擇權略過');
    const toInt2 = (v) => { const n = parseInt(String(v ?? 0).replace(/,/g,'')); return isNaN(n) ? null : n; };

    const optData = await fmFetch('TaiwanOptionInstitutionalInvestors',
      { data_id: 'TXO', start_date: daysAgo(3), end_date: todayTW() });
    if (!optData.length) throw new Error('FinMind TXO 無資料');

    console.log(`  🔍 FinMind TXO 欄位：${Object.keys(optData[0]).join(', ')}`);

    // 取最近交易日
    const latestOptDate = optData.map(r => r.date?.slice(0,10)).filter(Boolean).sort().reverse()[0];
    const latestOpt = optData.filter(r => r.date?.slice(0,10) === latestOptDate);
    console.log(`  📊 TXO ${latestOptDate}：${latestOpt.length} 筆，樣本：${JSON.stringify(latestOpt[0])}`);

    // FinMind 欄位：call_put（C/P）, institutional_investors（身份別）
    //   long_open_interest_balance_volume, short_open_interest_balance_volume
    const parseOptFM = (rows, prefix) => {
      for (const row of rows) {
        const ident    = (row.institutional_investors || row.name || '').trim();
        // 欄位從 log 確認：long_open_interest_balance_volume / short_open_interest_balance_volume
        const longVol  = toInt2(row.long_open_interest_balance_volume  || 0);
        const shortVol = toInt2(row.short_open_interest_balance_volume || 0);
        const net = longVol - shortVol;
        if (ident.includes('自營商') && !ident.includes('避險')) {
          result[`${prefix}_dealer_long`] = longVol; result[`${prefix}_dealer_short`] = shortVol; result[`${prefix}_dealer_net`] = net;
        } else if (ident.includes('投信')) {
          result[`${prefix}_trust_long`]  = longVol; result[`${prefix}_trust_short`]  = shortVol; result[`${prefix}_trust_net`]  = net;
        } else if (ident.includes('外資') && !ident.includes('自營')) {
          result[`${prefix}_foreign_long`] = longVol; result[`${prefix}_foreign_short`] = shortVol; result[`${prefix}_foreign_net`] = net;
        }
      }
    };

    // FinMind call_put 值（從 log 確認）：'買權' 或 '賣權'（繁體中文）
    // institutional_investors 欄位：'自營商', '投信', '外資及陸資'
    const callRows = latestOpt.filter(r => r.call_put === '買權');
    const putRows  = latestOpt.filter(r => r.call_put === '賣權');

    if (callRows.length) { parseOptFM(callRows, 'opt_call'); console.log(`  ✅ TXO CALL：外資淨 ${result.opt_call_foreign_net} 口，自營淨 ${result.opt_call_dealer_net}`); }
    else console.warn(`  ⚠️  TXO CALL 無資料（CP值：${[...new Set(latestOpt.map(getCP))].join(',')}）`);
    if (putRows.length)  { parseOptFM(putRows, 'opt_put');   console.log(`  ✅ TXO PUT：外資淨 ${result.opt_put_foreign_net} 口，自營淨 ${result.opt_put_dealer_net}`);  }
    else console.warn(`  ⚠️  TXO PUT 無資料`);

  } catch (e) {
    console.warn(`  ⚠️  選擇權（FinMind）失敗：${e.message}，嘗試 TAIFEX OpenAPI...`);
    // Fallback：TAIFEX OpenAPI 選擇權（無 CALL/PUT 分開，只能取整體 OI）
    try {
      const dateStr = tradeDate.replace(/-/g, '');
      const toInt2  = (v) => { const n = parseInt((String(v||'')).replace(/,/g,'')); return isNaN(n) ? null : n; };
      const optUrl  = `https://openapi.taifex.com.tw/v1/MarketDataOfMajorInstitutionalTradersDetailsOfOptionsContractsBytheDate?queryDate=${dateStr}`;
      const optRes  = await fetch(optUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
      const optText = await optRes.text();
      if (optText.includes('<!')) throw new Error('回傳 HTML');
      const allOpt  = JSON.parse(optText);
      const txoRows = (Array.isArray(allOpt) ? allOpt : []).filter(r => r.ContractCode === '臺指選擇權');
      console.log(`  📊 TAIFEX 臺指選擇權：${txoRows.length} 筆，Item 樣本：${[...new Set(txoRows.map(r=>r.Item||''))].join(', ')}`);
      // TAIFEX 選擇權 3 筆無 CALL/PUT 分開，印出整體 OI 供參考
      for (const row of txoRows) {
        const ident = (row.Item || '').trim();
        const loI   = toInt2(row['OpenInterest(Long)'] || 0);
        const soI   = toInt2(row['OpenInterest(Short)'] || 0);
        console.log(`    ${ident}：多OI ${loI} / 空OI ${soI} / 淨 ${loI-soI}`);
      }
      console.log('  ℹ️  TAIFEX 選擇權無 CALL/PUT 分開，需 FinMind token 才能取得完整資料');
    } catch(e2) { console.error(`  ❌ TAIFEX 選擇權 fallback 失敗：${e2.message}`); }
  }

    // ── 4. 寫入 chips_daily ──
  try {
    await sbUpsert('chips_daily', [result], 'date');
    return { ok: true, date: tradeDate };
  } catch (e) {
    console.error(`  ❌ chips_daily 寫入失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// 新聞收集任務
// ══════════════════════════════════════════

function parseRSS(xml, source, lang = 'en') {
  const items = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of itemMatches.slice(0, 30)) {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title')
      .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&#[^;]+;/g, '').replace(/<[^>]+>/g, '').trim();
    const link = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    const desc = get('description').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#[^;]+;/g, '').trim().slice(0, 300);
    const pubDate = get('pubDate');
    if (!title || title.length < 5 || !link) continue;
    const pub = pubDate ? new Date(pubDate) : new Date();
    if (isNaN(pub.getTime())) continue;
    items.push({ title, url: link.trim(), description: desc, source, lang, publishedAt: pub.toISOString() });
  }
  return items;
}

async function collectNews() {
  console.log('📰 財經新聞收集（RSS）...');
  try {
    const cutoff = new Date(Date.now() - 48 * 3600_000);

    const RSS_FEEDS = [
      { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',  source: 'CNBC',         lang: 'en' },
      { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',   source: 'CNBC',         lang: 'en' },
      { url: 'https://feeds.bloomberg.com/markets/news.rss',                                          source: 'Bloomberg',    lang: 'en' },
      { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',                           source: 'MarketWatch',  lang: 'en' },
      { url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',                          source: 'MarketWatch',  lang: 'en' },
      { url: 'https://www.ft.com/?format=rss',                                                        source: 'FT',           lang: 'en' },
      { url: 'https://news.google.com/rss/search?q=台股+OR+台積電+OR+外資+OR+加權指數&hl=zh-TW&gl=TW&ceid=TW:zh-Hant', source: 'Google News TW', lang: 'zh' },
      { url: 'https://money.udn.com/rssfeed/news/1001/5590/index.xml',                               source: '經濟日報',     lang: 'zh' },
      { url: 'https://news.google.com/rss/search?q=工商時報+台股&hl=zh-TW&gl=TW&ceid=TW:zh-Hant',    source: '工商時報',     lang: 'zh' },
      { url: 'https://www.cnyes.com/rss/cat/tw_stock',                                               source: '鉅亨網',       lang: 'zh' },
    ];

    const CUSTOM_HEADERS = {
      '鉅亨網': { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': 'https://www.cnyes.com/' },
    };

    const fetchResults = await Promise.all(RSS_FEEDS.map(async ({ url, source, lang }) => {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            ...(CUSTOM_HEADERS[source] || {}),
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) { console.log(`  ⚠️  ${source} HTTP ${r.status}`); return []; }
        const xml = await r.text();
        return parseRSS(xml, source, lang);
      } catch (e) { console.log(`  ⚠️  ${source} 失敗：${e.message}`); return []; }
    }));

    const seen = new Set();
    const articles = fetchResults.flat().filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      if (new Date(a.publishedAt) < cutoff) return false;
      const low = (a.title + ' ' + (a.description || '')).toLowerCase();
      const blacklist = ['czech', 'czechia', 'prague', 'koruna', 'philippines', 'philippine', 'manila', 'bangko sentral',
        'safaricom', 'nairobi', 'kenya', 'nigeria', 'lagos', 'johannesburg', 'south africa', 'ghana'];
      if (blacklist.some(w => low.includes(w))) return false;
      if (/^[A-Za-z\s&]+\d{1,2}\/\d{1,2}\/\d{4}$/.test(a.title.trim())) return false;
      return true;
    });

    console.log(`  📊 合計 ${articles.length} 篇（去重後）`);
    if (!articles.length) return { ok: true, count: 0 };

    const rows = articles.map(a => ({
      url:          a.url,
      title:        a.title,
      title_zh:     null,
      description:  a.description || null,
      source:       a.source,
      lang:         a.lang,
      published_at: a.publishedAt,
      collected_at: new Date().toISOString(),
    }));

    await sbUpsert('news_daily', rows, 'url');

    const deleteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/news_daily?collected_at=lt.${new Date(Date.now() - 48 * 3_600_000).toISOString()}`,
      { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (deleteRes.ok) console.log('  🗑️  已清理 48 小時前舊新聞');
    else console.warn(`  ⚠️  清理失敗 HTTP ${deleteRes.status}`);

    return { ok: true, count: articles.length };
  } catch (e) { console.error(`  ❌ 新聞收集 失敗：${e.message}`); return { ok: false, error: e.message }; }
}

// ══════════════════════════════════════════
// Alpha 自動停損停利檢查
// ══════════════════════════════════════════
async function checkAlphaStopLossTarget() {
  console.log('🔍 Alpha 停損停利檢查...');
  try {
    const posRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.open&select=id,stock_id,stock_name,entry_price,target_price,stop_loss,shares,opened_at`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const positions = await posRes.json();
    if (!Array.isArray(positions) || positions.length === 0) {
      console.log('  ℹ️  目前無開倉持倉');
      return { ok: true, closed: 0 };
    }

    const dateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?order=date.desc&limit=1&select=date`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const dateJson = await dateRes.json();
    const latestDate = Array.isArray(dateJson) && dateJson[0]?.date ? dateJson[0].date : null;
    if (!latestDate) { console.log('  ⚠️  無法取得最新收盤日'); return { ok: true, closed: 0 }; }

    const stockIds = [...new Set(positions.map(p => p.stock_id))];
    const priceRes = await fetch(
      `${SUPABASE_URL}/rest/v1/stock_daily_twse?date=eq.${latestDate}&stock_id=in.(${stockIds.join(',')})&select=stock_id,close`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const priceRows = await priceRes.json();
    const priceMap = {};
    if (Array.isArray(priceRows)) for (const r of priceRows) priceMap[r.stock_id] = r.close;

    let closedCount = 0;
    for (const pos of positions) {
      const close = priceMap[pos.stock_id];
      if (!close || close <= 0) {
        console.log(`  ⚠️  ${pos.stock_id} 無收盤價資料（${latestDate}），跳過`);
        continue;
      }

      let exitReason = null;
      let exitPrice  = close;
      let exitType   = null;

      if (close >= pos.target_price) {
        exitType   = 'target';
        exitReason = `停利出場（收盤 ${close} ≥ 目標 ${pos.target_price}，漲幅 +${((close-pos.entry_price)/pos.entry_price*100).toFixed(2)}%）`;
      } else if (close <= pos.stop_loss) {
        exitType   = 'stop';
        exitReason = `停損出場（收盤 ${close} ≤ 停損 ${pos.stop_loss}，跌幅 ${((close-pos.entry_price)/pos.entry_price*100).toFixed(2)}%）`;
      }

      if (!exitReason) continue;

      const pnl     = parseFloat(((exitPrice - pos.entry_price) * (pos.shares || 1) * 1000).toFixed(0));
      const pnl_pct = parseFloat(((exitPrice - pos.entry_price) / pos.entry_price * 100).toFixed(2));
      const openedDate = pos.opened_at ? pos.opened_at.slice(0, 10) : null;
      const daysHeld   = openedDate && latestDate
        ? Math.max(0, Math.round((new Date(latestDate) - new Date(openedDate)) / 86400000))
        : '-';

      const fullReason = [pos.reason, exitReason].filter(Boolean).join('｜');
      const closeRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions?id=eq.${pos.id}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed', exit_price: exitPrice, pnl, pnl_pct,
          closed_at: new Date().toISOString(), reason: fullReason,
        }),
      });

      if (closeRes.ok) {
        const emoji = exitType === 'target' ? '🎯' : '🔴';
        console.log(`  ${emoji} [${exitType.toUpperCase()}] ${pos.stock_id} ${pos.stock_name} ${exitReason}`);
        console.log(`     損益：${pnl >= 0 ? '+' : ''}${pnl} 元（${pnl_pct >= 0 ? '+' : ''}${pnl_pct}%）  持有 ${daysHeld} 天`);
        closedCount++;
      } else {
        const errText = await closeRes.text().catch(() => '');
        console.warn(`  ⚠️  ${pos.stock_id} 平倉更新失敗 HTTP ${closeRes.status}：${errText.slice(0,100)}`);
      }
    }

    if (closedCount === 0) console.log(`  ✅ 所有持倉未觸及停損停利（收盤日：${latestDate}）`);
    else console.log(`  📊 共自動平倉 ${closedCount} 筆`);

    return { ok: true, closed: closedCount };
  } catch(e) {
    console.error(`  ❌ 停損停利檢查失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// Alpha 每日報告生成
// ══════════════════════════════════════════
async function collectAlphaReport() {
  console.log('🤖 Alpha 每日報告生成...');
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) { console.warn('  ⚠️  GROQ_API_KEY 未設定'); return { ok: false, error: 'no groq key' }; }

  try {
    // ⚠️ 使用台灣時間（UTC+8），避免 UTC 22:xx 跑時寫入前一天日期
    const today = todayTW();

    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/alpha_daily_report?report_date=eq.${today}&select=id`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`  ℹ️  今日報告已存在（${today}），跳過`);
      return { ok: true, skipped: true };
    }

    // ── 1. 抓最新日期股價 ──
    const dateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?order=date.desc&limit=1&select=date`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const dateJson = await dateRes.json();
    const latestDate = Array.isArray(dateJson) && dateJson[0]?.date ? dateJson[0].date : null;

    let stocks = [], valuation = [];
    if (latestDate) {
      const [sRes, vRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/stock_daily_twse?date=eq.${latestDate}&order=volume.desc&limit=100&select=stock_id,name,close,prev,chg_pct,volume`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }).then(r => r.json()).catch(() => []),
        fetch(`${SUPABASE_URL}/rest/v1/stock_valuation_daily?order=dividend_yield.desc&limit=100&select=stock_id,pe_ratio,pb_ratio,dividend_yield`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }).then(r => r.json()).catch(() => []),
      ]);
      stocks    = Array.isArray(sRes) ? sRes : [];
      valuation = Array.isArray(vRes) ? vRes : [];
    }

    // ── 2. 抓最新新聞 ──
    const newsRes = await fetch(`${SUPABASE_URL}/rest/v1/news_daily?order=published_at.desc&limit=40&select=title,source,lang`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const news = await newsRes.json().catch(() => []);

    // ── 3. 抓 PTT（JSON API，比 HTML 解析更穩定）──
    let pttTitles = '';
    try {
      const pttRes = await fetch('https://www.ptt.cc/api/board/Stock/index', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
        signal: AbortSignal.timeout(8000),
      });
      if (!pttRes.ok) throw new Error(`PTT JSON API HTTP ${pttRes.status}`);
      const pttJson = await pttRes.json();
      const posts = pttJson?.posts || pttJson?.items || [];
      const items = [];
      for (const post of posts.slice(0, 20)) {
        const title = (post.title || post.subject || '').trim();
        if (!title || ['[公告]', '[板規]', 'Fw:'].some(p => title.startsWith(p))) continue;
        const pushes = typeof post.num_comments === 'number' ? post.num_comments
                     : typeof post.recommend    === 'number' ? post.recommend : 0;
        items.push(`【${pushes >= 0 ? '+' : ''}${pushes}推】${title}`);
      }
      pttTitles = items.length ? items.join('\n') : '無熱門討論';
    } catch (e) {
      // JSON API 失敗時 fallback 到 HTML 解析
      console.warn(`  ⚠️  PTT JSON API 失敗（${e.message}），fallback 到 HTML 解析`);
      try {
        const pttRes = await fetch('https://www.ptt.cc/bbs/Stock/index.html', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
          signal: AbortSignal.timeout(8000),
        });
        const html = await pttRes.text();
        const blocks = html.split('<div class="r-ent">').slice(1, 16);
        const items = [];
        for (const blk of blocks) {
          const linkM = blk.match(/href="(\/bbs\/Stock\/M\.[^"]+)"/i);
          const titM  = blk.match(/<a[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/i);
          if (!linkM || !titM) continue;
          const title = titM[1].trim();
          if (['[公告]', '[板規]', 'Fw:'].some(p => title.startsWith(p))) continue;
          const nrecM = blk.match(/<span[^>]*>(爆|\d+|X+)<\/span>/i);
          const nrecRaw = (nrecM?.[1] || '').trim();
          const pushes = nrecRaw === '爆' ? 99 : /^X+$/i.test(nrecRaw) ? -nrecRaw.length * 10 : parseInt(nrecRaw) || 0;
          items.push(`【${pushes >= 0 ? '+' : ''}${pushes}推】${title}`);
        }
        pttTitles = items.join('\n') || '無熱門討論';
      } catch { pttTitles = '無法取得'; }
    }

    // ── 4. 整理資料 ──
    const valMap = {};
    for (const v of valuation) valMap[v.stock_id] = v;

    const stockTable = stocks.slice(0, 50).map(s => {
      const v = valMap[s.stock_id] || {};
      return `${s.stock_id} ${s.name} 收${s.close} 漲跌${s.chg_pct != null ? (s.chg_pct*100).toFixed(2) : 'N/A'}% 量${s.volume} PE${v.pe_ratio ?? '-'} PB${v.pb_ratio ?? '-'} 殖${v.dividend_yield ?? '-'}%`;
    }).join('\n');

    const newsTitles = (Array.isArray(news) ? news : []).slice(0, 30)
      .map(n => `[${n.source}] ${n.title}`).join('\n');

    // ── 5. 呼叫 Groq ──
    const systemPrompt = `你是 Alpha，一位經驗豐富的台股交易員。
今天是 ${today}，台股將於 09:00 開盤。
你的分析風格：冷靜、數據導向、不隨波逐流。
根據：技術面（量價）、基本面（PE/PB/殖利率）、市場情緒、新聞催化劑，綜合判斷操作方向。
依市場狀況自行決定操作風格（短線波段 3-10 天 / 中線趨勢 1-4 週 / 價值布局）。

【價格規則 — 嚴格遵守】
- entry_price 必須在收盤價的 ±5% 範圍內
- target_price 必須在 entry_price 的 +3% ~ +20% 範圍內
- stop_loss 必須在 entry_price 的 -3% ~ -10% 範圍內
- 禁止使用訓練資料的歷史股價，只能用表格提供的收盤價

只能回傳純 JSON 物件，不含 markdown、不含任何說明文字。所有字串值必須用英文半形雙引號，數字不加引號。
格式：{"market_summary":"...","market_mood":"樂觀或中性或謹慎或悲觀","recommendations":[{"stock_id":"4碼","stock_name":"名稱","style":"短線或中線或價值","action":"買進或觀察或避開","entry_price":數字,"target_price":數字,"stop_loss":數字,"expected_return_pct":數字,"holding_days":數字,"confidence":"高或中或低","reason":"操作理由","risk":"風險"}],"alpha_note":"一句話警語"}
recommendations 包含 3-5 檔，action=買進 至少 2 檔。`;

    const userPrompt = `【今日日期】${today}（09:00 開盤）

【台股最新收盤（${latestDate}）前50大成交量】
${stockTable}

【近期財經新聞】
${newsTitles}

【PTT Stock 板熱門】
${pttTitles}

請給出今日開盤操作建議。`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!groqRes.ok) throw new Error(`Groq HTTP ${groqRes.status}`);
    const groqData = await groqRes.json();
    let raw = groqData.choices?.[0]?.message?.content || '';
    raw = raw
      .replace(/```json|```/g, '')
      .replace(/"|"|'|'/g, '"')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    if (si === -1 || ei === -1) throw new Error(`Groq 未回傳 JSON，原始內容：${raw.slice(0,200)}`);
    let jsonStr = raw.slice(si, ei + 1);
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch(parseErr) {
      console.error('  JSON 解析失敗，原始內容：', jsonStr.slice(0, 500));
      throw new Error(`JSON 解析失敗：${parseErr.message}`);
    }

    // ── 6. 校正價格 ──
    const priceMap = {};
    for (const s of stocks) priceMap[s.stock_id] = s.close;
    for (const rec of (result.recommendations || [])) {
      const realClose = priceMap[rec.stock_id];
      if (!realClose || realClose <= 0) continue;
      if (!rec.entry_price || Math.abs(rec.entry_price - realClose) / realClose > 0.20) {
        rec.entry_price  = parseFloat((realClose * 1.00).toFixed(1));
        rec.target_price = parseFloat((realClose * 1.08).toFixed(1));
        rec.stop_loss    = parseFloat((realClose * 0.94).toFixed(1));
        rec.price_corrected = true;
      } else {
        if (!rec.target_price || rec.target_price <= rec.entry_price)
          rec.target_price = parseFloat((rec.entry_price * 1.08).toFixed(1));
        if (!rec.stop_loss || rec.stop_loss >= rec.entry_price)
          rec.stop_loss = parseFloat((rec.entry_price * 0.94).toFixed(1));
      }
    }

    // ── 7. 存入 Supabase alpha_daily_report ──
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/alpha_daily_report`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        report_date:    today,
        market_mood:    result.market_mood || '中性',
        market_summary: result.market_summary || '',
        alpha_note:     result.alpha_note || '',
        recommendations: result.recommendations || [],
        data_sources:   { stocks: stocks.length, news: Array.isArray(news) ? news.length : 0, ptt: (pttTitles && pttTitles !== '無法取得') ? pttTitles.split('\n').filter(l => l.trim()).length : 0 },
        generated_at:   new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) throw new Error(`Supabase upsert HTTP ${upsertRes.status}`);

    // ── 7.5 清理 180 天前的舊報告（節省 Supabase 空間）──
    try {
      const cutoffDate = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
      const delRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alpha_daily_report?report_date=lt.${cutoffDate}`,
        { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' } }
      );
      if (delRes.ok) console.log(`  🗑️  已清理 ${cutoffDate} 前的舊 Alpha 報告`);
    } catch { /* 清理失敗不中斷主流程 */ }

    // ── 8. 自動建立買進持倉（重複建倉防護 + 當日平倉防護）──
    const buyRecs = (result.recommendations || []).filter(r => r.action === '買進');
    if (buyRecs.length > 0) {
      const todayStr = today;

      const [existRes, todayClosedRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.open&select=stock_id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/trader_positions?status=eq.closed&closed_at=gte.${todayStr}T00:00:00&select=stock_id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        }),
      ]);
      const existRows       = await existRes.json().catch(() => []);
      const todayClosedRows = await todayClosedRes.json().catch(() => []);

      const existIds       = new Set(Array.isArray(existRows)       ? existRows.map(r => r.stock_id)       : []);
      const todayClosedIds = new Set(Array.isArray(todayClosedRows) ? todayClosedRows.map(r => r.stock_id) : []);

      const newRecs = buyRecs.filter(r => {
        if (existIds.has(r.stock_id)) {
          console.log(`  ⏭️  ${r.stock_id} 已有開倉持倉，跳過重複建倉`);
          return false;
        }
        if (todayClosedIds.has(r.stock_id)) {
          console.log(`  🚫  ${r.stock_id} 今日已停損/停利出場，當天不再重新進場`);
          return false;
        }
        return true;
      });

      if (newRecs.length > 0) {
        const openedAt = new Date().toISOString();
        const positions = newRecs.map(r => ({
          stock_id:     r.stock_id,
          stock_name:   r.stock_name,
          entry_price:  r.entry_price,
          target_price: r.target_price,
          stop_loss:    r.stop_loss,
          shares:       1,
          style:        r.style,
          reason:       r.reason,
          status:       'open',
          opened_at:    openedAt,
        }));
        const posRes = await fetch(`${SUPABASE_URL}/rest/v1/trader_positions`, {
          method: 'POST',
          headers: {
            apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify(positions),
        });
        if (posRes.ok) {
          console.log(`  📈 Alpha 自動進場：${newRecs.map(r => r.stock_id).join('、')}（${newRecs.length} 檔）`);
        } else {
          const errText = await posRes.text().catch(() => '');
          console.warn(`  ⚠️  持倉建立失敗 HTTP ${posRes.status}：${errText.slice(0,100)}`);
        }
      } else {
        console.log(`  ℹ️  所有買進推薦均已有開倉，本次不新增持倉`);
      }
    }

    console.log(`  ✅ Alpha 報告已生成並儲存（${today}，${result.recommendations?.length || 0} 檔推薦，${buyRecs.length} 檔進場）`);
    return { ok: true, date: today, count: result.recommendations?.length || 0, bought: buyRecs.length };

  } catch (e) {
    console.error(`  ❌ Alpha 報告生成失敗：${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════
// 主程式
// ══════════════════════════════════════════
async function main() {
  const isTWSE    = MODE === 'twse'    || MODE === 'all';
  const isFinMind = MODE === 'finmind' || MODE === 'all';
  const isNews    = MODE === 'news'    || MODE === 'all';
  const isAlpha   = MODE === 'alpha'   || MODE === 'all';
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
    results.chips       = await collectChips();
  }
  if (isNews) {
    console.log('\n── 新聞收集 ──');
    results.news        = await collectNews();
  }
  if (isAlpha) {
    console.log('\n── Alpha 停損停利檢查 ──');
    results.alphaCheck  = await checkAlphaStopLossTarget();
    console.log('\n── Alpha 報告生成 ──');
    results.alpha       = await collectAlphaReport();
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
