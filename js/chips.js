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

    // ── 近N日趨勢圖（Canvas + Hover Tooltip）──
    try {
      const histRes  = await fetch('/api/news?endpoint=chips&limit=10&order=date.desc');
      const histJson = await histRes.json();
      const histRaw  = histJson.data || [];
      const chartEl  = document.getElementById('chips-trend-chart');

      if (chartEl && histRaw.length >= 2) {
        const rows = [...histRaw].reverse(); // 舊→新
        const n = rows.length;
        const DPR = window.devicePixelRatio || 1;

        // ── Canvas 折線圖生成器 ──
        function makeCanvasChart(containerId, title, unit, seriesDef, ySymmetric = true) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'background:var(--surface);border-radius:12px;padding:0.9rem 1rem;box-shadow:0 0 0 1px var(--border-dark);margin-bottom:0.75rem;position:relative;';

          // 標題
          const ttl = document.createElement('div');
          ttl.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:0.08em;margin-bottom:0.5rem;";
          ttl.innerHTML = `${title} <span style="font-size:0.5rem;opacity:0.6;">近 ${n} 日 · ${unit}</span>`;
          wrap.appendChild(ttl);

          // 圖例
          const lgd = document.createElement('div');
          lgd.style.cssText = 'display:flex;gap:1rem;margin-bottom:0.5rem;';
          seriesDef.forEach(s => {
            lgd.innerHTML += `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:16px;height:2px;background:${s.color};border-radius:1px;vertical-align:middle;"></span>
              <span style="display:inline-block;width:6px;height:6px;background:${s.color};border-radius:50%;margin-left:-10px;vertical-align:middle;"></span>
              ${s.label}</span>`;
          });
          wrap.appendChild(lgd);

          // Canvas
          const canvas = document.createElement('canvas');
          const cssW = wrap.parentElement ? wrap.parentElement.clientWidth - 32 : 320;
          const cssH = 110;
          canvas.width  = Math.max(cssW, 280) * DPR;
          canvas.height = cssH * DPR;
          canvas.style.width  = '100%';
          canvas.style.height = cssH + 'px';
          canvas.style.display = 'block';
          wrap.appendChild(canvas);

          // Tooltip div
          const tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;background:rgba(15,15,30,0.92);border:1px solid var(--border-dark);border-radius:8px;padding:6px 10px;font-family:"IBM Plex Mono",monospace;font-size:0.58rem;color:var(--text);pointer-events:none;display:none;z-index:10;min-width:100px;';
          wrap.appendChild(tip);

          const PL = 44 * DPR, PR = 10 * DPR, PT = 8 * DPR, PB = 22 * DPR;
          const cW = canvas.width - PL - PR;
          const cH = canvas.height - PT - PB;

          // Y 軸：對稱（取絕對值最大後兩邊等距）
          const allVals = rows.flatMap(r => seriesDef.map(s => r[s.key] ?? 0));
          const absMax = Math.max(...allVals.map(Math.abs), 1);
          const vMax = ySymmetric ? absMax : Math.max(0, ...allVals);
          const vMin = ySymmetric ? -absMax : Math.min(0, ...allVals);
          const vRange = vMax - vMin || 1;

          const xPos = i => PL + (i / Math.max(n - 1, 1)) * cW;
          const yPos = v => PT + cH - ((v - vMin) / vRange) * cH;

          function fmtVal(v, u) {
            if (u === '口數') return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString() + ' 口';
            return (v >= 0 ? '+' : '') + v.toFixed(2) + ' 億';
          }

          function draw(hoverIdx = -1) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const cs = getComputedStyle(document.documentElement);
            const colBorder  = cs.getPropertyValue('--border').trim()      || '#2a2a42';
            const colBorderD = cs.getPropertyValue('--border-dark').trim() || '#3a3a5c';
            const colMuted   = cs.getPropertyValue('--muted').trim()       || '#6e6e9e';
            const colText    = cs.getPropertyValue('--text').trim()        || '#e2e2ec';

            // 格線：-max, 0, +max
            [-absMax, 0, absMax].forEach(gv => {
              const gy = yPos(gv);
              ctx.beginPath();
              ctx.strokeStyle = gv === 0 ? colBorderD : colBorder;
              ctx.lineWidth = gv === 0 ? 1.5 * DPR : 0.8 * DPR;
              if (gv === 0) { ctx.setLineDash([4 * DPR, 3 * DPR]); } else { ctx.setLineDash([]); }
              ctx.moveTo(PL, gy); ctx.lineTo(canvas.width - PR, gy);
              ctx.stroke();
              ctx.setLineDash([]);

              // Y 軸標籤
              const lbl = Math.abs(gv) >= 1000 ? `${(gv/1000).toFixed(1)}K` : `${Math.round(gv)}`;
              ctx.fillStyle = colMuted;
              ctx.font = `${9 * DPR}px "IBM Plex Mono",monospace`;
              ctx.textAlign = 'right';
              ctx.fillText(lbl, PL - 4 * DPR, gy + 3.5 * DPR);
            });

            // X 軸標籤（每個日期都顯示）
            ctx.fillStyle = colMuted;
            ctx.font = `${8 * DPR}px "IBM Plex Mono",monospace`;
            ctx.textAlign = 'center';
            rows.forEach((r, i) => {
              const lbl = (r.date || '').slice(5);
              const x = xPos(i);
              // 避免首尾溢出
              const align = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
              ctx.textAlign = align;
              ctx.fillText(lbl, x, PT + cH + 16 * DPR);
            });

            // hover 垂直線
            if (hoverIdx >= 0) {
              const hx = xPos(hoverIdx);
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(160,160,220,0.25)';
              ctx.lineWidth = 1 * DPR;
              ctx.setLineDash([3 * DPR, 3 * DPR]);
              ctx.moveTo(hx, PT); ctx.lineTo(hx, PT + cH);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // 折線 + 節點
            seriesDef.forEach(s => {
              const pts = rows.map((r, i) => ({ x: xPos(i), y: yPos(r[s.key] ?? 0) }));

              // 線
              ctx.beginPath();
              ctx.strokeStyle = s.color;
              ctx.lineWidth = 2 * DPR;
              ctx.lineJoin = 'round';
              ctx.lineCap  = 'round';
              pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
              ctx.stroke();

              // 節點
              pts.forEach((p, i) => {
                const isHov = i === hoverIdx;
                ctx.beginPath();
                ctx.arc(p.x, p.y, (isHov ? 5 : 3) * DPR, 0, Math.PI * 2);
                ctx.fillStyle = isHov ? s.color : s.color;
                ctx.fill();
                if (isHov) {
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 1.5 * DPR;
                  ctx.stroke();
                }
              });
            });
          }

          draw();

          // Hover 互動
          canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * DPR;
            // 找最近的 x index
            let closest = 0, minDist = Infinity;
            rows.forEach((_, i) => {
              const dist = Math.abs(xPos(i) - mouseX);
              if (dist < minDist) { minDist = dist; closest = i; }
            });
            if (minDist > 30 * DPR) { draw(); tip.style.display = 'none'; return; }

            draw(closest);
            const r = rows[closest];
            tip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px;">${r.date}</div>` +
              seriesDef.map(s => {
                const v = r[s.key] ?? 0;
                const c = v > 0 ? '#ef4444' : v < 0 ? '#22c55e' : 'var(--muted)';
                return `<div style="display:flex;justify-content:space-between;gap:12px;">
                  <span style="color:${s.color};">● ${s.label}</span>
                  <span style="color:${c};font-weight:700;">${fmtVal(v, unit)}</span>
                </div>`;
              }).join('');

            // tooltip 位置
            const tipX = e.clientX - rect.left;
            const tipY = e.clientY - rect.top;
            tip.style.display = 'block';
            tip.style.left = (tipX > rect.width / 2 ? tipX - 115 : tipX + 12) + 'px';
            tip.style.top  = Math.max(0, tipY - 20) + 'px';
          });

          canvas.addEventListener('mouseleave', () => { draw(); tip.style.display = 'none'; });

          return wrap;
        }

        // ── 現貨累積買賣超圖（面積圖）──
        function makeCumulativeChart(title) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'background:var(--surface);border-radius:12px;padding:0.9rem 1rem;box-shadow:0 0 0 1px var(--border-dark);margin-bottom:0.75rem;position:relative;';

          const ttl = document.createElement('div');
          ttl.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:0.08em;margin-bottom:0.5rem;";
          ttl.innerHTML = `${title} <span style="font-size:0.5rem;opacity:0.6;">近 ${n} 日累積 · 億元</span>`;
          wrap.appendChild(ttl);

          const lgd = document.createElement('div');
          lgd.style.cssText = 'display:flex;gap:1rem;margin-bottom:0.5rem;';
          const cumSeries = [
            { label: '外資', color: '#6366f1', key: 'spot_foreign_net' },
            { label: '投信', color: '#f59e0b', key: 'spot_trust_net' },
            { label: '自營', color: '#10b981', key: 'spot_dealer_net' },
          ];
          cumSeries.forEach(s => {
            lgd.innerHTML += `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:16px;height:2px;background:${s.color};border-radius:1px;vertical-align:middle;"></span>
              <span style="display:inline-block;width:6px;height:6px;background:${s.color};border-radius:50%;margin-left:-10px;vertical-align:middle;"></span>
              ${s.label}</span>`;
          });
          wrap.appendChild(lgd);

          // 計算累積值
          const cumRows = rows.map((r, i) => {
            const obj = { date: r.date };
            cumSeries.forEach(s => {
              const dailyVals = rows.slice(0, i + 1).map(rr => parseFloat(rr[s.key] ?? 0));
              obj[s.key] = dailyVals.reduce((a, b) => a + b, 0);
            });
            return obj;
          });

          const canvas = document.createElement('canvas');
          const cssW = wrap.parentElement ? wrap.parentElement.clientWidth - 32 : 320;
          const cssH = 110;
          canvas.width  = Math.max(cssW, 280) * DPR;
          canvas.height = cssH * DPR;
          canvas.style.width  = '100%';
          canvas.style.height = cssH + 'px';
          canvas.style.display = 'block';
          wrap.appendChild(canvas);

          const tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;background:rgba(15,15,30,0.92);border:1px solid var(--border-dark);border-radius:8px;padding:6px 10px;font-family:"IBM Plex Mono",monospace;font-size:0.58rem;color:var(--text);pointer-events:none;display:none;z-index:10;min-width:110px;';
          wrap.appendChild(tip);

          const PL = 44 * DPR, PR = 10 * DPR, PT = 8 * DPR, PB = 22 * DPR;
          const cW = canvas.width - PL - PR;
          const cH = canvas.height - PT - PB;

          const allCum = cumRows.flatMap(r => cumSeries.map(s => r[s.key]));
          const absMax = Math.max(...allCum.map(Math.abs), 1);
          const vMax = absMax, vMin = -absMax, vRange = vMax - vMin;
          const xPos = i => PL + (i / Math.max(n - 1, 1)) * cW;
          const yPos = v => PT + cH - ((v - vMin) / vRange) * cH;

          function drawCum(hoverIdx = -1) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const cs = getComputedStyle(document.documentElement);
            const colBorder  = cs.getPropertyValue('--border').trim()      || '#2a2a42';
            const colBorderD = cs.getPropertyValue('--border-dark').trim() || '#3a3a5c';
            const colMuted   = cs.getPropertyValue('--muted').trim()       || '#6e6e9e';

            // 格線
            [-absMax, 0, absMax].forEach(gv => {
              const gy = yPos(gv);
              ctx.beginPath();
              ctx.strokeStyle = gv === 0 ? colBorderD : colBorder;
              ctx.lineWidth = gv === 0 ? 1.5 * DPR : 0.8 * DPR;
              if (gv === 0) ctx.setLineDash([4 * DPR, 3 * DPR]); else ctx.setLineDash([]);
              ctx.moveTo(PL, gy); ctx.lineTo(canvas.width - PR, gy);
              ctx.stroke();
              ctx.setLineDash([]);
              const lbl = Math.abs(gv) >= 1 ? `${gv >= 0 ? '+' : ''}${gv.toFixed(0)}億` : '0';
              ctx.fillStyle = colMuted;
              ctx.font = `${8.5 * DPR}px "IBM Plex Mono",monospace`;
              ctx.textAlign = 'right';
              ctx.fillText(lbl, PL - 4 * DPR, gy + 3.5 * DPR);
            });

            // X 軸標籤
            ctx.fillStyle = colMuted;
            ctx.font = `${8 * DPR}px "IBM Plex Mono",monospace`;
            cumRows.forEach((r, i) => {
              const lbl = (r.date || '').slice(5);
              ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
              ctx.fillText(lbl, xPos(i), PT + cH + 16 * DPR);
            });

            if (hoverIdx >= 0) {
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(160,160,220,0.25)';
              ctx.lineWidth = 1 * DPR;
              ctx.setLineDash([3 * DPR, 3 * DPR]);
              ctx.moveTo(xPos(hoverIdx), PT); ctx.lineTo(xPos(hoverIdx), PT + cH);
              ctx.stroke(); ctx.setLineDash([]);
            }

            // 面積 + 折線
            cumSeries.forEach(s => {
              const pts = cumRows.map((r, i) => ({ x: xPos(i), y: yPos(r[s.key]) }));
              const zero = yPos(0);

              // 半透明面積
              ctx.beginPath();
              ctx.moveTo(pts[0].x, zero);
              pts.forEach(p => ctx.lineTo(p.x, p.y));
              ctx.lineTo(pts[pts.length - 1].x, zero);
              ctx.closePath();
              ctx.fillStyle = s.color + '22';
              ctx.fill();

              // 折線
              ctx.beginPath();
              ctx.strokeStyle = s.color;
              ctx.lineWidth = 2 * DPR;
              ctx.lineJoin = 'round'; ctx.lineCap = 'round';
              pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
              ctx.stroke();

              // 節點
              pts.forEach((p, i) => {
                const isHov = i === hoverIdx;
                ctx.beginPath();
                ctx.arc(p.x, p.y, (isHov ? 5 : 3) * DPR, 0, Math.PI * 2);
                ctx.fillStyle = s.color; ctx.fill();
                if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * DPR; ctx.stroke(); }
              });
            });
          }

          drawCum();

          canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * DPR;
            let closest = 0, minDist = Infinity;
            cumRows.forEach((_, i) => {
              const dist = Math.abs(xPos(i) - mouseX);
              if (dist < minDist) { minDist = dist; closest = i; }
            });
            if (minDist > 30 * DPR) { drawCum(); tip.style.display = 'none'; return; }
            drawCum(closest);
            const r = cumRows[closest];
            tip.innerHTML = `<div style="color:var(--muted);margin-bottom:4px;">${r.date} 累積</div>` +
              cumSeries.map(s => {
                const v = r[s.key];
                const c = v > 0 ? '#ef4444' : v < 0 ? '#22c55e' : 'var(--muted)';
                return `<div style="display:flex;justify-content:space-between;gap:12px;">
                  <span style="color:${s.color};">● ${s.label}</span>
                  <span style="color:${c};font-weight:700;">${v >= 0 ? '+' : ''}${v.toFixed(1)} 億</span>
                </div>`;
              }).join('');
            const tipX = e.clientX - rect.left;
            const tipY = e.clientY - rect.top;
            tip.style.display = 'block';
            tip.style.left = (tipX > rect.width / 2 ? tipX - 125 : tipX + 12) + 'px';
            tip.style.top  = Math.max(0, tipY - 20) + 'px';
          });
          canvas.addEventListener('mouseleave', () => { drawCum(); tip.style.display = 'none'; });

          return wrap;
        }

        // ── 組裝所有圖表 ──
        chartEl.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--accent);border-left:2px solid var(--accent);padding-left:8px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.75rem;";
        header.textContent = '近期趨勢';
        chartEl.appendChild(header);

        chartEl.appendChild(makeCumulativeChart('🏢 三大法人現貨買賣超'));

        chartEl.appendChild(makeCanvasChart('tx', '📈 台指期 TX 三大法人淨口', '口數', [
          { key: 'fut_tx_foreign_net', label: '外資', color: '#6366f1' },
          { key: 'fut_tx_trust_net',   label: '投信', color: '#f59e0b' },
          { key: 'fut_tx_dealer_net',  label: '自營', color: '#10b981' },
        ]));
        chartEl.appendChild(makeCanvasChart('call', '▲ 選擇權 CALL 三大法人淨口', '口數', [
          { key: 'opt_call_foreign_net', label: '外資', color: '#6366f1' },
          { key: 'opt_call_trust_net',   label: '投信', color: '#f59e0b' },
          { key: 'opt_call_dealer_net',  label: '自營', color: '#10b981' },
        ]));
        chartEl.appendChild(makeCanvasChart('put', '▼ 選擇權 PUT 三大法人淨口', '口數', [
          { key: 'opt_put_foreign_net', label: '外資', color: '#6366f1' },
          { key: 'opt_put_trust_net',   label: '投信', color: '#f59e0b' },
          { key: 'opt_put_dealer_net',  label: '自營', color: '#10b981' },
        ]));

        // canvas 寬度在 DOM 插入後才能正確取得，需 resize 重繪
        window.addEventListener('resize', () => {
          chartEl.querySelectorAll('canvas').forEach(c => {
            const cssW = c.parentElement.clientWidth - 32;
            c.width = Math.max(cssW, 280) * DPR;
            // 觸發 mouseleave 重繪
            c.dispatchEvent(new Event('mouseleave'));
          });
        });
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
