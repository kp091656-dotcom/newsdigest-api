// ════════ ② 估值分布警示 ════════
async function loadValuationSignal() {
  const loading = document.getElementById('ms_valLoading');
  const content = document.getElementById('ms_valContent');
  try {
    // 取熱圖 155 支股票的最新估值（分兩批）
    const HM_IDS = typeof HM_STOCK_LIST !== "undefined" ? HM_STOCK_LIST.map(s => s.id) : [];
    if (!HM_IDS.length) { loading.textContent = '熱圖尚未載入'; return; }
    const half = Math.ceil(HM_IDS.length / 2);
    const [r1, r2] = await Promise.all([
      sbFetch('stock_valuation_daily',
        `stock_id=in.(${HM_IDS.slice(0, half).join(',')})&order=date.desc&limit=${half * 2}&select=*`),
      sbFetch('stock_valuation_daily',
        `stock_id=in.(${HM_IDS.slice(half).join(',')})&order=date.desc&limit=${half * 2}&select=*`),
    ]);
    const rows = [...(r1 || []), ...(r2 || [])];

    // 每支取最新一筆 pe_ratio > 0
    const valMap = {};
    rows.forEach(r => {
      const per = parseFloat(r.pe_ratio);
      if (!valMap[r.stock_id] && per > 0) valMap[r.stock_id] = r;
    });
    const vals = Object.values(valMap);
    if (!vals.length) { loading.textContent = '估值資料暫無'; return; }

    // 分類統計
    let cheap = 0, ok = 0, exp = 0;
    let sumPER = 0, cntPER = 0, sumDY = 0, cntDY = 0, highDYCnt = 0;
    vals.forEach(v => {
      const per = (() => { const p = parseFloat(v.pe_ratio); return (p > 0 && p <= 200) ? p : 0; })();
      const dy  = parseFloat(v.dividend_yield) || 0;
      if (per > 0) {
        sumPER += per; cntPER++;
        if      (per < 15) cheap++;
        else if (per < 20) ok++;
        else               exp++;
      }
      if (dy > 0) { sumDY += dy; cntDY++; }
      if (dy >= 5) highDYCnt++;
    });
    const avgPER = cntPER ? sumPER / cntPER : 0;
    const avgDY  = cntDY  ? sumDY  / cntDY  : 0;

    document.getElementById('ms_valCheap').textContent = cheap;
    document.getElementById('ms_valOk').textContent    = ok;
    document.getElementById('ms_valExp').textContent   = exp;
    document.getElementById('ms_avgPER').textContent   = avgPER ? avgPER.toFixed(1) + 'x' : '—';
    document.getElementById('ms_avgDY').textContent    = avgDY  ? avgDY.toFixed(2)  + '%' : '—';
    document.getElementById('ms_highDYCount').textContent = highDYCnt + ' 支';

    // 市場估值情境
    const sigEl = document.getElementById('ms_valSignal');
    let sigText, sigBg, sigColor;
    if (avgPER > 0 && avgPER < 13)      { sigText='整體市場偏便宜，具長線價值';  sigBg='rgba(22,163,74,0.12)';  sigColor='#16a34a'; }
    else if (avgPER > 0 && avgPER < 18) { sigText='整體市場估值合理';            sigBg='rgba(99,102,241,0.1)';  sigColor='var(--accent)'; }
    else if (avgPER > 0 && avgPER < 25) { sigText='整體市場略微偏貴，注意風險'; sigBg='rgba(249,115,22,0.12)'; sigColor='#f97316'; }
    else if (avgPER > 0)                { sigText='整體市場高估，謹慎追高';      sigBg='rgba(220,38,38,0.12)';  sigColor='#dc2626'; }
    else                                { sigText='估值資料不足';                sigBg='transparent';           sigColor='var(--muted)'; }
    sigEl.textContent         = sigText;
    sigEl.style.background    = sigBg;
    sigEl.style.color         = sigColor;

    loading.style.display = 'none';
    content.style.display = 'block';
  } catch(e) {
    loading.textContent = '估值資料載入失敗';
    console.warn('loadValuationSignal error:', e);
  }
}

// ════════ ③ CAPM β 值計算 ════════
async function loadBetaSignal() {
  const loading = document.getElementById('ms_betaLoading');
  const content = document.getElementById('ms_betaContent');
  try {
    // 取 TAIEX 近 62 日（多 2 天 buffer）
    const HM_IDS = typeof HM_STOCK_LIST !== "undefined" ? HM_STOCK_LIST.map(s => s.id) : [];
    if (!HM_IDS.length) { loading.textContent = '熱圖尚未載入'; return; }

    // 取 0050 作為市場代理（流動性高、追蹤加權指數）
    const mktRows = await sbFetch('stock_daily_twse',
      'stock_id=eq.0050&order=date.desc&limit=62&select=date,chg_pct');
    if (!mktRows || mktRows.length < 10) { loading.textContent = '市場資料不足'; return; }

    const mktDates = mktRows.map(r => r.date);
    const mktMap   = {};
    mktRows.forEach(r => { mktMap[r.date] = parseFloat(r.chg_pct) * 100; }); // 轉 %

    // 取熱圖股票近 62 日收盤漲跌（分兩批）
    const half = Math.ceil(HM_IDS.length / 2);
    const [s1, s2] = await Promise.all([
      sbFetch('stock_daily_twse',
        `stock_id=in.(${HM_IDS.slice(0, half).join(',')})&order=date.desc&limit=${half * 62}&select=stock_id,date,chg_pct`),
      sbFetch('stock_daily_twse',
        `stock_id=in.(${HM_IDS.slice(half).join(',')})&order=date.desc&limit=${half * 62}&select=stock_id,date,chg_pct`),
    ]);
    const stockRows = [...(s1 || []), ...(s2 || [])];

    // 按股票分組
    const stockMap = {};
    stockRows.forEach(r => {
      if (!stockMap[r.stock_id]) stockMap[r.stock_id] = {};
      stockMap[r.stock_id][r.date] = parseFloat(r.chg_pct) * 100;
    });

    // 計算每支股票的 β（用共同有資料的交易日）
    const betas = [];
    for (const id of HM_IDS) {
      const sm = stockMap[id];
      if (!sm) continue;
      const pairs = mktDates.filter(d => sm[d] != null && mktMap[d] != null)
                            .map(d => ({ m: mktMap[d], s: sm[d] }));
      if (pairs.length < 10) continue;

      const n   = pairs.length;
      const mMean = pairs.reduce((a, p) => a + p.m, 0) / n;
      const sMean = pairs.reduce((a, p) => a + p.s, 0) / n;
      const cov   = pairs.reduce((a, p) => a + (p.m - mMean) * (p.s - sMean), 0) / (n - 1);
      const varM  = pairs.reduce((a, p) => a + (p.m - mMean) ** 2, 0) / (n - 1);
      if (varM === 0) continue;
      const beta  = cov / varM;
      if (isFinite(beta) && Math.abs(beta) < 5) {
        const info = typeof HM_STOCK_LIST !== 'undefined' ? HM_STOCK_LIST.find(s => s.id === id) : null;
        betas.push({ id, name: info?.name || id, beta: Math.round(beta * 100) / 100 });
      }
    }

    if (!betas.length) { loading.textContent = 'β 值資料不足'; return; }

    const lowB  = betas.filter(b => b.beta < 0.8).length;
    const midB  = betas.filter(b => b.beta >= 0.8 && b.beta <= 1.2).length;
    const highB = betas.filter(b => b.beta > 1.2).length;
    const avgBeta = betas.reduce((a, b) => a + b.beta, 0) / betas.length;

    document.getElementById('ms_betaLow').textContent  = lowB;
    document.getElementById('ms_betaMid').textContent  = midB;
    document.getElementById('ms_betaHigh').textContent = highB;
    document.getElementById('ms_avgBeta').textContent  = avgBeta.toFixed(2);

    // Top 5 高 β
    const top5 = [...betas].sort((a, b) => b.beta - a.beta).slice(0, 5);
    document.getElementById('ms_betaTop5').innerHTML = top5.map(b => {
      const color = b.beta > 1.5 ? '#dc2626' : b.beta > 1.2 ? '#f97316' : 'var(--muted)';
      const barW  = Math.min(100, (b.beta / 2.5) * 100);
      return `<div style="display:flex;align-items:center;gap:5px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;color:var(--muted);width:52px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.name}</span>
        <div style="flex:1;height:5px;background:var(--bg);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;"></div>
        </div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:${color};font-weight:600;width:36px;text-align:right;">β${b.beta.toFixed(2)}</span>
      </div>`;
    }).join('');

    // β 情境解讀
    const sigEl = document.getElementById('ms_betaSignal');
    let sigText, sigBg, sigColor;
    if (avgBeta > 1.3)      { sigText='市場整體高波動，進攻型持股多'; sigBg='rgba(249,115,22,0.12)'; sigColor='#f97316'; }
    else if (avgBeta > 0.9) { sigText='市場波動接近平均水準';        sigBg='rgba(99,102,241,0.1)';  sigColor='var(--accent)'; }
    else                    { sigText='市場整體偏防禦，低波動持股多'; sigBg='rgba(14,165,233,0.1)';  sigColor='#0ea5e9'; }
    sigEl.textContent      = sigText;
    sigEl.style.background = sigBg;
    sigEl.style.color      = sigColor;

    loading.style.display = 'none';
    content.style.display = 'block';
  } catch(e) {
    loading.textContent = 'β 值計算失敗';
    console.warn('loadBetaSignal error:', e);
  }
}

async function loadSignalBacktest() {
  const section = document.getElementById('ms_backtestSection');
  if (!section) return;

  try {
    // 同時抓選擇權和台指（用個股加權）
    const [optRows, stockRows] = await Promise.all([
      sbFetch('options_daily', 'order=date.desc&limit=30&select=date,pc_ratio_oi,foreign_opt_net'),
      sbFetch('stock_daily_twse', 'stock_id=eq.0050&order=date.desc&limit=31&select=date,close,chg_pct'),
    ]);

    if (!optRows?.length || optRows.length < 5) {
      section.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);text-align:center;padding:0.75rem;">
        資料累積中（${optRows?.length || 0}/5 天）<br><span style="font-size:0.55rem;opacity:0.7;">建議累積 5 個交易日後查看</span>
      </div>`;
      return;
    }

    // 計算：P/C OI 訊號 vs 隔日台指漲跌
    const optData   = optRows.slice().reverse();
    const stockData = stockRows.slice().reverse();
    const stockMap  = {};
    stockData.forEach(d => { stockMap[d.date] = d; });

    let bull_right = 0, bull_wrong = 0, bear_right = 0, bear_wrong = 0;
    const lastN = optData.slice(-20); // 最近20筆

    lastN.forEach((opt, i) => {
      if (i >= lastN.length - 1) return;
      const nextDate = lastN[i+1]?.date;
      const nextStock = stockMap[nextDate];
      if (!nextStock) return;

      const pcOI     = opt.pc_ratio_oi;
      const isBull   = pcOI < 1.0; // P/C < 1 = 偏多
      const isBear   = pcOI > 1.0;
      const mktUp    = nextStock.chg_pct > 0;

      if (isBull && mktUp)   bull_right++;
      if (isBull && !mktUp)  bull_wrong++;
      if (isBear && !mktUp)  bear_right++;
      if (isBear && mktUp)   bear_wrong++;
    });

    const bullTotal = bull_right + bull_wrong;
    const bearTotal = bear_right + bear_wrong;
    const bullAcc   = bullTotal > 0 ? (bull_right / bullTotal * 100).toFixed(0) : '—';
    const bearAcc   = bearTotal > 0 ? (bear_right / bearTotal * 100).toFixed(0) : '—';
    const total     = bull_right + bull_wrong + bear_right + bear_wrong;
    const totalAcc  = total > 0 ? ((bull_right + bear_right) / total * 100).toFixed(0) : '—';

    section.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);letter-spacing:0.06em;margin-bottom:0.5rem;">
        📐 P/C Ratio 訊號回測（近 ${total} 次，隔日0050漲跌）
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-bottom:0.4rem;">
        ${[
          { label:'偏多訊號準確率', val:`${bullAcc}%`, sub:`${bull_right}/${bullTotal}次`, color:'#dc2626' },
          { label:'偏空訊號準確率', val:`${bearAcc}%`, sub:`${bear_right}/${bearTotal}次`, color:'#16a34a' },
          { label:'整體準確率',     val:`${totalAcc}%`, sub:`${bull_right+bear_right}/${total}次`, color:'var(--accent2)' },
        ].map(s => `<div style="background:var(--bg);border-radius:6px;padding:0.4rem 0.5rem;text-align:center;">
          <div style="font-size:0.5rem;color:var(--muted);">${s.label}</div>
          <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:800;color:${s.color};">${s.val}</div>
          <div style="font-size:0.48rem;color:var(--muted);">${s.sub}</div>
        </div>`).join('')}
      </div>
      <div style="font-size:0.5rem;color:var(--muted);opacity:0.7;">※ 回測基於歷史資料，不代表未來表現。樣本數越多越可靠。</div>
    `;
  } catch(e) {
    console.warn('loadSignalBacktest error:', e);
    section.innerHTML = '';
  }
}

// ── Heatmap 日期除錯工具 ──
async function debugHeatmapDates() {
  const ids = HM_STOCK_LIST.map(s => s.id);
  const total = ids.length;
  const inList = ids.join(',');

  const modal = document.createElement('div');
  modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;`;
  const box = document.createElement('div');
  box.style.cssText = `background:#fff;border-radius:12px;padding:1.5rem 1.8rem;max-width:540px;width:92%;max-height:80vh;overflow-y:auto;font-family:'IBM Plex Mono',monospace;font-size:0.7rem;box-shadow:0 20px 60px rgba(0,0,0,0.25);`;
  box.innerHTML = `<div style="font-size:0.9rem;font-weight:700;margin-bottom:1rem;color:#16161a;">&#128269; Supabase 資料覆蓋率診斷</div><div id="dbgBody" style="color:#6e6e7e;">查詢中…</div><button onclick="this.closest('[style*=fixed]').remove()" style="margin-top:1rem;padding:0.35rem 1rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;">關閉</button>`;
  modal.appendChild(box);
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const dbgBody = box.querySelector('#dbgBody');
  try {
    const rows = await sbFetch('stock_daily_twse',
      `stock_id=in.(${inList})&order=date.desc&limit=${total * 10}&select=stock_id,date`);

    if (!rows?.length) { dbgBody.innerHTML = '&#10060; 無資料'; return; }

    const dateCounts = {};
    rows.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });
    const sorted = Object.entries(dateCounts).sort((a, b) => b[0].localeCompare(a[0]));

    let html = `<div style="margin-bottom:0.6rem;color:#16161a;">共查到 <b>${rows.length}</b> 筆 / 追蹤 <b>${total}</b> 支 / <b>${sorted.length}</b> 個交易日</div>`;
    html += `<table style="width:100%;border-collapse:collapse;"><tr style="color:#6e6e7e;font-size:0.6rem;border-bottom:1px solid #eee;"><th style="text-align:left;padding:3px 6px;">日期</th><th style="text-align:left;padding:3px 6px;">星期</th><th style="text-align:right;padding:3px 6px;">筆數</th><th style="text-align:right;padding:3px 6px;">覆蓋率</th><th style="text-align:left;padding:3px 6px;">狀態</th></tr>`;
    const wds = ['日','一','二','三','四','五','六'];
    sorted.slice(0, 15).forEach(([date, cnt], i) => {
      const d = new Date(date + 'T00:00:00+08:00');
      const wd = wds[d.getDay()];
      const pct = (cnt / total * 100).toFixed(0);
      const warn = cnt < total * 0.5 ? '&#9888; 不完整' : cnt < total * 0.9 ? '&#9651; 部分' : '&#10003; 完整';
      const warnColor = cnt < total * 0.5 ? '#dc2626' : cnt < total * 0.9 ? '#d97706' : '#16a34a';
      html += `<tr style="border-bottom:1px solid #f0f0f5;${i===0?'background:#f0f4ff;':''}"><td style="padding:4px 6px;font-weight:${i===0?700:400};color:#16161a;">${date}</td><td style="padding:4px 6px;color:#6e6e7e;">週${wd}</td><td style="padding:4px 6px;text-align:right;">${cnt}</td><td style="padding:4px 6px;text-align:right;font-weight:600;">${pct}%</td><td style="padding:4px 6px;color:${warnColor};">${warn}${i===0?' &#8592; 最新':''}</td></tr>`;
    });
    html += '</table>';
    const newest = sorted[0];
    const newestPct = newest[1] / total * 100;
    html += `<div style="margin-top:0.8rem;padding:0.6rem 0.75rem;border-radius:6px;background:${newestPct<80?'#fff7ed':'#f0fdf4'};border:1px solid ${newestPct<80?'#fed7aa':'#bbf7d0'};"><div style="font-weight:700;color:${newestPct<80?'#92400e':'#14532d'};margin-bottom:0.3rem;">診斷結論</div>`;
    if (newestPct < 80) {
      html += `<div style="color:#92400e;line-height:1.7;">最新日期 <b>${newest[0]}</b> 覆蓋率僅 <b>${newestPct.toFixed(0)}%</b><br>→ <b>Supabase Pipeline 未完整更新</b><br><br>可能原因：<br>① ETL 排程當日未執行<br>② 部分股票代碼在來源無資料<br>③ Supabase ingestion 中途失敗</div>`;
    } else {
      html += `<div style="color:#14532d;">最新日期 <b>${newest[0]}</b> 覆蓋率 <b>${newestPct.toFixed(0)}%</b>，資料狀態正常。</div>`;
    }
    html += '</div>';
    dbgBody.innerHTML = html;
  } catch(e) {
    dbgBody.innerHTML = `&#10060; 查詢失敗：${e.message}`;
  }
}

// ── 字體大小控制 ──
function setFontSize(size) {
  // 同時設 html（root rem 基準）和 body（component class 相容）
  document.documentElement.classList.remove('fs-small', 'fs-medium', 'fs-large');
  document.documentElement.classList.add(`fs-${size}`);
  document.body.classList.remove('fs-small', 'fs-medium', 'fs-large');
  document.body.classList.add(`fs-${size}`);
  document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
  const ids = { small: 'fsSmall', medium: 'fsMedium', large: 'fsLarge' };
  document.getElementById(ids[size])?.classList.add('active');
  localStorage.setItem('alphascope_fontsize', size);
}
function loadSavedFontSize() {
  const saved = localStorage.getItem('alphascope_fontsize') || 'medium';
  setFontSize(saved);
}

// ── Init ──
renderTrending();
loadSavedKeys();
loadSavedFontSize();
updateOwnerBadge();
loadFearGreed();
loadCryptoFearGreed();
loadVix();
loadOptions();
// 背景預載台股熱圖資料（不切換畫面，點 tab 時即時顯示）
loadHeatmap();
// 頁面開啟自動從 Supabase 載入快取新聞
setTimeout(() => loadCachedNews(), 500);
