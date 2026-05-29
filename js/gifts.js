// ════════ 台股熱圖（Squarified Treemap）════════
let heatmapData = [];

// 產業色票（用於邊框/標籤區分，不影響漲跌底色）
const SECTOR_COLORS = {
  // 科技族群
  '半導體':   '#3b82f6',
  'IC設計':   '#6366f1',
  '記憶體':   '#8b5cf6',
  '電子製造': '#f59e0b',
  '電子零件': '#fbbf24',
  '光學':     '#f97316',
  '網通':     '#fb923c',
  '工業電腦': '#ef4444',
  '電腦':     '#f87171',
  '數位雲端': '#60a5fa',
  // 傳產/金融
  '金融':     '#10b981',
  '電信':     '#34d399',
  '石化':     '#6b7280',
  '塑膠':     '#78716c',
  '鋼鐵':     '#9ca3af',
  '機電':     '#a8a29e',
  '汽車':     '#84cc16',
  '航運':     '#38bdf8',
  // 民生/其他
  '零售':     '#a3e635',
  '食品':     '#facc15',
  '紡織':     '#fb7185',
  '橡膠':     '#c084fc',
  '生技醫療': '#4ade80',
  '建材營造': '#d97706',
  '觀光':     '#e879f9',
  '油電燃氣': '#94a3b8',
  '綠能環保': '#86efac',
};
const DEFAULT_SECTOR_COLOR = '#94a3b8';

// TWSE 官方產業指數名稱 → SECTOR_COLORS key 對應表
const SECTOR_INDEX_MAP = {
  '半導體類指數':   '半導體',
  'IC設計類指數':   'IC設計',
  '記憶體類指數':   '記憶體',
  '電子製造服務業類指數': '電子製造',
  '電子零組件類指數': '電子零件',
  '光電業類指數':   '光學',
  '通信網路業類指數': '網通',
  '電腦及週邊設備業類指數': '電腦',
  '資訊服務業類指數': '電腦',  // fallback 到電腦
  '工業電腦及週邊設備業類指數': '工業電腦',
  '金融保險業類指數': '金融',
  '電信業類指數':   '電信',
  '化學工業類指數': '石化',
  '石油煤炭類指數': '石化',
  '鋼鐵工業類指數': '鋼鐵',
  '汽車工業類指數': '汽車',
  '百貨貿易類指數': '零售',
  '貿易百貨業類指數': '零售',
  '食品工業類指數': '食品',
  '紡織纖維類指數': '紡織',
  '橡膠工業類指數': '橡膠',
};
// 反向：SECTOR_COLORS key → 官方指數名（找 SECTOR_INDEX_MAP 第一個符合的）
// 用於 bar 顯示

function showGifts() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('giftsTab').classList.add('active');
  ['newsFeed','loadMoreBtn','sentimentPanel','futuresPanel','heatmapPanel','signalPanel','screenerPanel'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const fh = document.querySelector('.feed-header'); if (fh) fh.style.display = 'none';
  document.getElementById('giftsPanel').style.display = 'block';
  if (!_giftsData) loadGifts();
  else reRenderGifts();
}

async function loadGifts() {
  try {
    const r = await fetch('/api/news?endpoint=gifts&show_past=1&nocache=1', { signal: AbortSignal.timeout(8000) });
    _giftsData = r.ok ? await r.json() : [];
    reRenderGifts();
  } catch(e) {
    document.getElementById('giftsGrid').innerHTML = `<div class="gifts-empty"><div class="gifts-empty-icon">⚠️</div>無法載入紀念品資料<br><span style="font-size:0.65rem">${e.message}</span></div>`;
  }
}

function reRenderGifts() {
  if (!_giftsData) return;
  const showPast = document.getElementById('giftShowPast')?.checked;
  const today = new Date(Date.now() + 8*3600000).toISOString().slice(0,10);

  const showEgift = document.getElementById('giftShowEgift')?.checked;
  let data = _giftsData
    .filter(g => _giftCat ? g.gift_category === _giftCat : true)
    .filter(g => showEgift ? g.is_egift : true)
    .filter(g => showPast ? true : g.record_date >= today);

  // Sort
  if (_giftSort === 'deadline') data.sort((a,b) => (a.record_date||'') < (b.record_date||'') ? -1 : 1);
  if (_giftSort === 'cp')       data.sort((a,b) => (b.cp_ratio||0) - (a.cp_ratio||0));
  if (_giftSort === 'val')      data.sort((a,b) => (b.gift_value_est||0) - (a.gift_value_est||0));

  // Stats
  const total    = data.length;
  const upcoming = data.filter(g => g.record_date >= today).length;
  const soonList = data.filter(g => { const d = daysUntilDate(g.record_date); return d >= 0 && d <= 14; });
  const avgCP    = data.filter(g=>g.cp_ratio>0).reduce((s,g,_,a)=>s+g.cp_ratio/a.length,0);
  const egiftCount = _giftsData.filter(g => g.is_egift).length;
  document.getElementById('giftStatTotal').innerHTML  = `共 <strong>${total}</strong> 筆`;
  document.getElementById('giftStatSoon').innerHTML   = `本月截止 <strong>${soonList.length}</strong> 筆`;
  document.getElementById('giftStatEgift').innerHTML  = `⚡ eGift <strong>${egiftCount}</strong> 家`;
  document.getElementById('giftStatAvgCP').innerHTML  = avgCP>0 ? `平均CP <strong>${avgCP.toFixed(2)}%</strong>` : `平均CP <strong>—</strong>`;

  if (!data.length) {
    document.getElementById('giftsGrid').innerHTML = `<div class="gifts-empty"><div class="gifts-empty-icon">🎁</div>目前無符合條件的紀念品</div>`;
    return;
  }
  document.getElementById('giftsGrid').innerHTML = data.map(giftCard).join('');
}

function daysUntilDate(dateStr) {
  if (!dateStr) return -999;
  const today = new Date(Date.now() + 8*3600000);
  today.setUTCHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00Z');
  return Math.round((target - today) / 86400000);
}

// 持股門檻顯示：以股為單位，整千股顯示為張
function fmtShares(n) {
  const s = parseInt(n) || 1000;
  if (s >= 1000 && s % 1000 === 0) return `${s/1000}張（${s.toLocaleString()}股）以上`;
  return `${s.toLocaleString()}股以上`;
}

const CAT_META = {
  food:    { icon:'🍱', label:'食品',     cls:'cat-icon-food'    },
  goods:   { icon:'🧴', label:'日用品',   cls:'cat-icon-goods'   },
  voucher: { icon:'🎫', label:'儲值卡',   cls:'cat-icon-voucher' },
  cash:    { icon:'💵', label:'現金等值', cls:'cat-icon-cash'    },
  '3c':    { icon:'📱', label:'3C',       cls:'cat-icon-3c'      },
  other:   { icon:'🎁', label:'其他',     cls:'cat-icon-other'   },
};
function catMeta(c) { return CAT_META[c] || CAT_META.other; }

function giftCard(g) {
  const days   = daysUntilDate(g.record_date);
  const isPast = days < 0;
  const meta   = catMeta(g.gift_category);
  const cp     = g.cp_ratio ? parseFloat(g.cp_ratio) : null;
  const cpCls  = cp == null ? '' : cp >= 2 ? 'cp-high' : cp < 0.5 ? 'cp-low' : '';
  const cpStr  = cp != null ? `CP ${cp.toFixed(2)}%` : 'CP —';

  let urgency = '', deadlineBadge = '';
  if (isPast) {
    urgency = 'gc-past';
    deadlineBadge = `<span class="gift-deadline-badge gdl-past">● 已截止</span>`;
  } else if (days <= 7) {
    urgency = 'gc-urgent';
    deadlineBadge = `<span class="gift-deadline-badge gdl-urgent">● ${days === 0 ? '今天截止！' : days + '天後截止'}</span>`;
  } else if (days <= 30) {
    urgency = 'gc-soon';
    deadlineBadge = `<span class="gift-deadline-badge gdl-soon">● ${days}天後截止</span>`;
  } else {
    deadlineBadge = `<span class="gift-deadline-badge gdl-ok">● ${days}天後截止</span>`;
  }

  const valStr = g.gift_value_est ? `NT$${Number(g.gift_value_est).toLocaleString()}` : '—';
  const refStr = g.share_price_ref ? `NT$${Number(g.share_price_ref).toFixed(1)}` : '—';

  return `
<div class="gift-card ${urgency}${g.is_egift ? ' gc-egift' : ''}">
  <div class="gift-card-head">
    <div>
      <div class="gift-stock-id">${g.stock_id || '—'}</div>
      <div class="gift-stock-name">${g.stock_name || '—'}</div>
      ${deadlineBadge}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;">
      <span class="gift-cp-badge ${cpCls}">${cpStr}</span>
      ${g.is_egift ? '<span class="gift-egift-badge">⚡ eGift</span>' : ''}
      <span class="gift-sector-tag ${meta.cls}">${meta.icon} ${meta.label}</span>
      ${g.sector ? `<span class="gift-sector-tag">${g.sector}</span>` : ''}
    </div>
  </div>
  <div class="gift-card-body">
    <div class="gift-desc"><span class="gift-desc-icon">${meta.icon}</span><span>${g.gift_desc || '—'}</span></div>
  </div>
  <div class="gift-card-foot">
    <div class="gift-foot-item"><span class="gift-foot-label">停止過戶</span><span class="gift-foot-val">${g.record_date || '—'}</span></div>
    <div class="gift-foot-item"><span class="gift-foot-label">股東會日期</span><span class="gift-foot-val">${g.meeting_date || '—'}</span></div>
    <div class="gift-foot-item"><span class="gift-foot-label">禮品估值</span><span class="gift-foot-val">${valStr}</span></div>
    <div class="gift-foot-item"><span class="gift-foot-label">持有門檻</span><span class="gift-foot-val">${fmtShares(g.share_required)}</span></div>
    <div class="gift-foot-item"><span class="gift-foot-label">參考股價</span><span class="gift-foot-val">${refStr}</span></div>
    ${g.source_url ? `<div class="gift-foot-item"><a href="${g.source_url}" target="_blank" style="font-size:0.6rem;color:var(--accent);text-decoration:none;">來源 →</a></div>` : '<div></div>'}
  </div>
  ${g.note ? `<div class="gift-note">※ ${g.note}</div>` : ''}
</div>`;
}

function setGiftCat(btn, cat) {
  document.querySelectorAll('.gift-cat-btn').forEach(b => b.classList.remove('gc-active'));
  btn.classList.add('gc-active');
  _giftCat = cat;
  reRenderGifts();
}

function setGiftSort(s) {
  _giftSort = s;
  document.querySelectorAll('.gifts-sort-btn').forEach(b => b.classList.remove('gs-active'));
  document.getElementById('gsort' + s.charAt(0).toUpperCase() + s.slice(1))?.classList.add('gs-active');
  reRenderGifts();
}

