
function showFutures() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('futuresTab').classList.add('active');
  document.getElementById('newsFeed').style.display = 'none';
  const gp = document.getElementById('giftsPanel'); if (gp) gp.style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';
  document.querySelector('.feed-header').style.display = 'none';
  document.getElementById('sentimentPanel').style.display = 'none';
  document.getElementById('heatmapPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'none';
  document.getElementById('futuresPanel').style.display = 'block';
  if (!futuresData.length) loadFutures();
}

function hideFutures() {
  document.getElementById('futuresPanel').style.display = 'none';
  document.getElementById('newsFeed').style.display = 'block';
  document.querySelector('.feed-header').style.display = 'flex';
}

function setGroqStatus(msg, type) {
  const el = document.getElementById('groqStatus');
  if (!el) return;
  if (!el) return;
  el.textContent = msg;
  el.className = 'api-status' + (type ? ' ' + type : '');
}

function saveGroqKey() {
  // Groq key 存於 Vercel 環境變數，前端無需設定
  setGroqStatus('✓ 已啟用（已記住）', 'ok');
}

function loadSavedKeys() {
  // Groq key 存在 Vercel 環境變數

}

// ── Sticky offset calculator ──
function updateStickyOffsets() {
  const header   = document.querySelector('header');
  const apiBar   = document.querySelector('.api-config-bar');
  const catBar   = document.querySelector('.category-bar');
  if (!header || !apiBar || !catBar) return;
  const hH = header.offsetHeight;       // 60px
  const aH = apiBar.offsetHeight;       // variable
  apiBar.style.top = hH + 'px';
  catBar.style.top = (hH + aH) + 'px';
}
// Run on load and resize
updateStickyOffsets();
window.addEventListener('resize', updateStickyOffsets);
// ════════ 台指多空訊號儀表板 ════════
async function loadMktSignals() {
  if (loadMktSignals._busy) return;
  loadMktSignals._busy = true;
  try {
  // 同時抓取選擇權、三大法人現貨、融資融券
  const [optData, instData, marginData] = await Promise.allSettled([
    fetch(API_BASE + '?endpoint=options').then(r => r.json()),
    fetch(API_BASE + '?endpoint=institutional').then(r => r.json()), // 仍用於籌碼子分數
    fetch(API_BASE + '?endpoint=margin').then(r => r.json()),
  ]);

  let score = 0; // 多空得分：正=多、負=空
  let oiScore = 0, vScore = 0; // 子分數（提升到外層 scope）

  // ── 解出各 API 資料（提升到外層 scope，供子分數區塊使用）──
  const opt  = optData.status  === 'fulfilled' ? optData.value  : null;
  const inst = instData.status === 'fulfilled' ? instData.value : null;

  // ── ① 填入選擇權資料 ──
  if (opt && opt.pcRatio) {
    const pcOI  = opt.pcRatio.oi;
    const pcVol = opt.pcRatio.volume;

    // P/C OI
    const oiEl = document.getElementById('ms_pcOI');
    const oiLbl = document.getElementById('ms_pcOILabel');
    oiEl.textContent = pcOI != null ? pcOI.toFixed(2) : '—';
    let oiColor = 'var(--muted)', oiText = '中性'; oiScore = 0;
    if (pcOI != null) {
      if      (pcOI >= 1.7)  { oiColor='var(--up)';   oiText='強力偏多'; oiScore=2; }
      else if (pcOI >= 1.3)  { oiColor='var(--up)';   oiText='略偏多';   oiScore=1; }
      else if (pcOI >= 1.0)  { oiColor='var(--muted)'; oiText='中性';    oiScore=0; }
      else if (pcOI >= 0.7)  { oiColor='var(--down)';  oiText='略偏空';  oiScore=-1;}
      else                   { oiColor='var(--down)';  oiText='強力偏空'; oiScore=-2;}
    }
    oiEl.style.color  = oiColor;
    oiLbl.textContent = oiText;
    oiLbl.style.color = oiColor;
    score += oiScore;

    // P/C Vol
    const volEl  = document.getElementById('ms_pcVol');
    const volLbl = document.getElementById('ms_pcVolLabel');
    volEl.textContent = pcVol != null ? pcVol.toFixed(2) : '—';
    let vColor = 'var(--muted)', vText = '中性'; vScore = 0;
    if (pcVol != null) {
      if      (pcVol >= 1.1)  { vColor='var(--up)';   vText='偏多'; vScore=1; }
      else if (pcVol >= 0.8)  { vColor='var(--muted)'; vText='中性'; vScore=0; }
      else                    { vColor='var(--down)';  vText='偏空'; vScore=-1;}
    }
    volEl.style.color  = vColor;
    volLbl.textContent = vText;
    volLbl.style.color = vColor;
    score += vScore;

    // Max Pain
    const mp = opt.maxPain;
    document.getElementById('ms_maxPain').textContent = mp ? mp.toLocaleString() + ' 點' : '—';

    // 法人選擇權部位
    const instRows = document.getElementById('ms_instRows');
    const inst = opt.institution || {};
    instRows.innerHTML = ['外資','自營商','投信'].map(name => {
      const v = inst[name];
      if (!v || v.net == null) return '';
      const net   = v.net;
      const pos   = net >= 0;
      const color = pos ? 'var(--up)' : 'var(--down)';
      const sign  = pos ? '+' : '';
      const barW  = Math.min(100, Math.abs(net) / 3000 * 100);
      const callStr = v.call != null ? `${v.call >= 0 ? '+' : ''}${v.call.toLocaleString()}` : '—';
      const putStr  = v.put  != null ? `${v.put  >= 0 ? '+' : ''}${v.put.toLocaleString()}`  : '—';
      if (name === '外資') score += pos ? 1 : -1;
      return `<div style="margin-bottom:0.35rem;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:5px;background:var(--bg);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${color};font-weight:700;width:52px;text-align:right;">${sign}${net.toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:0.5rem;padding-left:42px;font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">
          <span>C <b style="color:var(--up);">${callStr}</b></span>
          <span>P <b style="color:var(--down);">${putStr}</b></span>
        </div>
      </div>`;
    }).join('');

    const optDate = opt.date || '';
    document.getElementById('ms_optTs').textContent = optDate ? `資料日期：${optDate}` : '';
  }

  // ── ② 填入微台指散戶多空比 ──
  // 獨立 fetch（不在 Promise.allSettled 裡，因為是新 endpoint）
  (async () => {
    try {
      const tmf = await fetch(API_BASE + '?endpoint=tmf').then(r => r.json());
      document.getElementById('ms_tmfLoading').style.display = 'none';
      if (!tmf || !tmf.latest) return;
      document.getElementById('ms_tmfContent').style.display = 'block';

      const l = tmf.latest;
      const ratio = l.retail_ratio; // %，正=散戶偏多，負=散戶偏空
      const ratioColor = ratio > 0 ? 'var(--up)' : ratio < 0 ? 'var(--down)' : 'var(--muted)';

      // 主數字
      const ratioEl = document.getElementById('ms_tmfRatio');
      ratioEl.textContent = (ratio >= 0 ? '+' : '') + ratio.toFixed(2);
      ratioEl.style.color = ratioColor;

      // 標籤
      const lbl = document.getElementById('ms_tmfLabel');
      let lblText = '中性', lblBg = 'rgba(128,128,128,0.1)';
      if      (ratio >  20) { lblText = '散戶極度偏多 ⚠️'; lblBg = 'rgba(220,38,38,0.12)'; }
      else if (ratio >   5) { lblText = '散戶偏多';         lblBg = 'rgba(220,38,38,0.1)'; }
      else if (ratio >  -5) { lblText = '散戶中性';         lblBg = 'rgba(128,128,128,0.1)'; }
      else if (ratio > -20) { lblText = '散戶偏空';         lblBg = 'rgba(22,163,74,0.1)'; }
      else                  { lblText = '散戶極度偏空';     lblBg = 'rgba(22,163,74,0.12)'; }
      lbl.textContent       = lblText;
      lbl.style.color       = ratioColor;
      lbl.style.background  = lblBg;

      // 計算明細
      const tn = l.total_net;
      const to = l.total_oi;
      const tnEl = document.getElementById('ms_tmfTotalNet');
      tnEl.textContent = tn != null ? (tn >= 0 ? '+' : '') + tn.toLocaleString() : '—';
      tnEl.style.color = tn != null ? (tn >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--muted)';
      document.getElementById('ms_tmfTotalOI').textContent = to != null ? to.toLocaleString() : '—';

      // 法人明細列
      document.getElementById('ms_tmfInstRows').innerHTML = [
        { name: '外資', val: l.foreign_net },
        { name: '投信', val: l.trust_net   },
        { name: '自營商', val: l.dealer_net },
      ].map(({ name, val }) => {
        if (val == null) return '';
        const pos   = val >= 0;
        const color = pos ? 'var(--up)' : 'var(--down)';
        const barW  = Math.min(100, Math.abs(val) / Math.max(1, Math.abs(tn || 1)) * 80);
        return `<div style="display:flex;align-items:center;gap:5px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:5px;background:var(--bg);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:${color};font-weight:700;width:52px;text-align:right;">${pos?'+':''}${val.toLocaleString()}</span>
        </div>`;
      }).join('');

      // 近期 bar chart（散戶多空比）
      const bars = (tmf.history || []).slice(0, 15).reverse();
      const maxR = Math.max(...bars.map(d => Math.abs(d.retail_ratio || 0)), 1);
      document.getElementById('ms_tmfBars').innerHTML = bars.map(d => {
        const r   = d.retail_ratio || 0;
        const h   = Math.abs(r / maxR * 36);
        const col = r > 0 ? 'var(--up)' : 'var(--down)';
        return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:38px;">
          <div style="height:${h.toFixed(1)}px;background:${col};border-radius:2px 2px 0 0;"></div>
        </div>`;
      }).join('');
      document.getElementById('ms_tmfDates').innerHTML = bars.map(d =>
        `<div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.42rem;color:var(--muted);text-align:center;overflow:hidden;">${d.date.slice(5)}</div>`
      ).join('');

      document.getElementById('ms_tmfTs').textContent = `公式：-1 × ${tn != null ? tn.toLocaleString() : '?'} ÷ ${to != null ? to.toLocaleString() : '?'} = ${ratio.toFixed(2)}%`;

      // 多空得分貢獻（賣方思維：散戶偏多 → 警示，不加分）
      if (ratio > 10) score -= 1;
      else if (ratio < -10) score += 1;
    } catch(e) {
      document.getElementById('ms_tmfLoading').textContent = '微台 OI 資料載入失敗';
    }
  })();

  // ── ③ 填入融資融券 ──
  const margin = marginData.status === 'fulfilled' ? marginData.value : null;
  document.getElementById('ms_marginLoading').style.display = 'none';
  document.getElementById('ms_marginContent').style.display = margin ? 'block' : 'none';
  if (margin && margin.latest) {
    const lat = margin.latest;

    // 融資餘額
    const mBal = lat.marginBalance ? Math.round(lat.marginBalance / 1e8 * 10) / 10 : null;
    const mChg = lat.marginChange  ? Math.round(lat.marginChange  / 1e8 * 10) / 10 : null;
    document.getElementById('ms_marginBal').textContent = mBal != null ? mBal.toFixed(1) : '—';
    const mChgEl = document.getElementById('ms_marginChg');
    if (mChg != null) {
      mChgEl.textContent = (mChg >= 0 ? '▲+' : '▼') + mChg.toFixed(1) + ' 億';
      mChgEl.style.color = mChg >= 0 ? '#dc2626' : '#16a34a';
      // 融資大增=散戶追多，短線偏多但過熱警示；這裡簡單加分
      if (mChg > 0) score += 0.5;
    }

    // 融券餘額（張）
    const sBal = lat.shortBalance;
    const sChg = lat.shortChange;
    document.getElementById('ms_shortBal').textContent = sBal != null ? (sBal / 1000).toFixed(1) + 'k' : '—';
    const sChgEl = document.getElementById('ms_shortChg');
    if (sChg != null) {
      sChgEl.textContent = (sChg >= 0 ? '▲+' : '▼') + Math.abs(sChg / 1000).toFixed(1) + 'k張';
      sChgEl.style.color = sChg >= 0 ? '#16a34a' : '#dc2626';
    }

    // 融資近10日 mini bar
    const bars10m = (margin.data || []).slice(0, 10).reverse();
    const maxMar  = Math.max(...bars10m.map(d => d.marginBalance || 0));
    const minMar  = Math.min(...bars10m.map(d => d.marginBalance || 0));
    const rangeMar = maxMar - minMar || 1;
    document.getElementById('ms_marginBars').innerHTML = bars10m.map(d => {
      const h = ((d.marginBalance - minMar) / rangeMar * 28 + 4).toFixed(1);
      return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:32px;">
        <div style="height:${h}px;background:#dc2626;border-radius:2px 2px 0 0;opacity:0.75;"></div>
      </div>`;
    }).join('');

    document.getElementById('ms_marginTs').textContent = `資料日期：${margin.latestDate || ''}`;
  } else if (!margin) {
    document.getElementById('ms_marginLoading').textContent = '融資融券資料載入失敗';
    document.getElementById('ms_marginLoading').style.display = 'block';
  }

  // ── ④ VIX 複合調整（從側欄讀取已載入的 VIX 值）──
  const vixPriceEl = document.getElementById('vixPrice');
  const vixVal = vixPriceEl ? parseFloat(vixPriceEl.textContent) : NaN;
  let vixAdj = 0, vixNote = '';
  if (!isNaN(vixVal) && vixVal > 0) {
    if      (vixVal >= 35) { vixAdj = -2; vixNote = `VIX ${vixVal.toFixed(1)} 恐慌`; }
    else if (vixVal >= 25) { vixAdj = -1; vixNote = `VIX ${vixVal.toFixed(1)} 高波動`; }
    else if (vixVal <= 15) { vixAdj =  1; vixNote = `VIX ${vixVal.toFixed(1)} 低波動`; }
    else                   { vixNote = `VIX ${vixVal.toFixed(1)}`; }
    score += vixAdj;
  }

  // ── 計算綜合多空得分 ──
  const totalScore = Math.round(score * 10) / 10;
  const scoreEl = document.getElementById('mktSignalScore');
  const dotEl   = document.getElementById('mktSignalDot');
  const titleEl = document.getElementById('mktSignalTitle');
  const descEl  = document.getElementById('mktSignalDesc');
  scoreEl.textContent = (totalScore >= 0 ? '+' : '') + totalScore;
  let signalColor, signalTitle, signalDesc;
  if      (totalScore >= 5)  { signalColor='var(--up)';    signalTitle='強力多頭'; signalDesc='多指標共振偏多，動能強勁'; }
  else if (totalScore >= 3)  { signalColor='var(--up)';    signalTitle='明顯偏多'; signalDesc='多數指標偏多，注意過熱風險'; }
  else if (totalScore >= 1)  { signalColor='#f97316';      signalTitle='略偏多頭'; signalDesc='多空指標略偏多方'; }
  else if (totalScore >= -1) { signalColor='var(--muted)';   signalTitle='中性觀望'; signalDesc='多空訊號分歧，方向待確認'; }
  else if (totalScore >= -3) { signalColor='var(--down)';  signalTitle='略偏空頭'; signalDesc='多數指標偏空，留意下行風險'; }
  else                       { signalColor='#15803d';      signalTitle='明顯偏空'; signalDesc='空方訊號強烈，謹慎為宜'; }
  // 加入 VIX 附註
  if (vixNote) signalDesc += `｜${vixNote}`;

  // ── 殖利率曲線狀態（從 alpha_report macro_data 取，非同步不阻擋）──
  try {
    const alphaCache = sessionStorage.getItem('alpha_report_cache');
    const alphaData  = alphaCache ? JSON.parse(alphaCache) : null;
    const macro = alphaData?.macro_data;
    if (macro) {
      const y2  = macro['美債2Y殖利率']?.close;
      const y10 = macro['美債10Y殖利率']?.close;
      const fed = macro['聯準會利率']?.close;
      const dxy = macro['DXY美元指數']?.close;
      const sox = macro['SOX費城半導體']?.chg;
      const extraParts = [];
      if (y2 != null && y10 != null) {
        const spread = parseFloat((y10 - y2).toFixed(3));
        if (spread < 0) extraParts.push(`⚠️ 曲線倒掛(${spread}%)`);
        else extraParts.push(`利差+${spread}%`);
      }
      if (fed != null) extraParts.push(`Fed ${fed}%`);
      if (dxy != null) {
        const dxyChg = macro['DXY美元指數']?.chg;
        extraParts.push(`DXY ${dxy}${dxyChg != null ? `(${dxyChg > 0 ? '+' : ''}${dxyChg}%)` : ''}`);
      }
      if (sox != null) extraParts.push(`SOX ${sox > 0 ? '+' : ''}${sox}%`);
      if (extraParts.length) signalDesc += `｜${extraParts.join(' ')}`;
    }
  } catch { /* 靜默 */ }
  // ── 更新圓形儀表盤 ──
  // totalScore 範圍約 -8 ~ +8，映射到 0~100
  const gaugeVal = Math.round(Math.max(0, Math.min(100, (totalScore + 8) / 16 * 100)));
  const arcTotal = 331; // 3/4 圓弧總長（對應 stroke-dasharray 背景軌道）
  const arcFill  = (gaugeVal / 100 * arcTotal).toFixed(1);

  const gaugeArc   = document.getElementById('signalGaugeArc');
  const gaugeScore = document.getElementById('signalGaugeScore');
  const gaugeLbl   = document.getElementById('signalGaugeLabel');

  gaugeScore.textContent = gaugeVal;
  gaugeScore.setAttribute('fill', signalColor);
  gaugeLbl.textContent   = signalTitle;
  gaugeLbl.setAttribute('fill', signalColor);
  gaugeArc.setAttribute('stroke', signalColor);
  gaugeArc.setAttribute('stroke-dasharray', `${arcFill} 415`);

  titleEl.textContent      = signalTitle;
  titleEl.style.color      = signalColor;
  descEl.textContent       = signalDesc;

  // ── 子分數輔助函式 ──
  function _setSubGauge(arcId, txtId, lblId, rawScore, maxRaw, labelText, color) {
    const pct  = Math.max(0, Math.min(100, (rawScore + maxRaw) / (maxRaw * 2) * 100));
    const circ = 88; // 2π×14 ≈ 88
    const fill = (pct / 100 * circ).toFixed(1);
    const arc  = document.getElementById(arcId);
    const txt  = document.getElementById(txtId);
    const lbl  = document.getElementById(lblId);
    if (!arc) return;
    arc.setAttribute('stroke-dasharray', `${fill} ${circ}`);
    arc.setAttribute('stroke', color);
    txt.setAttribute('fill', color);
    txt.textContent = Math.round(pct);
    if (lbl) { lbl.textContent = labelText; lbl.style.color = color; }
  }

  // 法人籌碼子分數（instScore = netBil 方向 + 連買天數）
  const chipsRaw   = (inst && inst.data && inst.data[0])
    ? (() => { const nb = Math.round(inst.data[0].net / 1e8 * 10) / 10; let s = nb >= 0 ? 1 : -1; const st = inst.streak || 0; s += st > 0 ? Math.min(2, Math.floor(Math.abs(st)/3)) : -Math.min(2, Math.floor(Math.abs(st)/3)); return s; })()
    : 0;
  const chipsColor = chipsRaw >= 1 ? 'var(--up)' : chipsRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const chipsLbl   = chipsRaw >= 2 ? '強力買超' : chipsRaw >= 1 ? '小幅買超' : chipsRaw <= -2 ? '強力賣超' : chipsRaw <= -1 ? '小幅賣超' : '中性';
  _setSubGauge('subArcChips', 'subTxtChips', 'subLblChips', chipsRaw, 3, chipsLbl, chipsColor);

  // 選擇權子分數（pcOI + pcVol + 外資選擇權）
  const optRaw   = opt ? (() => { let s = oiScore + vScore; const fw = (opt.institution||{})['外資']; if (fw && fw.net != null) s += (fw.net >= 0 ? 1 : -1); return s; })() : 0;
  const optColor = optRaw >= 1 ? 'var(--up)' : optRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const optLbl   = optRaw >= 2 ? 'PUT偏少' : optRaw >= 1 ? '略偏多' : optRaw <= -2 ? 'PUT偏多' : optRaw <= -1 ? '略偏空' : '中性';
  _setSubGauge('subArcOpt', 'subTxtOpt', 'subLblOpt', optRaw, 4, optLbl, optColor);

  // 融資券子分數
  const marginRaw   = (margin && margin.latest && margin.latest.marginChange != null)
    ? (margin.latest.marginChange > 0 ? 1 : margin.latest.marginChange < 0 ? -1 : 0) : 0;
  const marginColor = marginRaw >= 1 ? '#f97316' : marginRaw <= -1 ? 'var(--up)' : 'var(--muted)';
  const marginLbl   = marginRaw >= 1 ? '融資增加' : marginRaw <= -1 ? '融資減少' : '持平';
  _setSubGauge('subArcMargin', 'subTxtMargin', 'subLblMargin', marginRaw, 2, marginLbl, marginColor);

  // VIX 子分數
  const vixRaw   = vixAdj; // -2 ~ +1
  const vixColor = vixRaw >= 1 ? 'var(--up)' : vixRaw <= -1 ? 'var(--down)' : 'var(--muted)';
  const vixLbl   = !isNaN(vixVal) && vixVal > 0 ? (vixVal >= 35 ? '極度恐慌' : vixVal >= 25 ? '高波動' : vixVal <= 15 ? '低波動' : '正常') : '待載入';
  _setSubGauge('subArcVix', 'subTxtVix', 'subLblVix', vixRaw, 2, vixLbl, vixColor);

  // 載入完當日資料後，非同步補充 Supabase 歷史資料
  loadInstitutionalHistory();
  loadSignalBacktest();
  loadValuationSignal();   // ② 估值分布
  loadBetaSignal();        // ③ CAPM β 值
  } catch(e) {
    console.error('[loadMktSignals] error:', e);
  } finally {
    loadMktSignals._busy = false;
  }
}

// ── 台指選擇權：P/C Ratio + 三大法人 + Max Pain ──
async function loadOptions() {
  try {
    const res  = await fetch(API_BASE + '?endpoint=options');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error || !data.pcRatio) throw new Error(data.error || 'no data');

    document.getElementById('optLoading').style.display = 'none';
    document.getElementById('optContent').style.display = 'block';

    // ── P/C Ratio（用未平倉口數）──
    const pcOI  = data.pcRatio.oi;
    const pcVal = document.getElementById('pcRatioVal');
    const pcLbl = document.getElementById('pcRatioLabel');
    pcVal.textContent = pcOI != null ? pcOI.toFixed(2) : '—';
    let pcColor = 'var(--muted)', pcText = '中性';
    if (pcOI != null) {
      if      (pcOI >= 1.7)  { pcColor = 'var(--up)';   pcText = '強力偏多'; }
      else if (pcOI >= 1.3)  { pcColor = 'var(--up)';   pcText = '略偏多';   }
      else if (pcOI >= 1.0)  { pcColor = 'var(--muted)'; pcText = '中性';    }
      else if (pcOI >= 0.7)  { pcColor = 'var(--down)';  pcText = '略偏空';  }
      else                   { pcColor = 'var(--down)';  pcText = '強力偏空'; }
    }
    pcVal.style.color = pcColor;
    pcLbl.textContent = pcText;
    pcLbl.style.color = pcColor;
    document.getElementById('pcCallOI').textContent = data.pcRatio.callOI?.toLocaleString() || '—';
    document.getElementById('pcPutOI').textContent  = data.pcRatio.putOI?.toLocaleString()  || '—';

    // ── 三大法人（CALL淨 - PUT淨）──
    const instEl = document.getElementById('instRows');
    const inst = data.institution || {};
    instEl.innerHTML = ['外資','自營商','投信'].map(name => {
      const v = inst[name];
      if (!v || v.net == null) return '';
      const net   = v.net;
      const pos   = net >= 0;
      const color = pos ? 'var(--up)' : 'var(--down)';
      const sign  = pos ? '+' : '';
      const barW  = Math.min(100, Math.abs(net) / 3000 * 100);
      const callStr = v.call != null ? `${v.call >= 0 ? '+' : ''}${v.call.toLocaleString()}` : '—';
      const putStr  = v.put  != null ? `${v.put  >= 0 ? '+' : ''}${v.put.toLocaleString()}`  : '—';
      return `<div style="margin-bottom:0.5rem;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
          <div style="flex:1;height:7px;background:var(--surface);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;transition:width 0.6s;"></div>
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${color};font-weight:700;width:52px;text-align:right;">${sign}${net.toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:0.6rem;padding-left:42px;font-family:'IBM Plex Mono',monospace;font-size:0.57rem;color:var(--muted);">
          <span>買權 <b style="color:var(--up);">${callStr}</b></span>
          <span>賣權 <b style="color:var(--down);">${putStr}</b></span>
        </div>
      </div>`;
    }).join('');

    // ── Max Pain ──
    const mp = data.maxPain;
    document.getElementById('maxPainVal').textContent = mp ? mp.toLocaleString() : '—';

    // 距離結算日提示（台指週選，每週三結算）
    const today = new Date();
    const dow   = today.getDay(); // 0=日 3=三
    const daysToSettle = dow <= 3 ? 3 - dow : 3 + (7 - dow);
    document.getElementById('maxPainNote').textContent =
      `距本週結算 ${daysToSettle} 天 · 賣方（法人）獲利最大點`;

    document.getElementById('optTs').textContent = `資料日期：${data.date || '—'}`;
  } catch(e) {
    console.warn('loadOptions FinMind 失敗，嘗試 Supabase fallback:', e.message);
    // ── Fallback：直接從 Supabase options_daily 取最新一筆 ──
    try {
      const rows = await sbFetch('options_daily', 'order=date.desc&limit=1&select=date,pc_ratio_oi,pc_ratio_vol,foreign_opt_net');
      const row  = rows?.[0];
      if (!row) throw new Error('Supabase 也無資料');

      // 用 Supabase 資料組成最小可顯示結構
      const fallbackData = {
        date:      row.date,
        pcRatio:   { oi: row.pc_ratio_oi, volume: row.pc_ratio_vol, callOI: null, putOI: null },
        institution: { '外資': row.foreign_opt_net, '自營商': null, '投信': null },
        maxPain:   null,
        _source:   'supabase',
      };

      document.getElementById('optLoading').style.display = 'none';
      document.getElementById('optContent').style.display = 'block';

      const pcOI  = fallbackData.pcRatio.oi;
      const pcVal = document.getElementById('pcRatioVal');
      const pcLbl = document.getElementById('pcRatioLabel');
      pcVal.textContent = pcOI != null ? Number(pcOI).toFixed(2) : '—';
      let pcColor = 'var(--muted)', pcText = '中性';
      if (pcOI != null) {
        if      (pcOI >= 1.7)  { pcColor = 'var(--up)';    pcText = '強力偏多'; }
        else if (pcOI >= 1.3)  { pcColor = 'var(--up)';    pcText = '略偏多';   }
        else if (pcOI >= 1.0)  { pcColor = 'var(--muted)'; pcText = '中性';     }
        else if (pcOI >= 0.7)  { pcColor = 'var(--down)';  pcText = '略偏空';   }
        else                   { pcColor = 'var(--down)';   pcText = '強力偏空'; }
      }
      pcVal.style.color = pcColor;
      pcLbl.textContent = pcText;
      pcLbl.style.color = pcColor;
      document.getElementById('pcCallOI').textContent = '—';
      document.getElementById('pcPutOI').textContent  = '—';

      const inst = fallbackData.institution;
      const instEl = document.getElementById('instRows');
      instEl.innerHTML = ['外資','自營商','投信'].map(name => {
        const v = inst[name];
        if (!v || v.net == null) return '';
        const net   = v.net;
        const pos   = net >= 0;
        const color = pos ? 'var(--up)' : 'var(--down)';
        const sign  = pos ? '+' : '';
        const barW  = Math.min(100, Math.abs(net) / 3000 * 100);
        const callStr = v.call != null ? `${v.call >= 0 ? '+' : ''}${v.call.toLocaleString()}` : '—';
        const putStr  = v.put  != null ? `${v.put  >= 0 ? '+' : ''}${v.put.toLocaleString()}`  : '—';
        return `<div style="margin-bottom:0.5rem;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);width:36px;flex-shrink:0;">${name}</span>
            <div style="flex:1;height:7px;background:var(--surface);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${barW}%;background:${color};border-radius:2px;"></div>
            </div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:${color};font-weight:700;width:52px;text-align:right;">${sign}${net.toLocaleString()}</span>
          </div>
          <div style="display:flex;gap:0.6rem;padding-left:42px;font-family:'IBM Plex Mono',monospace;font-size:0.57rem;color:var(--muted);">
            <span>買權 <b style="color:var(--up);">${callStr}</b></span>
            <span>賣權 <b style="color:var(--down);">${putStr}</b></span>
          </div>
        </div>`;
      }).join('');

      document.getElementById('maxPainVal').textContent = '—';
      document.getElementById('maxPainNote').textContent = '（FinMind 逾時，Max Pain 暫無）';
      document.getElementById('optTs').textContent = `資料日期：${row.date}（Supabase）`;

    } catch(e2) {
      const is504 = e.message.includes('504') || e.message.includes('timeout');
      const msg   = is504 ? '選擇權資料暫時無法取得（伺服器逾時），請稍後重新整理' : `選擇權資料載入失敗：${e.message}`;
      document.getElementById('optLoading').textContent = msg;
      console.warn('loadOptions fallback 也失敗:', e2.message);
    }
  }
}

// ════════ 個股歷史走勢圖 Modal ════════

async function openStockModal(stock) {
  const modal = document.getElementById('stockModal');
  modal.classList.add('open');
  document.body.classList.add('modal-open');

  // 標題
  const sign  = stock.chgPct >= 0 ? '+' : '';
  const pct   = (stock.chgPct * 100).toFixed(2);
  const color = stock.chgPct >= 0 ? '#dc2626' : '#16a34a';  // 台股：漲=紅 跌=綠
  document.getElementById('modalStockName').textContent = `${stock.id} ${stock.name}`;
  document.getElementById('modalStockMeta').textContent = `${stock.sector} · 市值 ${stock.mcap >= 10000 ? (stock.mcap/10000).toFixed(1)+'兆' : stock.mcap.toLocaleString()+'億'}`;

  // 今日統計
  document.getElementById('modalTodayStats').innerHTML = [
    { label:'收盤', val: `$${stock.price?.toFixed(2) ?? '—'}`, color: 'var(--text)' },
    { label:'漲跌幅', val: `${sign}${pct}%`, color },
    { label:'昨收', val: `$${stock.prev?.toFixed(2) ?? '—'}`, color: 'var(--muted)' },
    { label:'漲跌', val: `${sign}${((stock.price - stock.prev) || 0).toFixed(2)}`, color },
  ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
    <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:800;color:${s.color};">${s.val}</div>
  </div>`).join('');

  // 快速連結
  document.getElementById('modalTVLink').href      = `https://tw.tradingview.com/chart/?symbol=TWSE:${stock.id}`;
  document.getElementById('modalTVLink2').href     = `https://tw.tradingview.com/chart/?symbol=TWSE:${stock.id}`;
  document.getElementById('modalGoodInfoLink').href = `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${stock.id}`;
  document.getElementById('modalAnueLink').href    = `https://www.cnyes.com/twstock/${stock.id}`;

  // AI 結果：嘗試從 sessionStorage 還原（同一股票），否則清空
  const aiResult = document.getElementById('modalAiResult');
  const aiBtn    = document.getElementById('modalAiBtn');
  if (aiResult) {
    const cached = sessionStorage.getItem(`aiResearch_${stock.id}`);
    if (cached) {
      try {
        const obj = JSON.parse(cached);
        aiResult.innerHTML = obj.html;
        aiResult.style.display = 'block';
        if (aiBtn) aiBtn.textContent = '✦ 重新生成';
      } catch(e) {
        aiResult.style.display = 'none';
        aiResult.innerHTML = '';
        if (aiBtn) aiBtn.textContent = '✦ 生成機構風格個股分析';
      }
    } else {
      aiResult.style.display = 'none';
      aiResult.innerHTML = '';
      if (aiBtn) aiBtn.textContent = '✦ 生成機構風格個股分析';
    }
  }

  // ── MIS 即時報價（盤中覆蓋昨收）──
  // isTradingHours 定義於 watchlist.js（同頁面載入）
  if (typeof isTradingHours === 'function' && isTradingHours()) {
    fetch(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stock.id}.tw&_=${Date.now()}`,
      { headers: { Referer: 'https://mis.twse.com.tw/' }, signal: AbortSignal.timeout(5000) }
    ).then(r => r.json()).then(json => {
      const row = (json.msgArray || []).find(r => r.z && r.z !== '-');
      if (!row) return;
      const price  = parseFloat(row.z);
      const prev   = parseFloat(row.y);
      const up     = parseFloat(row.u);
      const down   = parseFloat(row.w);
      if (!price || !prev) return;
      const chg    = parseFloat((price - prev).toFixed(2));
      const chgPct = parseFloat((chg / prev * 100).toFixed(2));
      const sign   = chgPct >= 0 ? '+' : '';
      const color  = chgPct >= 0 ? '#dc2626' : '#16a34a';

      // 漲跌停標記
      const limitTag = price >= up   ? '<span style="font-size:0.55rem;margin-left:4px;color:#ff9500;font-weight:700;">漲停</span>'
                     : price <= down ? '<span style="font-size:0.55rem;margin-left:4px;color:#06b6d4;font-weight:700;">跌停</span>'
                     : '';

      // 覆蓋今日統計四格
      document.getElementById('modalTodayStats').innerHTML = [
        { label:'即時價 ⚡', val: `$${price.toFixed(2)}${limitTag}`, color, raw: true },
        { label:'漲跌幅',    val: `${sign}${chgPct.toFixed(2)}%`,    color },
        { label:'昨收',      val: `$${prev.toFixed(2)}`,             color: 'var(--muted)' },
        { label:'漲跌',      val: `${sign}${chg.toFixed(2)}`,        color },
      ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
        <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:800;color:${s.color};">${s.raw ? s.val : s.val}</div>
      </div>`).join('');

      // 成交量（若有）
      const vol = parseInt(row.v);
      if (vol > 0) {
        const nameEl = document.getElementById('modalStockName');
        if (nameEl && !nameEl.querySelector('.mis-time')) {
          const timeTag = document.createElement('span');
          timeTag.className = 'mis-time';
          timeTag.style.cssText = 'font-size:0.55rem;color:var(--muted);margin-left:0.5rem;font-family:"IBM Plex Mono",monospace;font-weight:400;';
          timeTag.textContent = `${row.t} · ${(vol/1000).toFixed(0)}k張`;
          nameEl.appendChild(timeTag);
        }
      }
    }).catch(() => { /* 靜默失敗，保留昨收 */ });
  }

  // 重置顯示
  document.getElementById('modalLoading').style.display = 'block';
  document.getElementById('modalChart').style.display   = 'none';
  document.getElementById('modalNoData').style.display  = 'none';
  document.getElementById('modalTVLink').style.display  = 'inline';

  // 從 Supabase 抓歷史資料
  try {
    // stock_daily_twse 涵蓋全市場，欄位：stock_id, date, close, chg_pct, prev, volume
    const rows = await sbFetch('stock_daily_twse',
      `stock_id=eq.${stock.id}&order=date.desc&limit=60&select=date,close,chg_pct,prev`);

    if (!rows || rows.length < 2) {
      document.getElementById('modalLoading').style.display = 'none';
      document.getElementById('modalNoData').style.display  = 'block';
      document.getElementById('modalTVLink').href = `https://tw.tradingview.com/chart/?symbol=TWSE:${stock.id}`;
      return;
    }

    const data = rows.slice().reverse(); // 舊→新
    document.getElementById('modalDays').textContent    = data.length;
    document.getElementById('modalDataSource').textContent = '· Supabase';

    // 畫 bar chart
    const closes  = data.map(d => d.close);
    const minC    = Math.min(...closes);
    const maxC    = Math.max(...closes);
    const rangeC  = maxC - minC || (minC * 0.01) || 1; // 避免 range=0
    const BAR_H   = 100; // container 高度 px
    const BAR_W   = Math.max(4, Math.min(14, Math.floor(560 / data.length))); // 自動寬度 4~14px
    const GAP     = data.length > 30 ? 1 : 2;

    const barsWrap = document.getElementById('modalBars');
    barsWrap.style.overflowX = 'auto';
    barsWrap.style.overflowY = 'hidden';

    barsWrap.innerHTML = `<div style="display:flex;align-items:flex-end;gap:${GAP}px;height:${BAR_H}px;min-width:100%;">` +
      data.map((d, i) => {
        const hPct  = (d.close - minC) / rangeC * 80 + 15; // 15%~95%
        const hPx   = Math.max(4, (hPct / 100 * BAR_H)).toFixed(1);
        const isPos = d.chg_pct >= 0;
        const col   = isPos ? '#dc2626' : '#16a34a';
        const isLast = i === data.length - 1;
        const opacity = isLast ? 1 : 0.65;
        return `<div style="flex-shrink:0;width:${BAR_W}px;display:flex;flex-direction:column;justify-content:flex-end;height:${BAR_H}px;cursor:default;"
          title="${d.date}\n$${d.close}\n${isPos?'+':''}${(d.chg_pct*100).toFixed(2)}%">
          <div style="height:${hPx}px;background:${col};border-radius:2px 2px 0 0;opacity:${opacity};
            ${isLast?`outline:1.5px solid ${col};outline-offset:-1px;`:''}"
            onmouseover="this.style.opacity=1" onmouseout="this.style.opacity='${opacity}'"></div>
        </div>`;
      }).join('') + '</div>';

    // 日期軸（每5天顯示一次，貼著 bars 底部）
    document.getElementById('modalBarDates').innerHTML =
      `<div style="display:flex;gap:${GAP}px;">` +
      data.map((d, i) =>
        `<div style="flex-shrink:0;width:${BAR_W}px;font-family:'IBM Plex Mono',monospace;font-size:0.4rem;color:var(--muted);text-align:center;overflow:hidden;">
          ${i % 5 === 0 ? d.date.slice(5) : ''}
        </div>`
      ).join('') + '</div>';

    // 統計摘要
    const chgPcts  = data.map(d => d.chg_pct * 100);
    const upDays   = chgPcts.filter(p => p >= 0).length;
    const maxGain  = Math.max(...chgPcts).toFixed(2);
    const maxLoss  = Math.min(...chgPcts).toFixed(2);
    const totalChg = ((data[data.length-1].close - data[0].close) / data[0].close * 100).toFixed(2);

    document.getElementById('modalStats').innerHTML = [
      { label:`${data.length}日累積漲跌`, val:`${totalChg >= 0 ? '+':''}${totalChg}%`, color: totalChg >= 0 ? '#dc2626' : '#16a34a' },
      { label:'上漲天數', val:`${upDays} / ${data.length}`, color:'var(--accent2)' },
      { label:'單日最大漲/跌', val:`+${maxGain}% / ${maxLoss}%`, color:'var(--muted)' },
    ].map(s => `<div style="background:var(--surface);border-radius:8px;padding:0.5rem 0.7rem;box-shadow:0 0 0 1px var(--border);">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);">${s.label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;font-weight:700;color:${s.color};margin-top:2px;">${s.val}</div>
    </div>`).join('');

    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalChart').style.display   = 'block';

  } catch(e) {
    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalNoData').style.display  = 'block';
    console.warn('stockModal error:', e);
  }
}

function closeStockModal() {
  document.getElementById('stockModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  // AI 結果不清空，保留在 DOM 供再次開啟時顯示
  const aiBtn = document.getElementById('modalAiBtn');
  if (aiBtn) aiBtn.disabled = false;
}

// ── AI 個股快速研究（機構研究框架）──
async function runStockAI() {
  const btn      = document.getElementById('modalAiBtn');
  const resultEl = document.getElementById('modalAiResult');
  if (!btn || !resultEl) return;

  // 取得當前個股資訊（從 modal 標題讀取）
  const nameEl = document.getElementById('modalStockName');
  const metaEl = document.getElementById('modalStockMeta');
  const statsEl= document.getElementById('modalTodayStats');
  if (!nameEl) return;

  const stockTitle = nameEl.textContent.trim();  // e.g. "2330 台積電"
  const stockMeta  = metaEl?.textContent.trim() || '';
  // 從 stats 抓數字
  const statsText  = statsEl?.innerText?.replace(/\n/g,' ') || '';

  // 取估值資料（已在 data 陣列裡，透過 heatmapData 找）
  const stockId = stockTitle.split(' ')[0];
  const hmData  = heatmapData || [];
  const stockData = hmData.find(r => r.id === stockId) || {};
  const valInfo = stockData.per > 0
    ? `本益比 ${stockData.per.toFixed(1)}x（${stockData.valLabel}）、殖利率 ${stockData.dy?.toFixed(2)||'N/A'}%、PBR ${stockData.pbr?.toFixed(2)||'N/A'}x`
    : '估值資料暫無';

  // 取近期走勢資訊（從 modal bars 的 title 屬性）
  const bars = document.querySelectorAll('#modalBars [title]');
  const recentDays = Array.from(bars).slice(-5).map(b => b.title).join('、') || '走勢資料暫無';

  btn.disabled = true;
  btn.textContent = '⏳ 分析中…';
  resultEl.style.display = 'none';

  // 機構研究框架 prompt（參考 equity-research LSEG SKILL.md）
  const prompt = `你是台灣股市資深研究員，擅長從機構研究角度分析個股。請用繁體中文對以下股票進行快速研究分析（200-250字），嚴格按照此框架：

【基本資料】${stockTitle}｜${stockMeta}
【今日行情】${statsText}
【估值指標】${valInfo}
【近5日走勢】${recentDays}

請依序輸出以下五段（每段一行，加粗標題）：
**催化劑 Catalyst**：該股近期最可能的驅動事件或題材
**基本面 Fundamentals**：本益比合理性、獲利成長性評估
**價格動能 Momentum**：近期走勢強弱、與大盤相對表現
**風險因子 Risk**：需警惕的下行風險（地緣/產業/公司層面）
**投資論點 Thesis**：共識預期是否有誤判空間（where might consensus be wrong）

語氣專業、數據具體、避免空話。結尾加一行免責聲明：⚠ 本分析為 AI 生成，僅供參考，不構成投資建議。`;

  try {
    const text = await callGroq(prompt, 900, 0.65);
    // 加時間戳
    const now = new Date();
    const ts  = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false,
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tsHtml = `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);margin-bottom:0.5rem;opacity:0.75;">◆ AI 生成｜${ts}</div>`;
    const bodyHtml = text.replace(/\n/g, '<br>');
    resultEl.innerHTML = tsHtml + bodyHtml;
    resultEl.style.display = 'block';
    btn.textContent = '✦ 重新生成';
    btn.disabled = false;
    // 存入 sessionStorage（跨同一 session 保留）
    sessionStorage.setItem(`aiResearch_${stockId}`, JSON.stringify({ html: resultEl.innerHTML, ts }));
  } catch(e) {
    resultEl.textContent = `分析失敗：${e.message}`;
    resultEl.style.display = 'block';
    btn.textContent = '✦ 生成機構風格個股分析';
    btn.disabled = false;
  }
}

// ESC 關閉 modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStockModal();
});

