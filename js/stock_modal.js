// ════════ 法人籌碼歷史趨勢（Supabase）════════

async function loadInstitutionalHistory() {
  const barsEl  = document.getElementById('ms_instBars');
  const datesEl = document.getElementById('ms_instDates');
  if (!barsEl) return;

  try {
    const rows = await sbFetch('institutional_daily',
      'order=date.desc&limit=30&select=date,foreign_net,total_net');

    if (!rows || rows.length < 2) return; // 資料不足，保留現有 API 資料

    const data   = rows.slice().reverse();
    const vals   = data.map(d => (d.total_net || 0) / 1e8); // 億
    const maxAbs = Math.max(1, ...vals.map(v => Math.abs(v)));

    barsEl.innerHTML = data.map(d => {
      const bil = (d.total_net || 0) / 1e8;
      const h   = Math.abs(bil) / maxAbs * 34;
      const col = bil >= 0 ? '#dc2626' : '#16a34a';
      return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;height:36px;" title="${d.date}\n${bil>=0?'+':''}${bil.toFixed(1)}億">
        <div style="height:${Math.max(2,h).toFixed(1)}px;background:${col};border-radius:2px 2px 0 0;"></div>
      </div>`;
    }).join('');

    if (datesEl) {
      datesEl.innerHTML = data.map((d, i) =>
        `<div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:0.42rem;color:var(--muted);text-align:center;overflow:hidden;">${i % 5 === 0 ? d.date.slice(5) : ''}</div>`
      ).join('');
    }

    // 更新標題提示
    const instTs = document.getElementById('ms_instTs');
    if (instTs) instTs.textContent = `Supabase · 近 ${data.length} 個交易日`;

  } catch(e) {
    console.warn('loadInstitutionalHistory error:', e);
  }
}


