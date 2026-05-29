// ════════════════════════════════════════
// 🤖 Alpha 交易員
// ════════════════════════════════════════

let alphaPendingCloseId = null;

const MOOD_STYLE = {
  '樂觀': { bg: 'rgba(220,38,38,0.12)',  color: 'var(--up)',   border: 'rgba(220,38,38,0.3)' },
  '中性': { bg: 'rgba(148,163,184,0.12)', color: 'var(--muted)', border: 'rgba(148,163,184,0.25)' },
  '謹慎': { bg: 'rgba(251,191,36,0.12)',  color: '#d97706',   border: 'rgba(251,191,36,0.35)' },
  '悲觀': { bg: 'rgba(22,163,74,0.12)',   color: 'var(--down)', border: 'rgba(22,163,74,0.3)' },
};
const ACTION_STYLE = {
  '買進': { bg: 'rgba(220,38,38,0.07)',  color: 'var(--up)',   border: 'rgba(220,38,38,0.2)' },
  '觀察': { bg: 'rgba(110,110,126,0.07)', color: 'var(--muted)', border: 'rgba(110,110,126,0.18)' },
  '避開': { bg: 'rgba(22,163,74,0.07)',  color: 'var(--down)', border: 'rgba(22,163,74,0.2)' },
};
const CONF_STYLE = { '高': 'var(--up)', '中': '#d97706', '低': 'var(--down)' };

function _alphaBadge(el, text, bgColor, textColor) {
  el.textContent = text;
  el.style.background = bgColor;
  el.style.color = textColor;
}

function _alphaTodayStr() {
  return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    .replace(/\//g, '-')
    .replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
}

// ── 持倉浮動損益（從 Supabase 抓最新收盤）──
async function _alphaFetchLatestPrices(stockIds) {
  if (!stockIds || !stockIds.length) return {};
  try {
    const dateRes = await sbFetch('stock_daily_twse', 'order=date.desc&limit=1&select=date');
    const latestDate = Array.isArray(dateRes) && dateRes[0]?.date ? dateRes[0].date : null;
    if (!latestDate) return {};
    const rows = await sbFetch('stock_daily_twse',
      `date=eq.${latestDate}&stock_id=in.(${stockIds.join(',')})&select=stock_id,close`);
    const map = {};
    if (Array.isArray(rows)) rows.forEach(r => { map[r.stock_id] = { close: r.close, date: latestDate }; });
    return map;
  } catch { return {}; }
}

// 頁面載入時自動讀取今日報告
async function loadAlphaDailyReport() {
  const badge   = document.getElementById('alphaStatusBadge');
  const loading = document.getElementById('alphaLoading');
  loading.style.display = 'block';
  _alphaBadge(badge, '載入中', 'rgba(99,102,241,0.15)', '#818cf8');
  try {
    const res = await fetch(`${API_BASE}?endpoint=alpha_report&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const today   = _alphaTodayStr();
    const isToday = data.report_date === today;
    await renderAlphaResult(data);
    _alphaBadge(badge,
      isToday ? '✓ 今日報告' : `報告：${data.report_date}`,
      isToday ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
      isToday ? '#22c55e' : '#d97706');
    const dateBadge = document.getElementById('alphaDateBadge');
    if (!isToday) {
      dateBadge.textContent = `⚠️ 非今日報告（${data.report_date}）`;
      dateBadge.style.display = 'inline';
      dateBadge.style.color = '#d97706';
    } else {
      dateBadge.style.display = 'none';
    }
  } catch(e) {
    _alphaBadge(badge, '尚無報告', 'rgba(148,163,184,0.15)', 'var(--muted)');
    document.getElementById('alphaRecommendations').innerHTML =
      `<div style="color:var(--muted);font-size:0.85rem;padding:1.5rem;text-align:center;">今日報告尚未生成<br><span style="font-size:0.75rem;opacity:0.55;">每個交易日 08:05 自動更新</span></div>`;
  } finally {
    loading.style.display = 'none';
  }
}

// 手動刷新（Owner 限定）
async function alphaAnalyze() {
  if (!isOwnerUnlocked()) { alert('需要 Owner 身份才能手動刷新'); return; }
  const btn     = document.getElementById('alphaBtn');
  const loading = document.getElementById('alphaLoading');
  const badge   = document.getElementById('alphaStatusBadge');
  const loadTxt = document.getElementById('alphaLoadingText');
  btn.disabled = true; btn.textContent = '分析中…';
  document.getElementById('alphaMarketSummary').style.display = 'none';
  document.getElementById('alphaRecommendations').innerHTML = '';
  document.getElementById('alphaDateBadge').style.display = 'none';
  _alphaBadge(badge, '分析中', 'rgba(99,102,241,0.15)', '#818cf8');

  const steps = ['正在抓取市場資料…', '分析新聞與社群情緒…', 'AI 生成交易建議…', '最終校正與儲存…'];
  let si = 0;
  loadTxt.textContent = steps[0];
  loading.style.display = 'block';
  const timer = setInterval(() => { si = Math.min(si+1, steps.length-1); loadTxt.textContent = steps[si]; }, 7000);

  try {
    const ownerToken = getOwnerToken();
    const res = await fetch(`${API_BASE}?endpoint=alpha_analyze`, {
      headers: { 'x-owner-token': ownerToken }
    });
    clearInterval(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    await renderAlphaResult(data);
    _alphaBadge(badge, '✓ 手動分析完成', 'rgba(34,197,94,0.15)', '#22c55e');
  } catch(e) {
    clearInterval(timer);
    _alphaBadge(badge, '錯誤', 'rgba(239,68,68,0.15)', '#ef4444');
    document.getElementById('alphaRecommendations').innerHTML =
      `<div style="color:var(--muted);font-size:0.85rem;padding:1rem;">Alpha 分析失敗：${e.message}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = '🔄 手動刷新';
    loading.style.display = 'none';
  }
}

async function renderAlphaResult(data) {
  // ── 市場情緒 badge ──
  const mood = data.market_mood || '中性';
  const ms   = MOOD_STYLE[mood] || MOOD_STYLE['中性'];
  const moodBadge = document.getElementById('alphaMoodBadge');
  moodBadge.textContent = mood;
  moodBadge.style.cssText = `font-size:0.7rem;padding:2px 9px;border-radius:99px;font-weight:600;background:${ms.bg};color:${ms.color};border:1px solid ${ms.border};`;

  // 生成時間
  const genTime = document.getElementById('alphaGenTime');
  genTime.textContent = data.generated_at
    ? new Date(data.generated_at).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  // 市場摘要（支援段落換行）
  document.getElementById('alphaMarketText').textContent = data.market_summary || '';

  // ── 新增：主導者 / 散戶訊號 / 空手建議 / 融資警示 ──
  const metaBar = document.getElementById('alphaMetaBar');
  if (metaBar) {
    const dominant = data.dominant_player || '';
    const retail   = data.retail_signal  || '';
    const margin   = data.margin_alert   || '';
    const cashSug  = data.suggest_cash;
    const cashRsn  = data.cash_reason    || '';

    const dominantColor = dominant.includes('外資') ? 'var(--up)' : dominant.includes('散戶') ? 'var(--down)' : 'var(--accent)';
    const retailColor   = retail.includes('警戒') ? 'var(--down)' : retail.includes('機會') ? 'var(--up)' : 'var(--muted)';
    const marginColor   = margin.includes('危機') ? 'var(--down)' : margin.includes('注意') ? '#d97706' : 'var(--muted)';

    metaBar.innerHTML = [
      dominant ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${dominantColor};font-weight:600;">👤 ${dominant}</span>` : '',
      retail   ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${retailColor};font-weight:600;">散戶：${retail}</span>` : '',
      margin   ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:rgba(128,128,128,0.1);color:${marginColor};font-weight:600;">融資：${margin}</span>` : '',
    ].filter(Boolean).join('');
    metaBar.style.display = metaBar.innerHTML ? 'flex' : 'none';

    // 空手建議橫幅
    const cashBar = document.getElementById('alphaCashBar');
    if (cashBar) {
      if (cashSug) {
        cashBar.innerHTML = `<span style="font-size:0.75rem;font-weight:700;color:#d97706;">💰 今日建議空手觀望</span><span style="font-size:0.65rem;color:var(--muted);margin-left:0.5rem;">${cashRsn}</span>`;
        cashBar.style.display = 'flex';
      } else {
        cashBar.style.display = 'none';
      }
    }
  }

  // Alpha 警語
  const noteEl = document.getElementById('alphaNote');
  if (data.alpha_note) {
    noteEl.textContent = `💬 ${data.alpha_note}`;
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }

  // 資料來源 badge
  const src = data.data_sources || {};
  const srcEl = document.getElementById('alphaDataSources');
  const srcParts = [];
  if (src.stocks) srcParts.push(`${src.stocks} 支股票`);
  if (src.news)   srcParts.push(`${src.news} 則新聞`);
  if (src.ptt)    srcParts.push(`PTT×${src.ptt}`);
  srcEl.textContent = srcParts.join(' · ') || '多來源';

  document.getElementById('alphaMarketSummary').style.display = 'block';

  // ── 抓最新收盤（買進個股）──
  const buyIds = (data.recommendations || []).filter(r => r.action === '買進').map(r => r.stock_id);
  const priceMap = await _alphaFetchLatestPrices(buyIds);

  // ── 推薦個股卡片 ──
  const container = document.getElementById('alphaRecommendations');
  container.innerHTML = '';
  for (const rec of (data.recommendations || [])) {
    const as    = ACTION_STYLE[rec.action] || ACTION_STYLE['觀察'];
    const isBuy = rec.action === '買進';
    const latest = priceMap[rec.stock_id];

    // 浮動損益進度條（僅買進）
    let floatHtml = '';
    if (isBuy && latest && rec.entry_price) {
      const close     = latest.close;
      const floatPct  = ((close - rec.entry_price) / rec.entry_price * 100);
      const floatClr  = floatPct >= 0 ? 'var(--up)' : 'var(--down)';
      const floatSign = floatPct >= 0 ? '+' : '';
      const lo  = rec.stop_loss    || (rec.entry_price * 0.94);
      const hi  = rec.target_price || (rec.entry_price * 1.10);
      const range = hi - lo;
      const barPct  = range > 0 ? Math.max(0, Math.min(100, (close - lo) / range * 100)) : 50;
      const entryPct = range > 0 ? Math.max(0, Math.min(100, (rec.entry_price - lo) / range * 100)) : 50;
      floatHtml = `
        <div style="margin:0.55rem 0 0.3rem;padding:0.5rem 0.7rem;background:rgba(0,0,0,0.03);border-radius:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">
            <span style="font-size:0.72rem;color:var(--muted);">現價 <b style="color:var(--text);">${close}</b>
              <span style="margin-left:0.35rem;color:${floatClr};font-weight:700;">${floatSign}${floatPct.toFixed(2)}%</span>
            </span>
            <span style="font-size:0.63rem;color:var(--muted);">${latest.date} 收盤</span>
          </div>
          <div style="position:relative;height:6px;background:rgba(22,163,74,0.15);border-radius:3px;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${barPct.toFixed(1)}%;background:${floatClr};border-radius:3px;transition:width 0.5s;"></div>
            <div style="position:absolute;top:-2px;height:10px;width:2px;background:var(--muted);border-radius:1px;left:${entryPct.toFixed(1)}%;" title="進場價"></div>
            <div style="position:absolute;top:-3px;left:calc(${barPct.toFixed(1)}% - 5px);width:10px;height:10px;border-radius:50%;background:${floatClr};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:left 0.5s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.3rem;font-size:0.62rem;color:var(--muted);">
            <span style="color:var(--down);">停損 ${rec.stop_loss ?? '-'}</span>
            <span>進場 ${rec.entry_price ?? '-'}</span>
            <span style="color:var(--up);">目標 ${rec.target_price ?? '-'}</span>
          </div>
        </div>`;
    }

    const card = document.createElement('div');
    card.style.cssText = `background:${as.bg};border:1px solid ${as.border};border-radius:12px;padding:0.9rem 1.1rem;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.55rem;flex-wrap:wrap;">
        <span style="font-weight:700;font-size:0.95rem;color:var(--text);">${rec.stock_id} ${rec.stock_name || ''}</span>
        <span style="font-size:0.68rem;padding:2px 8px;border-radius:99px;background:${as.bg};color:${as.color};border:1px solid ${as.border};font-weight:600;">${rec.action}</span>
        <span style="font-size:0.68rem;padding:2px 7px;border-radius:99px;background:var(--bg);color:var(--muted);border:1px solid var(--border);">${rec.style || ''}</span>
        <span style="font-size:0.55rem;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.1);color:var(--accent);font-weight:500;">${rec.signal_source || ''}</span>
        ${(()=>{
          const confMap = { '高': { score: 9, color: 'var(--up)', label: '高' }, '中': { score: 6, color: '#d97706', label: '中' }, '低': { score: 3, color: 'var(--down)', label: '低' } };
          const c = confMap[rec.confidence] || { score: 5, color: 'var(--muted)', label: rec.confidence || '-' };
          const r = 9; const circ = 2 * Math.PI * r;
          const dash = (c.score / 10 * circ).toFixed(1);
          return `<span title="信心度 ${c.score}/10" style="display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">
            <svg width="28" height="28" viewBox="0 0 28 28" style="display:block;">
              <circle cx="14" cy="14" r="${r}" fill="none" stroke="rgba(128,128,128,0.15)" stroke-width="2.5"/>
              <circle cx="14" cy="14" r="${r}" fill="none" stroke="${c.color}" stroke-width="2.5"
                stroke-dasharray="${dash} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>
              <text x="14" y="18" text-anchor="middle" font-size="7.5" font-weight="700" fill="${c.color}" font-family="inherit">${c.score}</text>
            </svg>
            <span style="font-size:0.62rem;color:${c.color};font-weight:600;">${c.label}</span>
          </span>`;
        })()}
        ${rec.expected_return_pct != null ? `<span style="font-size:0.75rem;color:var(--up);font-weight:700;margin-left:auto;">預期 +${rec.expected_return_pct}%</span>` : ''}
      </div>
      ${!isBuy ? `<div style="display:flex;gap:1.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:0.5rem;flex-wrap:wrap;">
        <span>進場 <b style="color:var(--text);">${rec.entry_price ?? '-'}</b></span>
        <span>目標 <b style="color:var(--up);">${rec.target_price ?? '-'}</b></span>
        <span>停損 <b style="color:var(--down);">${rec.stop_loss ?? '-'}</b></span>
        <span>持有 <b style="color:var(--text);">${rec.holding_days ?? '-'} 天</b></span>
      </div>` : ''}
      ${isBuy ? floatHtml : ''}
      <div style="font-size:0.82rem;color:var(--text);line-height:1.65;margin:0.5rem 0;">${rec.reason || ''}</div>
      <div style="font-size:0.74rem;color:#d97706;padding:0.3rem 0.6rem;background:rgba(251,191,36,0.09);border-radius:6px;">⚠️ ${rec.risk || ''}</div>
      ${isBuy ? `
      <div style="margin-top:0.65rem;padding-top:0.6rem;border-top:1px solid ${as.border};display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <span style="font-size:0.73rem;color:var(--up);font-weight:600;">✅ Alpha 已自動進場</span>
        <span style="font-size:0.68rem;color:var(--muted);">· 計畫持有 ${rec.holding_days ?? '-'} 天</span>
      </div>` : ''}
    `;
    container.appendChild(card);
  }
}

function alphaOpenCloseModal(id, stockId, stockName, entryPrice, currentClose) {
  alphaPendingCloseId = id;
  document.getElementById('alphaExitPriceInput').value = currentClose || '';
  const infoEl = document.getElementById('alphaCloseInfo');
  if (stockId) {
    const floatPct = (currentClose && entryPrice) ? ((currentClose - entryPrice) / entryPrice * 100) : null;
    const floatStr = floatPct != null ? `　浮動 <b style="color:${floatPct>=0?'var(--up)':'var(--down)'};">${floatPct>=0?'+':''}${floatPct.toFixed(2)}%</b>` : '';
    infoEl.innerHTML = `${stockId} ${stockName || ''}　進場 ${entryPrice ?? '-'}${floatStr}`;
  } else { infoEl.textContent = ''; }
  document.getElementById('alphaCloseModal').style.display = 'flex';
}

async function alphaConfirmClose() {
  const exitPrice = parseFloat(document.getElementById('alphaExitPriceInput').value);
  if (!exitPrice || exitPrice <= 0) { alert('請輸入有效出場價格'); return; }
  const ownerToken = getOwnerToken();
  try {
    const res = await fetch(`${API_BASE}?endpoint=alpha_positions&action=close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-owner-token': ownerToken },
      body: JSON.stringify({ id: alphaPendingCloseId, exit_price: exitPrice }),
    });
    const data = await res.json();
    document.getElementById('alphaCloseModal').style.display = 'none';
    const pnl = data.pnl; const pct = data.pnl_pct;
    alert(`平倉完成\n損益：${pnl >= 0 ? '+' : ''}${(pnl||0).toLocaleString()} 元（${pct >= 0 ? '+' : ''}${(pct||0).toFixed(2)}%）`);
    showAlphaReport();
  } catch(e) { alert(`平倉失敗：${e.message}`); }
}

async function showAlphaReport() {
  const modal = document.getElementById('alphaReportModal');
  const cont  = document.getElementById('alphaReportContent');
  modal.style.display = 'block';
  cont.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">載入中…</div>';
  const ownerToken = getOwnerToken();

  try {
    const [openRes, closedRes] = await Promise.all([
      fetch(`${API_BASE}?endpoint=alpha_positions&action=list&status=open`,   { headers: { 'x-owner-token': ownerToken } }),
      fetch(`${API_BASE}?endpoint=alpha_positions&action=list&status=closed`, { headers: { 'x-owner-token': ownerToken } }),
    ]);
    const open   = (await openRes.json()).data   || [];
    const closed = (await closedRes.json()).data || [];

    // ── 最新收盤（open positions）──
    const openIds = open.map(p => p.stock_id);
    const latestPrices = await _alphaFetchLatestPrices(openIds);

    // ── 統計 ──
    const wins     = closed.filter(p => (p.pnl||0) > 0).length;
    const losses   = closed.filter(p => (p.pnl||0) <= 0).length;
    const totalPnl = closed.reduce((s,p) => s+(p.pnl||0), 0);
    const winRate  = closed.length ? (wins/closed.length*100).toFixed(1) : '-';
    const avgPct   = closed.length ? (closed.reduce((s,p)=>s+(p.pnl_pct||0),0)/closed.length).toFixed(2) : '-';
    const maxWin   = closed.length ? Math.max(...closed.map(p=>p.pnl||0)) : 0;
    const maxLoss  = closed.length ? Math.min(...closed.map(p=>p.pnl||0)) : 0;

    // 最大連勝/連敗
    let maxStreak = 0, maxLoseStreak = 0, curW = 0, curL = 0;
    const sortedClosed = [...closed].sort((a,b) => new Date(a.closed_at)-new Date(b.closed_at));
    for (const p of sortedClosed) {
      if ((p.pnl||0) > 0) { curW++; curL=0; maxStreak=Math.max(maxStreak,curW); }
      else { curL++; curW=0; maxLoseStreak=Math.max(maxLoseStreak,curL); }
    }

    // 累積損益曲線
    let cum = 0;
    const cumData = sortedClosed.map(p => { cum += (p.pnl||0); return { date: p.closed_at?.slice(0,10), pnl: cum, label: p.stock_id }; });

    // 個別損益排序（按 pnl_pct 高→低）
    const sortedByPct = [...closed].sort((a,b) => (b.pnl_pct||0)-(a.pnl_pct||0));

    const renderOpenRow = (p) => {
      const lat = latestPrices[p.stock_id];
      const close = lat?.close;
      const fp = close && p.entry_price ? ((close-p.entry_price)/p.entry_price*100) : null;
      const fc = fp != null ? (fp>=0?'var(--up)':'var(--down)') : 'var(--muted)';
      const days = p.opened_at ? Math.floor((Date.now()-new Date(p.opened_at))/86400000) : '-';
      return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem;">
        <td style="padding:0.45rem 0.35rem;font-weight:600;">${p.stock_id}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.stock_name||''}</td>
        <td style="padding:0.45rem 0.35rem;">${p.entry_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--up);">${p.target_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--down);">${p.stop_loss??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${close??'–'}</td>
        <td style="padding:0.45rem 0.35rem;color:${fc};font-weight:600;">${fp!=null?(fp>=0?'+':'')+fp.toFixed(2)+'%':'–'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${days}天</td>
        <td style="padding:0.45rem 0.35rem;">
          <button onclick="alphaOpenCloseModal(${p.id},'${p.stock_id}','${(p.stock_name||'').replace(/'/g,'')}',${p.entry_price||0},${close||0})"
            style="font-size:0.7rem;padding:2px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);cursor:pointer;color:var(--text);">平倉</button>
        </td>
      </tr>`;
    };

    const renderClosedRow = (p) => {
      const pc = (p.pnl||0)>=0?'var(--up)':'var(--down)';
      const pt = `${(p.pnl||0)>=0?'+':''}${(p.pnl||0).toLocaleString()} (${(p.pnl_pct||0)>=0?'+':''}${(p.pnl_pct||0).toFixed(2)}%)`;
      const days = (p.opened_at&&p.closed_at) ? Math.round((new Date(p.closed_at)-new Date(p.opened_at))/86400000) : '-';
      return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem;">
        <td style="padding:0.45rem 0.35rem;font-weight:600;">${p.stock_id}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.stock_name||''}</td>
        <td style="padding:0.45rem 0.35rem;">${p.entry_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--up);">${p.target_price??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--down);">${p.stop_loss??'-'}</td>
        <td style="padding:0.45rem 0.35rem;color:${pc};font-weight:700;">${pt}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);">${days !== '-' ? days+'天' : '-'}</td>
        <td style="padding:0.45rem 0.35rem;color:var(--muted);white-space:nowrap;">${p.closed_at?new Date(p.closed_at).toLocaleDateString('zh-TW'):''}</td>
      </tr>`;
    };

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-bottom:1.1rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${totalPnl>=0?'var(--up)':'var(--down)'};">${totalPnl>=0?'+':''}${totalPnl.toLocaleString()}</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">累計損益（元）</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${parseFloat(winRate)>=50?'var(--up)':'var(--down)'};">${winRate}%</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">${wins}勝 ${losses}敗</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;color:${parseFloat(avgPct)>=0?'var(--up)':'var(--down)'};">${parseFloat(avgPct)>=0?'+':''}${avgPct}%</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">平均報酬率</div>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.7rem;text-align:center;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:700;">${open.length}</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:0.2rem;">持倉中</div>
        </div>
      </div>

      ${closed.length >= 2 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">📈 累積損益曲線</div>
          <canvas id="alphaCumChart" height="120"></canvas>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">📊 個別交易損益（按報酬率排序）</div>
          <canvas id="alphaBarChart" height="120"></canvas>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.5rem;">🥧 勝率分布</div>
          <canvas id="alphaWinChart" height="110" style="max-width:140px;"></canvas>
        </div>
        <div style="background:var(--surface);border-radius:10px;padding:0.85rem;border:1px solid var(--border);">
          <div style="font-size:0.73rem;font-weight:600;margin-bottom:0.6rem;">🏆 績效紀錄</div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大獲利</span><b style="color:var(--up);">+${maxWin.toLocaleString()} 元</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大虧損</span><b style="color:var(--down);">${maxLoss.toLocaleString()} 元</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大連勝</span><b>${maxStreak} 次</b></div>
          <div style="font-size:0.8rem;margin-bottom:0.35rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">最大連敗</span><b>${maxLoseStreak} 次</b></div>
          <div style="font-size:0.8rem;display:flex;justify-content:space-between;"><span style="color:var(--muted);">總交易次數</span><b>${closed.length} 次</b></div>
        </div>
      </div>` : closed.length === 1 ? `
      <div style="background:var(--surface);border-radius:10px;padding:0.8rem;border:1px solid var(--border);margin-bottom:0.75rem;font-size:0.8rem;color:var(--muted);text-align:center;">累積 2 筆以上平倉後將顯示圖表分析</div>` : ''}

      ${open.length ? `
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.4rem;">📂 持倉中（${open.length}）</div>
      <div style="overflow-x:auto;margin-bottom:1rem;">
        <table style="width:100%;border-collapse:collapse;min-width:580px;">
          <thead><tr style="font-size:0.68rem;color:var(--muted);border-bottom:2px solid var(--border);">
            <th style="padding:0.4rem 0.35rem;text-align:left;">代號</th><th style="padding:0.4rem 0.35rem;text-align:left;">名稱</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">進場</th><th style="padding:0.4rem 0.35rem;text-align:left;">目標</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">停損</th><th style="padding:0.4rem 0.35rem;text-align:left;">現價</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">浮動</th><th style="padding:0.4rem 0.35rem;text-align:left;">持有</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">操作</th>
          </tr></thead>
          <tbody>${open.map(p => renderOpenRow(p)).join('')}</tbody>
        </table>
      </div>` : ''}

      ${closed.length ? `
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.4rem;">📜 歷史交易（${closed.length}）</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:560px;">
          <thead><tr style="font-size:0.68rem;color:var(--muted);border-bottom:2px solid var(--border);">
            <th style="padding:0.4rem 0.35rem;text-align:left;">代號</th><th style="padding:0.4rem 0.35rem;text-align:left;">名稱</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">進場</th><th style="padding:0.4rem 0.35rem;text-align:left;">目標</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">停損</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">損益</th><th style="padding:0.4rem 0.35rem;text-align:left;">持有天</th>
            <th style="padding:0.4rem 0.35rem;text-align:left;">平倉日</th>
          </tr></thead>
          <tbody>${closed.map(p => renderClosedRow(p)).join('')}</tbody>
        </table>
      </div>` : ''}

      ${!open.length && !closed.length ? `<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.85rem;">Alpha 尚無交易紀錄<br><span style="font-size:0.75rem;opacity:0.55;">每個交易日 08:05 自動生成報告並進場</span></div>` : ''}
      <div style="font-size:0.62rem;color:var(--muted);margin-top:1.2rem;text-align:center;padding-top:0.8rem;border-top:1px solid var(--border);">⚠️ 以上為 AI 模擬交易紀錄，不構成投資建議</div>
    `;

    // ── 繪製圖表 ──
    if (closed.length >= 2) {
      if (!window.Chart) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#6e6e7e';
      const gridC = 'rgba(0,0,0,0.06)';
      const ax    = { ticks: { color: muted, font: { size: 9 } }, grid: { color: gridC } };

      // 累積損益曲線（含 0 基準線）
      new window.Chart(document.getElementById('alphaCumChart'), {
        type: 'line',
        data: {
          labels: cumData.map(d => d.date),
          datasets: [{
            data: cumData.map(d => d.pnl),
            borderColor: totalPnl >= 0 ? '#dc2626' : '#16a34a',
            backgroundColor: totalPnl >= 0 ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.07)',
            fill: true, tension: 0.35, pointRadius: 3,
            pointBackgroundColor: cumData.map(d => d.pnl >= 0 ? '#dc2626' : '#16a34a'),
            pointHoverRadius: 5,
          }],
        },
        plugins: [{
          id: 'zeroLine',
          afterDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!scales.y) return;
            const y0 = scales.y.getPixelForValue(0);
            if (y0 < chartArea.top || y0 > chartArea.bottom) return;
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
            ctx.setLineDash([4,3]); ctx.beginPath();
            ctx.moveTo(chartArea.left, y0); ctx.lineTo(chartArea.right, y0); ctx.stroke(); ctx.restore();
          }
        }],
        options: {
          responsive: true,
          plugins: { legend: { display: false }, tooltip: { callbacks: {
            title: ctx => `${ctx[0].label}　${cumData[ctx[0].dataIndex]?.label||''}`,
            label: ctx => `累積損益：${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toLocaleString()} 元`,
          }}},
          scales: { x: ax, y: { ...ax, ticks: { ...ax.ticks, callback: v => `${v>=0?'+':''}${(v/1000).toFixed(0)}K` } } },
        },
      });

      // 個別損益（按 pnl_pct 排序）
      new window.Chart(document.getElementById('alphaBarChart'), {
        type: 'bar',
        data: {
          labels: sortedByPct.map(p => p.stock_id),
          datasets: [{ data: sortedByPct.map(p => p.pnl_pct||0),
            backgroundColor: sortedByPct.map(p => (p.pnl||0)>=0?'rgba(220,38,38,0.75)':'rgba(22,163,74,0.75)'), borderRadius: 3 }],
        },
        options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: ctx => `${ctx[0].label} ${sortedByPct[ctx[0].dataIndex]?.stock_name||''}`,
          label: ctx => [`報酬率：${ctx.parsed.y>=0?'+':''}${ctx.parsed.y.toFixed(2)}%`,
            `損益：${(sortedByPct[ctx[0].dataIndex]?.pnl||0)>=0?'+':''}${(sortedByPct[ctx[0].dataIndex]?.pnl||0).toLocaleString()} 元`],
        }}},
        scales: { x: ax, y: { ...ax, ticks: { ...ax.ticks, callback: v => `${v>=0?'+':''}${v}%` } } } },
      });

      // 勝率圓餅
      new window.Chart(document.getElementById('alphaWinChart'), {
        type: 'doughnut',
        data: { labels: ['獲利','虧損'], datasets: [{ data: [wins, losses],
          backgroundColor: ['rgba(220,38,38,0.8)','rgba(22,163,74,0.8)'], borderWidth: 0 }] },
        options: { responsive: true, cutout: '60%', plugins: {
          legend: { display: true, position: 'bottom', labels: { color: muted, font: { size: 9 }, boxWidth: 10, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}：${ctx.parsed} 次` } },
        }},
      });
    }

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;padding:1rem;">載入失敗：${e.message}</div>`;
  }
}

function initAlphaIfNeeded() { if (!window._alphaLoaded) { window._alphaLoaded = true; loadAlphaDailyReport(); } }

function toggleAlphaBacktest() {
  const p = document.getElementById('alphaBacktestPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

// ════════ 多空訊號回測（Supabase）════════


