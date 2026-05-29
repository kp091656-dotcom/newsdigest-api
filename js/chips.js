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

    // ── 近N日趨勢圖 ──
    try {
      const histRes  = await fetch('/api/news?endpoint=chips&limit=10&order=date.desc');
      const histJson = await histRes.json();
      const histRaw  = histJson.data || [];
      const chartEl  = document.getElementById('chips-trend-chart');

      if (chartEl && histRaw.length >= 2) {
        const rows = [...histRaw].reverse(); // 舊→新
        const n = rows.length;

        function makeChipSvg(title, seriesDef) {
          const W=320, H=90, PL=38, PR=8, PT=18, PB=20;
          const cW=W-PL-PR, cH=H-PT-PB;
          const allVals = rows.flatMap(r => seriesDef.map(s => r[s.key] ?? 0));
          const vMin = Math.min(0, ...allVals), vMax = Math.max(0, ...allVals);
          const vRange = vMax - vMin || 1;
          const xPos = i => PL + (i / Math.max(n-1,1)) * cW;
          const yPos = v => PT + cH - ((v - vMin) / vRange) * cH;
          const zero = yPos(0);

          const gridVals = [vMin, 0, vMax].filter((v,i,a) => a.indexOf(v)===i);
          const gridLines = gridVals.map(gv => {
            const gy = yPos(gv).toFixed(1);
            const lbl = Math.abs(gv) >= 1000 ? `${(gv/1000).toFixed(1)}K` : `${gv}`;
            return `<line x1="${PL}" y1="${gy}" x2="${W-PR}" y2="${gy}" stroke="var(--border)" stroke-width="0.6"/>
                    <text x="${PL-3}" y="${parseFloat(gy)+3.5}" font-family="IBM Plex Mono,monospace" font-size="6" fill="var(--muted)" text-anchor="end">${lbl}</text>`;
          }).join('');

          const xIdx = [0, Math.floor((n-1)/2), n-1].filter((v,i,a) => a.indexOf(v)===i);
          const xLabels = xIdx.map(i =>
            `<text x="${xPos(i).toFixed(1)}" y="${H-3}" font-family="IBM Plex Mono,monospace" font-size="6" fill="var(--muted)" text-anchor="middle">${rows[i]?.date?.slice(5)||''}</text>`
          ).join('');

          const lines = seriesDef.map(s => {
            const pts  = rows.map((r,i) => `${xPos(i).toFixed(1)},${yPos(r[s.key]??0).toFixed(1)}`).join(' ');
            const dots = rows.map((r,i) => `<circle cx="${xPos(i).toFixed(1)}" cy="${yPos(r[s.key]??0).toFixed(1)}" r="2" fill="${s.color}"/>`).join('');
            return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
          }).join('');

          const legend = seriesDef.map((s,i) =>
            `<g transform="translate(${PL + i*72},0)">
              <line x1="0" y1="4" x2="10" y2="4" stroke="${s.color}" stroke-width="1.5"/>
              <circle cx="5" cy="4" r="2" fill="${s.color}"/>
              <text x="13" y="7.5" font-family="IBM Plex Mono,monospace" font-size="7" fill="var(--muted)">${s.label}</text>
            </g>`
          ).join('');

          return `
            <div style="background:var(--surface);border-radius:12px;padding:0.9rem 1rem;box-shadow:0 0 0 1px var(--border-dark);margin-bottom:0.75rem;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:0.08em;margin-bottom:0.4rem;">${title}<span style="margin-left:6px;font-size:0.5rem;opacity:0.6;">近 ${n} 日 · 口數</span></div>
              <svg viewBox="0 0 ${W} ${H+14}" width="100%" style="display:block;overflow:visible;">
                <g transform="translate(0,2)">${legend}</g>
                <line x1="${PL}" y1="${zero.toFixed(1)}" x2="${W-PR}" y2="${zero.toFixed(1)}" stroke="var(--border-dark)" stroke-width="0.8" stroke-dasharray="3,2"/>
                ${gridLines}
                ${lines}
                ${xLabels}
              </svg>
            </div>`;
        }

        chartEl.innerHTML =
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--accent);border-left:2px solid var(--accent);padding-left:8px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.75rem;">近期趨勢</div>` +
          makeChipSvg('📈 台指期 TX 三大法人淨口', [
            { key: 'fut_tx_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'fut_tx_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'fut_tx_dealer_net',  label: '自營', color: '#10b981' },
          ]) +
          makeChipSvg('▲ 選擇權 CALL 三大法人淨口', [
            { key: 'opt_call_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'opt_call_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'opt_call_dealer_net',  label: '自營', color: '#10b981' },
          ]) +
          makeChipSvg('▼ 選擇權 PUT 三大法人淨口', [
            { key: 'opt_put_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'opt_put_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'opt_put_dealer_net',  label: '自營', color: '#10b981' },
          ]);
      }
    } catch(chartErr) {
      console.warn('[chips trend] 圖表載入失敗：', chartErr.message);
    }

  } catch (e) {
    console.warn('[chips] 載入失敗：', e.message);
    const loadingEl = document.getElementById('chips-loading');
    if (loadingEl) loadingEl.textContent = '載入失敗';
  }
}
