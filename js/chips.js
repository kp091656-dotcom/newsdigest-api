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

        // ── 共用：設定 canvas 高清尺寸 ──
        // 所有座標用 CSS px，ctx.scale(DPR,DPR) 一次放大，canvas buffer = CSS*DPR
        function setupCanvas(canvas, cssW, cssH) {
          const newW = Math.round(cssW * DPR);
          const newH = Math.round(cssH * DPR);
          // 只在尺寸真正改變時才重設（避免觸發 ResizeObserver 迴圈）
          if (canvas.width !== newW || canvas.height !== newH) {
            canvas.width  = newW;
            canvas.height = newH;
          }
          canvas.style.width  = cssW + 'px';
          canvas.style.height = cssH + 'px';
          const ctx = canvas.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0); // 重設 transform 再 scale
          ctx.scale(DPR, DPR);
          return ctx;
        }

        // ── Canvas 折線圖生成器 ──
        function makeCanvasChart(title, unit, seriesDef) {
          const CSS_H = 120;
          const PL = 46, PR = 10, PT = 10, PB = 24;

          const wrap = document.createElement('div');
          // ⚡ 固定高度 + overflow:hidden 是關鍵，防止 Canvas 撐爆容器
          wrap.style.cssText = 'background:var(--surface);border-radius:12px;padding:0.9rem 1rem 0.7rem;box-shadow:0 0 0 1px var(--border-dark);margin-bottom:0.75rem;position:relative;overflow:hidden;box-sizing:border-box;';

          const ttl = document.createElement('div');
          ttl.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:0.08em;margin-bottom:0.4rem;";
          ttl.innerHTML = `${title} <span style="font-size:0.5rem;opacity:0.6;">近 ${n} 日 · ${unit}</span>`;
          wrap.appendChild(ttl);

          const lgd = document.createElement('div');
          lgd.style.cssText = 'display:flex;gap:1.2rem;margin-bottom:0.4rem;flex-wrap:wrap;';
          seriesDef.forEach(s => {
            const sp = document.createElement('span');
            sp.style.cssText = `font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);display:inline-flex;align-items:center;gap:5px;`;
            sp.innerHTML = `<svg width="18" height="8" style="flex-shrink:0"><line x1="0" y1="4" x2="18" y2="4" stroke="${s.color}" stroke-width="2"/><circle cx="9" cy="4" r="3" fill="${s.color}"/></svg>${s.label}`;
            lgd.appendChild(sp);
          });
          wrap.appendChild(lgd);

          // ⚡ Canvas 必須用固定 px，不能用 width:100% 或 height:auto
          const canvas = document.createElement('canvas');
          canvas.style.cssText = `display:block;width:300px;height:${CSS_H}px;`;
          wrap.appendChild(canvas);

          const tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;background:rgba(12,12,24,0.95);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:7px 11px;font-family:"IBM Plex Mono",monospace;font-size:0.6rem;line-height:1.6;color:var(--text);pointer-events:none;display:none;z-index:20;min-width:120px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
          wrap.appendChild(tip);

          // Y 軸對稱
          const allVals = rows.flatMap(r => seriesDef.map(s => r[s.key] ?? 0));
          const absMax = Math.max(...allVals.map(Math.abs), 1);
          const vMax = absMax, vMin = -absMax, vRange = vMax - vMin;

          let cssW = 300;

          function xPos(i, w) { return PL + (i / Math.max(n - 1, 1)) * (w - PL - PR); }
          function yPos(v)    { return PT + (CSS_H - PT - PB) - ((v - vMin) / vRange) * (CSS_H - PT - PB); }

          function fmtVal(v) {
            if (unit === '口數') return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString() + ' 口';
            return (v >= 0 ? '+' : '') + v.toFixed(2) + ' 億';
          }

          function draw(hoverIdx = -1) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, cssW, CSS_H);

            const cs = getComputedStyle(document.documentElement);
            const colBorder  = cs.getPropertyValue('--border').trim()      || '#2a2a42';
            const colBorderD = cs.getPropertyValue('--border-dark').trim() || '#3a3a5c';
            const colMuted   = cs.getPropertyValue('--muted').trim()       || '#6e6e9e';
            const cH_inner   = CSS_H - PT - PB;
            const zero = yPos(0);

            // 格線 3 條：-max, 0, +max
            [vMin, 0, vMax].forEach(gv => {
              const gy = yPos(gv);
              ctx.beginPath();
              if (gv === 0) { ctx.setLineDash([4, 3]); ctx.strokeStyle = colBorderD; ctx.lineWidth = 1; }
              else          { ctx.setLineDash([]);      ctx.strokeStyle = colBorder;  ctx.lineWidth = 0.6; }
              ctx.moveTo(PL, gy); ctx.lineTo(cssW - PR, gy);
              ctx.stroke(); ctx.setLineDash([]);

              const lbl = Math.abs(gv) >= 1000 ? `${(gv/1000).toFixed(1)}K` : `${Math.round(gv)}`;
              ctx.fillStyle = colMuted;
              ctx.font = '9px "IBM Plex Mono",monospace';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(lbl, PL - 5, gy);
            });

            // hover 垂直線
            if (hoverIdx >= 0) {
              const hx = xPos(hoverIdx, cssW);
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(180,180,255,0.2)';
              ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
              ctx.moveTo(hx, PT); ctx.lineTo(hx, PT + cH_inner);
              ctx.stroke(); ctx.setLineDash([]);
            }

            // X 軸日期（每個都顯示）
            ctx.fillStyle = colMuted;
            ctx.font = '8.5px "IBM Plex Mono",monospace';
            ctx.textBaseline = 'top';
            rows.forEach((r, i) => {
              const x = xPos(i, cssW);
              ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
              ctx.fillText((r.date || '').slice(5), x, PT + cH_inner + 5);
            });

            // 折線 + 節點
            seriesDef.forEach(s => {
              const pts = rows.map((r, i) => ({ x: xPos(i, cssW), y: yPos(r[s.key] ?? 0) }));
              ctx.beginPath();
              ctx.strokeStyle = s.color; ctx.lineWidth = 2;
              ctx.lineJoin = 'round'; ctx.lineCap = 'round';
              pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
              ctx.stroke();

              pts.forEach((p, i) => {
                const isHov = i === hoverIdx;
                ctx.beginPath();
                ctx.arc(p.x, p.y, isHov ? 5 : 3, 0, Math.PI * 2);
                ctx.fillStyle = s.color; ctx.fill();
                if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
              });
            });
          }

          function resize(w) {
            cssW = w;
            canvas.style.width = w + 'px'; // 只改 CSS 寬，不改 buffer → 不觸發 ResizeObserver
            setupCanvas(canvas, cssW, CSS_H);
            draw();
          }

          // 初始化：用 300px 先畫，ResizeObserver 會立刻給真實寬度
          setupCanvas(canvas, cssW, CSS_H);
          draw();

          // Hover
          canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            // e.offsetX 相對於 canvas CSS 座標，直接用，不乘 DPR
            const mouseX = e.offsetX !== undefined ? e.offsetX : (e.clientX - rect.left);
            let closest = 0, minDist = Infinity;
            rows.forEach((_, i) => {
              const dist = Math.abs(xPos(i, cssW) - mouseX);
              if (dist < minDist) { minDist = dist; closest = i; }
            });
            if (minDist > 28) { draw(); tip.style.display = 'none'; return; }

            draw(closest);
            const r = rows[closest];
            tip.innerHTML = `<div style="color:var(--muted);margin-bottom:3px;font-size:0.55rem;">${r.date}</div>` +
              seriesDef.map(s => {
                const v = r[s.key] ?? 0;
                const c = v > 0 ? '#f87171' : v < 0 ? '#4ade80' : 'var(--muted)';
                return `<div style="display:flex;justify-content:space-between;gap:14px;">
                  <span style="color:${s.color};">● ${s.label}</span>
                  <span style="color:${c};font-weight:700;">${fmtVal(v)}</span></div>`;
              }).join('');
            tip.style.display = 'block';
            const tipW = tip.offsetWidth || 130;
            tip.style.left = (mouseX > cssW / 2 ? mouseX - tipW - 8 : mouseX + 14) + 'px';
            tip.style.top  = '40px';
          });
          canvas.addEventListener('mouseleave', () => { draw(); tip.style.display = 'none'; });

          return { wrap, resize };
        }

        // ── 現貨累積買賣超圖 ──
        function makeCumulativeChart(title) {
          const CSS_H = 120;
          const PL = 52, PR = 10, PT = 10, PB = 24;

          const cumSeries = [
            { label: '外資', color: '#6366f1', key: 'spot_foreign_net' },
            { label: '投信', color: '#f59e0b', key: 'spot_trust_net' },
            { label: '自營', color: '#10b981', key: 'spot_dealer_net' },
          ];

          const cumRows = rows.map((r, i) => {
            const obj = { date: r.date };
            cumSeries.forEach(s => {
              obj[s.key] = rows.slice(0, i + 1).reduce((acc, rr) => acc + parseFloat(rr[s.key] ?? 0), 0);
            });
            return obj;
          });

          const wrap = document.createElement('div');
          wrap.style.cssText = 'background:var(--surface);border-radius:12px;padding:0.9rem 1rem 0.7rem;box-shadow:0 0 0 1px var(--border-dark);margin-bottom:0.75rem;position:relative;overflow:hidden;box-sizing:border-box;';

          const ttl = document.createElement('div');
          ttl.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:0.08em;margin-bottom:0.4rem;";
          ttl.innerHTML = `${title} <span style="font-size:0.5rem;opacity:0.6;">近 ${n} 日累積 · 億元</span>`;
          wrap.appendChild(ttl);

          const lgd = document.createElement('div');
          lgd.style.cssText = 'display:flex;gap:1.2rem;margin-bottom:0.4rem;flex-wrap:wrap;';
          cumSeries.forEach(s => {
            const sp = document.createElement('span');
            sp.style.cssText = `font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:var(--muted);display:inline-flex;align-items:center;gap:5px;`;
            sp.innerHTML = `<svg width="18" height="8" style="flex-shrink:0"><line x1="0" y1="4" x2="18" y2="4" stroke="${s.color}" stroke-width="2"/><circle cx="9" cy="4" r="3" fill="${s.color}"/></svg>${s.label}`;
            lgd.appendChild(sp);
          });
          wrap.appendChild(lgd);

          // ⚡ 固定 px，不用 width:100%
          const canvas = document.createElement('canvas');
          canvas.style.cssText = `display:block;width:300px;height:${CSS_H}px;`;
          wrap.appendChild(canvas);

          const tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;background:rgba(12,12,24,0.95);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:7px 11px;font-family:"IBM Plex Mono",monospace;font-size:0.6rem;line-height:1.6;color:var(--text);pointer-events:none;display:none;z-index:20;min-width:130px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
          wrap.appendChild(tip);

          const allCum = cumRows.flatMap(r => cumSeries.map(s => r[s.key]));
          const absMax = Math.max(...allCum.map(Math.abs), 1);
          const vMax = absMax, vMin = -absMax, vRange = vMax - vMin;
          let cssW = 300;

          function xPos(i, w) { return PL + (i / Math.max(n - 1, 1)) * (w - PL - PR); }
          function yPos(v)    { return PT + (CSS_H - PT - PB) - ((v - vMin) / vRange) * (CSS_H - PT - PB); }

          function drawCum(hoverIdx = -1) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, cssW, CSS_H);

            const cs = getComputedStyle(document.documentElement);
            const colBorder  = cs.getPropertyValue('--border').trim()      || '#2a2a42';
            const colBorderD = cs.getPropertyValue('--border-dark').trim() || '#3a3a5c';
            const colMuted   = cs.getPropertyValue('--muted').trim()       || '#6e6e9e';
            const cH_inner   = CSS_H - PT - PB;
            const zero       = yPos(0);

            [vMin, 0, vMax].forEach(gv => {
              const gy = yPos(gv);
              ctx.beginPath();
              if (gv === 0) { ctx.setLineDash([4,3]); ctx.strokeStyle = colBorderD; ctx.lineWidth = 1; }
              else          { ctx.setLineDash([]);     ctx.strokeStyle = colBorder;  ctx.lineWidth = 0.6; }
              ctx.moveTo(PL, gy); ctx.lineTo(cssW - PR, gy);
              ctx.stroke(); ctx.setLineDash([]);

              const lbl = `${gv >= 0 ? (gv === 0 ? '' : '+') : ''}${Math.round(gv)}億`;
              ctx.fillStyle = colMuted; ctx.font = '8.5px "IBM Plex Mono",monospace';
              ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
              ctx.fillText(lbl, PL - 5, gy);
            });

            if (hoverIdx >= 0) {
              const hx = xPos(hoverIdx, cssW);
              ctx.beginPath(); ctx.strokeStyle = 'rgba(180,180,255,0.2)';
              ctx.lineWidth = 1; ctx.setLineDash([3,3]);
              ctx.moveTo(hx, PT); ctx.lineTo(hx, PT + cH_inner);
              ctx.stroke(); ctx.setLineDash([]);
            }

            ctx.fillStyle = colMuted; ctx.font = '8.5px "IBM Plex Mono",monospace'; ctx.textBaseline = 'top';
            cumRows.forEach((r, i) => {
              const x = xPos(i, cssW);
              ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
              ctx.fillText((r.date || '').slice(5), x, PT + cH_inner + 5);
            });

            // 面積 + 折線
            cumSeries.forEach(s => {
              const pts = cumRows.map((r, i) => ({ x: xPos(i, cssW), y: yPos(r[s.key]) }));

              // 半透明面積
              ctx.beginPath();
              ctx.moveTo(pts[0].x, zero);
              pts.forEach(p => ctx.lineTo(p.x, p.y));
              ctx.lineTo(pts[pts.length-1].x, zero);
              ctx.closePath();
              ctx.fillStyle = s.color + '28';
              ctx.fill();

              // 折線
              ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 2;
              ctx.lineJoin = 'round'; ctx.lineCap = 'round';
              pts.forEach((p,i) => i === 0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
              ctx.stroke();

              // 節點
              pts.forEach((p,i) => {
                const isHov = i === hoverIdx;
                ctx.beginPath(); ctx.arc(p.x, p.y, isHov ? 5 : 3, 0, Math.PI*2);
                ctx.fillStyle = s.color; ctx.fill();
                if (isHov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
              });
            });
          }

          function resize(w) {
            cssW = w;
            canvas.style.width = w + 'px';
            setupCanvas(canvas, cssW, CSS_H);
            drawCum();
          }

          setupCanvas(canvas, cssW, CSS_H);
          drawCum();

          canvas.addEventListener('mousemove', e => {
            const mouseX = e.offsetX !== undefined ? e.offsetX : (e.clientX - canvas.getBoundingClientRect().left);
            let closest = 0, minDist = Infinity;
            cumRows.forEach((_, i) => {
              const dist = Math.abs(xPos(i, cssW) - mouseX);
              if (dist < minDist) { minDist = dist; closest = i; }
            });
            if (minDist > 28) { drawCum(); tip.style.display = 'none'; return; }
            drawCum(closest);
            const r = cumRows[closest];
            tip.innerHTML = `<div style="color:var(--muted);margin-bottom:3px;font-size:0.55rem;">${r.date} 累積</div>` +
              cumSeries.map(s => {
                const v = r[s.key];
                const c = v > 0 ? '#f87171' : v < 0 ? '#4ade80' : 'var(--muted)';
                return `<div style="display:flex;justify-content:space-between;gap:14px;">
                  <span style="color:${s.color};">● ${s.label}</span>
                  <span style="color:${c};font-weight:700;">${v >= 0 ? '+' : ''}${v.toFixed(1)} 億</span></div>`;
              }).join('');
            tip.style.display = 'block';
            const tipW = tip.offsetWidth || 140;
            tip.style.left = (mouseX > cssW / 2 ? mouseX - tipW - 8 : mouseX + 14) + 'px';
            tip.style.top  = '40px';
          });
          canvas.addEventListener('mouseleave', () => { drawCum(); tip.style.display = 'none'; });

          return { wrap, resize };
        }

        // ── 組裝 ──
        chartEl.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--accent);border-left:2px solid var(--accent);padding-left:8px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:0.75rem;";
        header.textContent = '近期趨勢';
        chartEl.appendChild(header);

        const charts = [
          makeCumulativeChart('🏢 三大法人現貨買賣超'),
          makeCanvasChart('📈 台指期 TX 三大法人淨口', '口數', [
            { key: 'fut_tx_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'fut_tx_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'fut_tx_dealer_net',  label: '自營', color: '#10b981' },
          ]),
          makeCanvasChart('▲ 選擇權 CALL 三大法人淨口', '口數', [
            { key: 'opt_call_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'opt_call_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'opt_call_dealer_net',  label: '自營', color: '#10b981' },
          ]),
          makeCanvasChart('▼ 選擇權 PUT 三大法人淨口', '口數', [
            { key: 'opt_put_foreign_net', label: '外資', color: '#6366f1' },
            { key: 'opt_put_trust_net',   label: '投信', color: '#f59e0b' },
            { key: 'opt_put_dealer_net',  label: '自營', color: '#10b981' },
          ]),
        ];

        charts.forEach(c => chartEl.appendChild(c.wrap));

        // ResizeObserver：觀察 chartEl 的父容器（不觀察 chartEl 本身，避免 canvas resize 觸發迴圈）
        let lastW = 0;
        let rafId = null;
        const roTarget = chartEl.parentElement || chartEl;
        const ro = new ResizeObserver(entries => {
          const w = entries[0].contentRect.width;
          if (w < 100 || Math.abs(w - lastW) < 2) return; // 寬度沒變就不重繪
          lastW = w;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            charts.forEach(c => c.resize(w));
          });
        });
        ro.observe(roTarget);
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
