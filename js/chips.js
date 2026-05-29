// ════════ 籌碼面板 ════════
let _chipsPanelLoaded = false;

async function loadChipsPanel() {
  // 只在首次載入，避免重複請求
  if (_chipsPanelLoaded) return;
  const loadingEl = document.getElementById('chips-loading');

  try {
    const res  = await fetch('/api/news?endpoint=chips&limit=1');
    const json = await res.json();
    const d    = (json.data || [])[0];
    if (!d) { if (loadingEl) loadingEl.textContent = '暫無資料'; return; }
    if (loadingEl) loadingEl.textContent = '';
    _chipsPanelLoaded = true;

    const dateEl = document.getElementById('chips-date');
    if (dateEl) dateEl.textContent = d.date;

    // ── 格式化函式（沿用網站現有風格）──
    const mono = "font-family:'IBM Plex Mono',monospace;";
    const fmtBil = (v) => {
      if (v == null) return `<span style="${mono}color:var(--muted);">—</span>`;
      const n = parseFloat(v), c = n > 0 ? 'var(--up)' : n < 0 ? 'var(--down)' : 'var(--muted)';
      return `<span style="${mono}color:${c};font-weight:700;">${n > 0 ? '+' : ''}${n.toFixed(2)}</span>`;
    };
    const fmtInt = (v) => {
      if (v == null) return `<span style="${mono}color:var(--muted);">—</span>`;
      const n = parseInt(v), c = n > 0 ? 'var(--up)' : n < 0 ? 'var(--down)' : 'var(--muted)';
      return `<span style="${mono}color:${c};font-weight:700;">${n > 0 ? '+' : ''}${n.toLocaleString()}</span>`;
    };
    const fmtGray = (v, isInt = true) => {
      if (v == null) return `<span style="${mono}color:var(--muted);">—</span>`;
      const n = isInt ? parseInt(v) : parseFloat(v);
      return `<span style="${mono}color:var(--muted);">${isInt ? n.toLocaleString() : n.toFixed(2)}</span>`;
    };

    const tdStyle  = "padding:5px 6px;border-bottom:1px solid rgba(42,42,66,0.35);";
    const tdR      = tdStyle + "text-align:right;";
    const hlStyle  = "background:rgba(99,102,241,0.05);";

    const tr4 = (label, c1, c2, c3, hl=false) =>
      `<tr style="${hl ? hlStyle : ''}">
        <td style="${tdStyle}color:var(--text);font-size:0.68rem;">${label}</td>
        <td style="${tdR}font-size:0.68rem;">${c1}</td>
        <td style="${tdR}font-size:0.68rem;">${c2}</td>
        <td style="${tdR}font-size:0.68rem;">${c3}</td>
       </tr>`;
    const tr2 = (label, c1, hl=false) =>
      `<tr style="${hl ? hlStyle : ''}">
        <td style="${tdStyle}color:var(--text);font-size:0.68rem;">${label}</td>
        <td style="${tdR}font-size:0.68rem;">${c1}</td>
       </tr>`;

    // 現貨
    const sb = document.getElementById('chips-spot-body');
    if (sb) sb.innerHTML =
      tr4('外資及陸資', fmtGray(d.spot_foreign_buy,false), fmtGray(d.spot_foreign_sell,false), fmtBil(d.spot_foreign_net), true) +
      tr4('投信',       fmtGray(d.spot_trust_buy,  false), fmtGray(d.spot_trust_sell,  false), fmtBil(d.spot_trust_net)) +
      tr4('自營商',     fmtGray(d.spot_dealer_buy, false), fmtGray(d.spot_dealer_sell, false), fmtBil(d.spot_dealer_net));
    const st = document.getElementById('chips-spot-total');
    if (st) st.innerHTML = fmtBil(d.spot_total_net) + `<span style="font-size:0.55rem;color:var(--muted);margin-left:3px;">億</span>`;

    // TX 台指期
    const tb = document.getElementById('chips-tx-body');
    if (tb) tb.innerHTML =
      tr4('外資及陸資', fmtGray(d.fut_tx_foreign_long), fmtGray(d.fut_tx_foreign_short), fmtInt(d.fut_tx_foreign_net), true) +
      tr4('投信',       fmtGray(d.fut_tx_trust_long),   fmtGray(d.fut_tx_trust_short),   fmtInt(d.fut_tx_trust_net)) +
      tr4('自營商',     fmtGray(d.fut_tx_dealer_long),  fmtGray(d.fut_tx_dealer_short),  fmtInt(d.fut_tx_dealer_net));
    const tt = document.getElementById('chips-tx-total');
    if (tt) tt.innerHTML = fmtInt(d.fut_tx_total_net) + `<span style="font-size:0.55rem;color:var(--muted);margin-left:3px;">口</span>`;

    // MTX 小台
    const mb = document.getElementById('chips-mtx-body');
    if (mb) mb.innerHTML =
      tr2('外資及陸資', fmtInt(d.fut_mtx_foreign_net), true) +
      tr2('投信',       fmtInt(d.fut_mtx_trust_net)) +
      tr2('自營商',     fmtInt(d.fut_mtx_dealer_net));
    const mt = document.getElementById('chips-mtx-total');
    if (mt) mt.innerHTML = fmtInt(d.fut_mtx_total_net) + `<span style="font-size:0.55rem;color:var(--muted);margin-left:3px;">口</span>`;

    // TMF 微台
    const tfb = document.getElementById('chips-tmf-body');
    if (tfb) tfb.innerHTML =
      tr2('外資及陸資', fmtInt(d.fut_tmf_foreign_net), true) +
      tr2('投信',       fmtInt(d.fut_tmf_trust_net)) +
      tr2('自營商',     fmtInt(d.fut_tmf_dealer_net));
    const tft = document.getElementById('chips-tmf-total');
    if (tft) tft.innerHTML = fmtInt(d.fut_tmf_total_net) + `<span style="font-size:0.55rem;color:var(--muted);margin-left:3px;">口</span>`;

    // CALL
    const cb = document.getElementById('chips-call-body');
    if (cb) cb.innerHTML =
      tr4('外資及陸資', fmtGray(d.opt_call_foreign_long), fmtGray(d.opt_call_foreign_short), fmtInt(d.opt_call_foreign_net), true) +
      tr4('投信',       fmtGray(d.opt_call_trust_long),   fmtGray(d.opt_call_trust_short),   fmtInt(d.opt_call_trust_net)) +
      tr4('自營商',     fmtGray(d.opt_call_dealer_long),  fmtGray(d.opt_call_dealer_short),  fmtInt(d.opt_call_dealer_net));

    // PUT
    const pb = document.getElementById('chips-put-body');
    if (pb) pb.innerHTML =
      tr4('外資及陸資', fmtGray(d.opt_put_foreign_long), fmtGray(d.opt_put_foreign_short), fmtInt(d.opt_put_foreign_net), true) +
      tr4('投信',       fmtGray(d.opt_put_trust_long),   fmtGray(d.opt_put_trust_short),   fmtInt(d.opt_put_trust_net)) +
      tr4('自營商',     fmtGray(d.opt_put_dealer_long),  fmtGray(d.opt_put_dealer_short),  fmtInt(d.opt_put_dealer_net));

  } catch (e) {
    console.warn('[chips] 載入失敗：', e.message);
    const loadingEl = document.getElementById('chips-loading');
    if (loadingEl) loadingEl.textContent = '載入失敗';
  }
}
