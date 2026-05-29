// ══════════════════════════════════════════════════════════════
// ① 今日總結橫幅
// ══════════════════════════════════════════════════════════════
async function loadDailySummary() {
  const banner = document.getElementById('dailySummaryBanner');
  banner.style.display = 'block';

  try {
    // 並行抓 Alpha 報告 + 大盤最新資料
    const [alphaRes, twseRes, vixRes] = await Promise.allSettled([
      fetch(`${API_BASE}?endpoint=alpha_report`).then(r => r.json()),
      sbFetch('stock_daily_twse', 'stock_id=eq.Y9999&order=date.desc&limit=1&select=date,close,chg_pct'),
      sbFetch('options_daily', 'order=date.desc&limit=1&select=date'),
    ]);

    // Alpha 情緒
    const alpha = alphaRes.status === 'fulfilled' ? alphaRes.value : null;
    const mood  = alpha?.market_mood || '中性';
    const MOOD_CLR = { '樂觀': ['rgba(220,38,38,0.12)','#dc2626'], '中性': ['rgba(148,163,184,0.12)','var(--muted)'], '謹慎': ['rgba(251,191,36,0.12)','#d97706'], '悲觀': ['rgba(22,163,74,0.12)','#16a34a'] };
    const [mbg, mc] = MOOD_CLR[mood] || MOOD_CLR['中性'];
    const pill = document.getElementById('dsbMoodPill');
    pill.textContent = mood; pill.style.background = mbg; pill.style.color = mc;
    pill.style.border = `1px solid ${mc}`;

    // 大盤 + VIX：直接呼叫 futures API
    const twseEl = document.getElementById('dsbTWSE');
    const vixEl  = document.getElementById('dsbVIX');
    try {
      // 每次都重新抓，確保資料最新
      const fRes  = await fetch(API_BASE + '?endpoint=futures');
      const fJson = await fRes.json();
      const fData = fJson.data || [];

      // VIX：symbol='^VIX'，name='VIX波動率'
      const vix = fData.find(d =>
        (d.symbol && d.symbol.toUpperCase().includes('VIX')) ||
        (d.name && d.name.includes('VIX'))
      );
      if (vix) {
        const pct = ((vix.chgPct || 0) * 100).toFixed(2);
        const clr = (vix.chgPct || 0) >= 0 ? '#dc2626' : '#16a34a';
        vixEl.innerHTML = `<span style="color:${clr}">${(vix.price||0).toFixed(2)}<span style="font-size:0.75em;margin-left:0.3em">${pct >= 0 ? '+' : ''}${pct}%</span></span>`;
      } else {
        vixEl.textContent = '—';
      }

      // 台灣加權：從 stock_daily_twse 抓 TAIEX（由 collectSectorIndex 每日寫入）
      // fallback：0050
      let twseShown = false;
      for (const stockId of ['TAIEX', '0050']) {
        try {
          const rows = await sbFetch('stock_daily_twse',
            `stock_id=eq.${stockId}&order=date.desc&limit=1&select=stock_id,name,close,chg_pct`);
          const r = Array.isArray(rows) && rows[0];
          if (r && r.close) {
            const pct = ((r.chg_pct || 0) * 100).toFixed(2);
            const clr = (r.chg_pct || 0) >= 0 ? '#dc2626' : '#16a34a';
            const isFallback = stockId === '0050';
            twseEl.innerHTML = `<span style="color:${clr}">${r.close.toLocaleString('en', {maximumFractionDigits: 2})}<span style="font-size:0.75em;margin-left:0.3em">${pct >= 0 ? '+' : ''}${pct}%</span></span>${isFallback ? '<span style="font-size:0.6em;color:var(--muted);margin-left:0.3em">(0050)</span>' : ''}`;
            twseShown = true;
            break;
          }
        } catch { continue; }
      }
      if (!twseShown) twseEl.textContent = '—';
    } catch(e) {
      twseEl.textContent = '—';
      vixEl.textContent  = '—';
    }
    // Alpha 建議
    const recs = alpha?.recommendations || [];
    const buys = recs.filter(r => r.action === '買進').length;
    const avoids = recs.filter(r => r.action === '避開').length;
    const alphaEl = document.getElementById('dsbAlpha');
    alphaEl.innerHTML = buys > 0
      ? `<span style="color:#dc2626">${buys}買進</span> <span style="color:var(--muted);font-size:0.7rem">/ ${avoids}避開</span>`
      : `<span style="color:var(--muted)">—</span>`;

    // VIX：從 futuresData 取
    try {
      let vixItem = (window.futuresData || []).find(d => d.symbol && d.symbol.toLowerCase().includes('vix'));
      if (!vixItem && window._dsbFutJson) {
        vixItem = (window._dsbFutJson.data || []).find(d => d.symbol && d.symbol.toLowerCase().includes('vix'));
      }
      const vixEl = document.getElementById('dsbVIX');
      if (vixItem) {
        const clr = vixItem.chgPct >= 0 ? '#dc2626' : '#16a34a';
        const pct = (vixItem.chgPct * 100).toFixed(2);
        vixEl.innerHTML = `<span style="color:${clr}">${vixItem.price?.toFixed(2) ?? '—'} <span style="font-size:0.75em">${pct >= 0 ? '+' : ''}${pct}%</span></span>`;
      } else {
        vixEl.textContent = '見全球商品';
      }
    } catch { document.getElementById('dsbVIX').textContent = '—'; }

    // 日期
    document.getElementById('dsbDate').textContent = alpha?.report_date
      ? alpha.report_date + ' 報告'
      : new Date().toLocaleDateString('zh-TW');

    // 一句話重點
    const note = document.getElementById('dsbNote');
    if (alpha?.market_summary) {
      const short = alpha.market_summary.slice(0, 80) + (alpha.market_summary.length > 80 ? '…' : '');
      note.textContent = `📌 ${short}`;
    } else {
      note.textContent = '今日 Alpha 報告尚未生成，請稍後再查看。';
    }

    // 法人籌碼警示
    await loadInstAlert();
  } catch(e) {
    console.warn('loadDailySummary error:', e);
  }
}

async function refreshDailySummary() {
  document.getElementById('dsbNote').textContent = '更新中…';
  await loadDailySummary();
}

// ══════════════════════════════════════════════════════════════
// ② 法人籌碼異動警示
// ══════════════════════════════════════════════════════════════
async function loadInstAlert() {
  try {
    const bar = document.getElementById('instAlertBar');
    // 從 chips_daily 讀取（億元單位，資料正確）
    const rows = await sbFetch('chips_daily', 'order=date.desc&limit=1&select=date,spot_foreign_net,spot_trust_net,spot_dealer_net,spot_total_net');
    if (!Array.isArray(rows) || !rows[0]) return;
    const d = rows[0];
    const foreignNet = (d.spot_foreign_net || 0) * 1e8; // 億→元（供門檻比較）
    const trustNet   = (d.spot_trust_net   || 0) * 1e8;
    const total      = (d.spot_total_net   || 0) * 1e8;
    const threshold = 3000000000; // 30億門檻
    const alerts = [];
    const fmt = v => v >= 0 ? `+${(v/1e8).toFixed(1)}億` : `${(v/1e8).toFixed(1)}億`;
    const clr = v => v >= 0 ? '#dc2626' : '#16a34a';

    if (Math.abs(foreignNet) >= threshold)
      alerts.push({ emoji: '🏦', label: '外資', val: fmt(foreignNet), color: clr(foreignNet) });
    if (Math.abs(trustNet) >= threshold)
      alerts.push({ emoji: '🏢', label: '投信', val: fmt(trustNet), color: clr(trustNet) });
    if (Math.abs(total) >= threshold * 2)
      alerts.push({ emoji: '📊', label: '三大法人合計', val: fmt(total), color: clr(total) });

    if (!alerts.length) return;
    bar.style.display = 'block';
    bar.innerHTML = alerts.map(a => `
      <div class="inst-alert-item" style="background:var(--surface);">
        <span>${a.emoji}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--muted);">今日${a.label}異動</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem;font-weight:700;color:${a.color};">${a.val}</span>
        <span style="font-size:0.65rem;color:var(--muted);margin-left:auto;">${d.date}</span>
      </div>`).join('');
  } catch(e) { /* 靜默失敗 */ }
}

// ══════════════════════════════════════════════════════════════
// ③ 自選股 Watchlist（localStorage）
// ══════════════════════════════════════════════════════════════
function wlLoad() { try { return JSON.parse(localStorage.getItem('as_watchlist') || '[]'); } catch { return []; } }
function wlSave(list) { localStorage.setItem('as_watchlist', JSON.stringify(list)); }

function openWatchlistPanel() {
  const p = document.getElementById('watchlistPanel');
  p.style.display = p.style.display === 'none' || !p.style.display ? 'block' : 'none';
  if (p.style.display === 'block') wlRender();
}

async function wlRender() {
  const list = wlLoad();
  const el = document.getElementById('wlList');
  if (!list.length) {
    el.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.72rem;color:var(--muted);padding:0.5rem 0;">尚未加入自選股</div>';
    return;
  }

  el.innerHTML = `
    <div class="wl-item" style="font-size:0.58rem;color:var(--muted);border-bottom:1px solid var(--border);">
      <span>代號</span><span>名稱</span><span>收盤</span><span>漲跌</span><span>5日走勢</span><span></span>
    </div>`;

  try {
    // 取最新 5 個交易日日期
    const dateRes = await sbFetch('stock_daily_twse', 'order=date.desc&limit=5&select=date&stock_id=eq.TAIEX');
    const dates = (dateRes || []).map(r => r.date);
    const latestDate = dates[0];
    if (!latestDate) return;

    // 一次抓 5 日 × 所有自選股資料
    const rows = await sbFetch('stock_daily_twse',
      `date=in.(${dates.join(',')})&stock_id=in.(${list.join(',')})&select=stock_id,name,close,chg_pct,date&order=stock_id.asc,date.asc`);

    // 整理成 { stockId: { latest, history:[close...] } }
    const dataMap = {};
    (rows || []).forEach(r => {
      if (!dataMap[r.stock_id]) dataMap[r.stock_id] = { name: r.name, history: [] };
      dataMap[r.stock_id].history.push({ date: r.date, close: r.close, chg_pct: r.chg_pct });
    });

    // 輔助：產生迷你 SVG 折線
    function makeSparkline(history, color) {
      if (!history || history.length < 2) {
        return `<svg width="52" height="24" viewBox="0 0 52 24"><line x1="2" y1="12" x2="50" y2="12" stroke="var(--border)" stroke-width="1.5"/></svg>`;
      }
      const prices = history.map(h => h.close);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const range = maxP - minP || 1;
      const W = 52, H = 24, pad = 3;
      const pts = prices.map((p, i) => {
        const x = pad + (i / (prices.length - 1)) * (W - pad * 2);
        const y = H - pad - ((p - minP) / range) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      // 最後一個點座標
      const lastPts = pts.split(' ');
      const [lx, ly] = lastPts[lastPts.length - 1].split(',');
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${lx}" cy="${ly}" r="2.5" fill="${color}"/>
      </svg>`;
    }

    for (const id of list) {
      const d = dataMap[id];
      const latest = d?.history?.find(h => h.date === latestDate) || d?.history?.[d.history.length - 1];
      const clr  = latest ? (latest.chg_pct >= 0 ? '#dc2626' : '#16a34a') : 'var(--muted)';
      const pct  = latest ? `${latest.chg_pct >= 0 ? '+' : ''}${(latest.chg_pct * 100).toFixed(2)}%` : '—';
      const spark = makeSparkline(d?.history, clr);

      const row = document.createElement('div');
      row.className = 'wl-item';
      row.innerHTML = `
        <span style="font-weight:700;cursor:pointer;">${id}</span>
        <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d?.name || '—'}</span>
        <span>${latest?.close ?? '—'}</span>
        <span style="color:${clr};font-weight:600;">${pct}</span>
        <span style="line-height:0;">${spark}</span>
        <button onclick="wlRemove('${id}')" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:0.8rem;padding:0 0.2rem;">✕</button>`;
      row.querySelector('span').addEventListener('click', () => {
        if (latest) openStockModal({ id, name: d.name, price: latest.close, chgPct: latest.chg_pct, prev: latest.close, sector: '', mcap: 0 });
      });
      el.appendChild(row);
    }
  } catch { /* 靜默 */ }
}

async function wlAddStock(id) {
  id = (id || '').trim().toUpperCase();
  if (!id || !/^\d{4,6}$/.test(id)) { alert('請輸入 4–6 位股票代號'); return; }
  const list = wlLoad();
  if (list.includes(id)) { alert(`${id} 已在自選股中`); return; }
  list.push(id);
  wlSave(list);
  document.getElementById('wlSearchInput').value = '';
  await wlRender();
}

function wlRemove(id) {
  const list = wlLoad().filter(x => x !== id);
  wlSave(list);
  wlRender();
}

// ══════════════════════════════════════════════════════════════
// ④ 選股條件篩選
// ══════════════════════════════════════════════════════════════
function openScreener() {
  document.getElementById('screenerModal').classList.add('open');
}
function closeScreener() {
  document.getElementById('screenerModal').classList.remove('open');
}
function clearScreener() {
  ['scrPeMax','scrPbMax','scrYieldMin','scrVolMin','scrChgMin','scrChgMax'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('scrResults').innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.68rem;color:var(--muted);padding:0.5rem;text-align:center;">設定條件後點擊「篩選」</div>';
  document.getElementById('scrCount').textContent = '';
}

async function runScreener() {
  const peMax    = parseFloat(document.getElementById('scrPeMax').value);
  const pbMax    = parseFloat(document.getElementById('scrPbMax').value);
  const yieldMin = parseFloat(document.getElementById('scrYieldMin').value);
  const volMin   = parseFloat(document.getElementById('scrVolMin').value) * 1000;
  const chgMin   = parseFloat(document.getElementById('scrChgMin').value) / 100;
  const chgMax   = parseFloat(document.getElementById('scrChgMax').value) / 100;

  document.getElementById('scrLoading').style.display = 'block';
  document.getElementById('scrResults').innerHTML = '';
  document.getElementById('scrCount').textContent = '';

  try {
    const dateRes = await sbFetch('stock_daily_twse', 'order=date.desc&limit=1&select=date');
    const latestDate = dateRes[0]?.date;
    if (!latestDate) throw new Error('無資料');

    // 抓股價 + 估值資料
    const [priceRows, valRows] = await Promise.all([
      sbFetch('stock_daily_twse', `date=eq.${latestDate}&order=volume.desc&limit=600&select=stock_id,name,close,chg_pct,volume`),
      sbFetch('stock_valuation_daily', `order=dividend_yield.desc&limit=600&select=stock_id,pe_ratio,pb_ratio,dividend_yield`),
    ]);

    const valMap = {};
    (valRows || []).forEach(v => { valMap[v.stock_id] = v; });

    const results = (priceRows || []).filter(p => {
      const v = valMap[p.stock_id] || {};
      if (!isNaN(peMax)    && (v.pe_ratio == null || v.pe_ratio > peMax)) return false;
      if (!isNaN(pbMax)    && (v.pb_ratio == null || v.pb_ratio > pbMax)) return false;
      if (!isNaN(yieldMin) && (v.dividend_yield == null || v.dividend_yield < yieldMin)) return false;
      if (!isNaN(volMin)   && (p.volume == null || p.volume < volMin)) return false;
      if (!isNaN(chgMin)   && (p.chg_pct == null || p.chg_pct < chgMin)) return false;
      if (!isNaN(chgMax)   && (p.chg_pct == null || p.chg_pct > chgMax)) return false;
      return true;
    });

    document.getElementById('scrCount').textContent = `找到 ${results.length} 檔`;
    document.getElementById('scrLoading').style.display = 'none';

    if (!results.length) {
      document.getElementById('scrResults').innerHTML =
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.75rem;color:var(--muted);padding:1rem;text-align:center;">無符合條件個股，請放寬篩選條件</div>';
      return;
    }

    const header = `<div class="scr-result-row" style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);font-weight:600;border-bottom:2px solid var(--border);padding-bottom:0.35rem;margin-bottom:0.25rem;">
      <span>代號</span><span>名稱</span><span style="text-align:right;">收盤</span><span style="text-align:right;">漲跌</span><span style="text-align:right;">殖利率</span><span style="text-align:right;">PE</span>
    </div>`;

    const rows = results.slice(0, 60).map(p => {
      const v   = valMap[p.stock_id] || {};
      const clr = (p.chg_pct||0) >= 0 ? '#dc2626' : '#16a34a';
      const pct = `${(p.chg_pct||0) >= 0 ? '+' : ''}${((p.chg_pct||0)*100).toFixed(2)}%`;
      return `<div class="scr-result-row" onclick="closeScreener();setTimeout(()=>openStockModal({id:'${p.stock_id}',name:'${(p.name||'').replace(/'/g,'')}',price:${p.close||0},chgPct:${p.chg_pct||0},prev:${p.close||0},sector:'',mcap:0}),100)">
        <span style="font-weight:700;">${p.stock_id}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);">${p.name||''}</span>
        <span style="text-align:right;">${p.close??'—'}</span>
        <span style="text-align:right;color:${clr};font-weight:600;">${pct}</span>
        <span style="text-align:right;">${v.dividend_yield != null ? v.dividend_yield.toFixed(1)+'%' : '—'}</span>
        <span style="text-align:right;">${v.pe_ratio != null ? v.pe_ratio.toFixed(1) : '—'}</span>
      </div>`;
    }).join('');

    document.getElementById('scrResults').innerHTML = header + rows +
      (results.length > 60 ? `<div style="font-size:0.62rem;color:var(--muted);text-align:center;padding:0.5rem;font-family:'IBM Plex Mono',monospace;">僅顯示前 60 筆（共 ${results.length} 筆）</div>` : '');

  } catch(e) {
    document.getElementById('scrLoading').style.display = 'none';
    document.getElementById('scrResults').innerHTML =
      `<div style="color:#ef4444;font-size:0.8rem;padding:0.5rem;">篩選失敗：${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// ⑤ 個股 Modal 擴充：法人籌碼 + 基本面 tab
// ══════════════════════════════════════════════════════════════
// 在 openStockModal 之後，額外抓法人 + 估值資料注入 modal
const _origOpenStockModal = openStockModal;
openStockModal = async function(stock) {
  await _origOpenStockModal(stock);
  // 等待 modal 顯示後注入額外區塊
  setTimeout(() => injectStockModalExtras(stock), 200);
};

async function injectStockModalExtras(stock) {
  // 找插入點
  const box = document.getElementById('stockModalBox');
  if (!box) return;

  // 移除舊的 extra 區塊
  const old = box.querySelector('#modalExtras');
  if (old) old.remove();

  const extra = document.createElement('div');
  extra.id = 'modalExtras';
  extra.style.cssText = 'margin-top:0.9rem;padding-top:0.75rem;border-top:1px solid var(--border);';
  extra.innerHTML = `
    <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
      <button onclick="switchModalTab('basic')" id="modalTabBasic" style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;padding:0.28rem 0.75rem;border-radius:5px;border:none;background:var(--accent);color:#fff;cursor:pointer;">基本面</button>
      <button onclick="switchModalTab('chip')" id="modalTabChip" style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;padding:0.28rem 0.75rem;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;">籌碼</button>
    </div>
    <div id="modalTabContentBasic" style="display:block;">
      <div id="modalValuation" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">
        <div style="text-align:center;padding:0.5rem;font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);">載入中…</div>
      </div>
    </div>
    <div id="modalTabContentChip" style="display:none;">
      <div id="modalChipData" style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--muted);text-align:center;padding:0.75rem;">載入籌碼資料中…</div>
    </div>`;

  // 插到 AI 研究區塊前面
  const aiDiv = box.querySelector('#modalAiResult')?.closest('div');
  if (aiDiv) {
    box.insertBefore(extra, aiDiv.previousElementSibling || aiDiv);
  } else {
    box.appendChild(extra);
  }

  // 並行抓估值 + 法人籌碼
  const [valRes, instRes] = await Promise.allSettled([
    sbFetch('stock_valuation_daily', `stock_id=eq.${stock.id}&order=date.desc&limit=1&select=pe_ratio,pb_ratio,dividend_yield,date`),
    sbFetch('institutional_daily', `stock_id=eq.${stock.id}&order=date.desc&limit=5&select=date,foreign_net,trust_net,dealer_net`).catch(() => null),
  ]);

  // 基本面
  const val = valRes.status === 'fulfilled' && valRes.value?.[0];
  const valEl = document.getElementById('modalValuation');
  if (val) {
    const items = [
      { label: '本益比 PE', val: val.pe_ratio != null ? val.pe_ratio.toFixed(1) : '—' },
      { label: '股淨比 PB', val: val.pb_ratio != null ? val.pb_ratio.toFixed(2) : '—' },
      { label: '殖利率',    val: val.dividend_yield != null ? val.dividend_yield.toFixed(2) + '%' : '—' },
    ];
    valEl.innerHTML = items.map(i => `
      <div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.6rem;box-shadow:0 0 0 1px var(--border);text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);">${i.label}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--text);margin-top:2px;">${i.val}</div>
      </div>`).join('') +
      `<div style="grid-column:1/-1;font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:var(--muted);text-align:right;">資料日期：${val.date}</div>`;
  } else {
    valEl.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.7rem;color:var(--muted);text-align:center;padding:0.5rem;">估值資料累積中</div>';
  }

  // 籌碼
  const instRows = instRes.status === 'fulfilled' ? (instRes.value || []) : [];
  const chipEl = document.getElementById('modalChipData');
  if (instRows.length) {
    const fmt = v => v >= 0 ? `<span style="color:#dc2626">+${(v/1000).toFixed(0)}K</span>` : `<span style="color:#16a34a">${(v/1000).toFixed(0)}K</span>`;
    chipEl.innerHTML = `
      <div style="display:grid;grid-template-columns:5rem 1fr 1fr 1fr;gap:0.35rem;margin-bottom:0.35rem;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
        <span>日期</span><span style="text-align:right;">外資</span><span style="text-align:right;">投信</span><span style="text-align:right;">自營</span>
      </div>` +
      instRows.map(r => `
        <div style="display:grid;grid-template-columns:5rem 1fr 1fr 1fr;gap:0.35rem;margin-bottom:0.25rem;font-family:'IBM Plex Mono',monospace;font-size:0.7rem;align-items:center;">
          <span style="color:var(--muted);">${r.date}</span>
          <span style="text-align:right;">${fmt(r.foreign_net??0)}</span>
          <span style="text-align:right;">${fmt(r.trust_net??0)}</span>
          <span style="text-align:right;">${fmt(r.dealer_net??0)}</span>
        </div>`).join('') +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.52rem;color:var(--muted);margin-top:0.4rem;">單位：千股（K）</div>';
  } else {
    chipEl.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:0.7rem;color:var(--muted);text-align:center;padding:0.5rem;">個股法人資料累積中</div>';
  }
}

function switchModalTab(tab) {
  document.getElementById('modalTabContentBasic').style.display = tab === 'basic' ? 'block' : 'none';
  document.getElementById('modalTabContentChip').style.display  = tab === 'chip'  ? 'block' : 'none';
  document.getElementById('modalTabBasic').style.background = tab === 'basic' ? 'var(--accent)' : 'var(--surface)';
  document.getElementById('modalTabBasic').style.color      = tab === 'basic' ? '#fff' : 'var(--muted)';
  document.getElementById('modalTabBasic').style.border     = tab === 'basic' ? 'none' : '1px solid var(--border)';
  document.getElementById('modalTabChip').style.background  = tab === 'chip' ? 'var(--accent)' : 'var(--surface)';
  document.getElementById('modalTabChip').style.color       = tab === 'chip' ? '#fff' : 'var(--muted)';
  document.getElementById('modalTabChip').style.border      = tab === 'chip' ? 'none' : '1px solid var(--border)';
}

// ══════════════════════════════════════════════════════════════
// ⑥ Alpha 30天回測
// ══════════════════════════════════════════════════════════════
async function runAlphaBacktest() {
  const btn = document.getElementById('alphaBacktestBtn');
  const out  = document.getElementById('alphaBacktestResult');
  if (btn) btn.disabled = true;
  out.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;font-size:0.75rem;"><div class="spinner" style="margin:0 auto 0.5rem;"></div>回測中（抓 30 天歷史報告）…</div>';

  try {
    // 抓最近 30 天的 alpha_daily_report
    const reports = await sbFetch('alpha_daily_report', 'order=report_date.desc&limit=30&select=report_date,market_mood,recommendations');
    if (!reports || !reports.length) throw new Error('無歷史報告');

    // 抓最新收盤日（用來算每筆進出場）
    const dateRes = await sbFetch('stock_daily_twse', 'order=date.desc&limit=1&select=date');
    const latestDate = dateRes[0]?.date;

    // 對每份報告的 買進推薦，模擬「當日進場，N天後出場」
    let totalTrades = 0, wins = 0, totalPnl = 0;
    const tradeLog = [];

    for (const rpt of reports) {
      const buys = (rpt.recommendations || []).filter(r => r.action === '買進');
      for (const rec of buys) {
        // 找進場日後的收盤價（+1日 ~ +holding_days日）
        const holdDays = rec.holding_days || 5;
        const entryDate = rpt.report_date;
        try {
          const priceRows = await sbFetch('stock_daily_twse',
            `stock_id=eq.${rec.stock_id}&date=gt.${entryDate}&order=date.asc&limit=${holdDays}&select=date,close`);
          if (!priceRows || priceRows.length < 1) continue;

          const entryClose = priceRows[0]?.close;
          const exitRow    = priceRows[Math.min(priceRows.length - 1, holdDays - 1)];
          const exitClose  = exitRow?.close;
          if (!entryClose || !exitClose) continue;

          // 判斷停損停利（先到先觸發）
          let actualExit = exitClose;
          let exitReason = `第${priceRows.indexOf(exitRow)+1}天出場`;
          for (const row of priceRows) {
            if (row.close >= rec.target_price) { actualExit = rec.target_price; exitReason = '停利'; break; }
            if (row.close <= rec.stop_loss)    { actualExit = rec.stop_loss;    exitReason = '停損'; break; }
          }

          const pnlPct = ((actualExit - (rec.entry_price || entryClose)) / (rec.entry_price || entryClose) * 100);
          totalTrades++;
          if (pnlPct > 0) wins++;
          totalPnl += pnlPct;
          tradeLog.push({ date: entryDate, id: rec.stock_id, name: rec.stock_name, entry: rec.entry_price || entryClose, exit: actualExit, pnlPct, reason: exitReason, mood: rpt.market_mood });
        } catch { continue; }
      }
    }

    if (!totalTrades) throw new Error('無足夠模擬資料（需要更多歷史報告）');

    const winRate = (wins / totalTrades * 100).toFixed(1);
    const avgPnl  = (totalPnl / totalTrades).toFixed(2);
    const sorted  = tradeLog.sort((a, b) => b.pnlPct - a.pnlPct);

    out.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:0.9rem;">
        <div style="background:var(--surface);border-radius:8px;padding:0.6rem;text-align:center;border:1px solid var(--border);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1rem;font-weight:700;color:${parseFloat(avgPnl)>=0?'#dc2626':'#16a34a'};">${parseFloat(avgPnl)>=0?'+':''}${avgPnl}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-top:2px;">平均報酬率</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:0.6rem;text-align:center;border:1px solid var(--border);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1rem;font-weight:700;color:${parseFloat(winRate)>=50?'#dc2626':'#16a34a'};">${winRate}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-top:2px;">勝率（${wins}/${totalTrades}）</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:0.6rem;text-align:center;border:1px solid var(--border);">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1rem;font-weight:700;">${totalTrades}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-top:2px;">模擬交易次數</div>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);margin-bottom:0.4rem;letter-spacing:0.05em;">交易明細（按報酬率排序）</div>
      <div style="max-height:220px;overflow-y:auto;">
        <div style="display:grid;grid-template-columns:5rem 3.5rem 5rem 4rem 4rem 3.5rem;gap:0.3rem;font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:0.25rem;margin-bottom:0.2rem;">
          <span>日期</span><span>代號</span><span>名稱</span><span style="text-align:right;">進場</span><span style="text-align:right;">出場</span><span style="text-align:right;">報酬</span>
        </div>
        ${sorted.map(t => {
          const c = t.pnlPct >= 0 ? '#dc2626' : '#16a34a';
          return `<div style="display:grid;grid-template-columns:5rem 3.5rem 5rem 4rem 4rem 3.5rem;gap:0.3rem;font-family:'IBM Plex Mono',monospace;font-size:0.68rem;margin-bottom:0.18rem;align-items:center;" title="${t.reason}">
            <span style="color:var(--muted);">${t.date.slice(5)}</span>
            <span style="font-weight:600;">${t.id}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);">${t.name||''}</span>
            <span style="text-align:right;">${t.entry.toFixed(1)}</span>
            <span style="text-align:right;">${t.exit.toFixed(1)}</span>
            <span style="text-align:right;color:${c};font-weight:700;">${t.pnlPct>=0?'+':''}${t.pnlPct.toFixed(2)}%</span>
          </div>`;
        }).join('')}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-top:0.65rem;">
        ※ 回測採用停損停利模擬，以報告日後第1交易日進場，持有至停損/停利/計畫天數出場。不考慮交易成本。僅供參考，不代表未來表現。
      </div>`;

  } catch(e) {
    out.innerHTML = `<div style="color:#ef4444;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;padding:0.5rem;">回測失敗：${e.message}</div>`;
  }
  if (btn) btn.disabled = false;
}

// ── 在頁面初始化時啟動今日總結 ──
document.addEventListener('DOMContentLoaded', () => {
  loadDailySummary();
});
// 若 DOMContentLoaded 已過（script defer），直接執行
if (document.readyState !== 'loading') loadDailySummary();

// ESC 關閉選股 Modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeScreener();
});
