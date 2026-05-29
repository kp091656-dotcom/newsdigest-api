
function showHeatmap() {
  const gp = document.getElementById('giftsPanel'); if (gp) gp.style.display = 'none';
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('heatmapTab').classList.add('active');
  document.getElementById('newsFeed').style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';
  document.querySelector('.feed-header').style.display = 'none';
  document.getElementById('sentimentPanel').style.display = 'none';
  document.getElementById('futuresPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'none';
  document.getElementById('heatmapPanel').style.display = 'block';
  if (heatmapData.length) {
    renderTreemap(heatmapData);
  } else {
    const loadingEl = document.getElementById('heatmapLoading');
    loadingEl.style.display = 'block';
    loadingEl.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:var(--muted);padding:2rem 0;text-align:center;">
      <div class="spinner" style="margin:0 auto 12px;"></div>
      <div style="font-size:0.78rem;">正在載入台股熱圖資料…</div>
      <div style="font-size:0.65rem;margin-top:0.5rem;opacity:0.7;">資料來自 Supabase，每日盤後自動更新</div>
    </div>`;
    document.getElementById('heatmapSvgWrap').style.display = 'none';
  }
  // 只在有快取資料時刷新 bar（避免與 loadHeatmap 入口重複發請求）
  if (heatmapData.length) loadSectorIndexBar();
}

function showSignal() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('signalTab').classList.add('active');
  document.getElementById('newsFeed').style.display = 'none';
  const gp = document.getElementById('giftsPanel'); if (gp) gp.style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';
  document.querySelector('.feed-header').style.display = 'none';
  document.getElementById('sentimentPanel').style.display = 'none';
  document.getElementById('futuresPanel').style.display = 'none';
  document.getElementById('heatmapPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'block';
  loadMktSignals();
  initAlphaIfNeeded();
  loadChipsPanel();  // 籌碼面板
}

function hideHeatmap() {
  document.getElementById('heatmapPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'none';
  document.getElementById('newsFeed').style.display = 'block';
  document.querySelector('.feed-header').style.display = 'flex';
}

// graphify-inspired: filter by community（產業篩選）
function hmFilterSector(sector, btn) {
  document.querySelectorAll('.hm-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._hmActiveSector = sector;
  const filtered = sector === 'all' ? heatmapData : heatmapData.filter(d => d.sector === sector);
  renderTreemap(filtered, true);
}

// ── 前端股票名單（各產業精選，約 250 支）──
// 市值（mcap）為靜態基準值（億元），載入時會用 stock_valuation_daily 即時更新
const HM_STOCK_LIST = [
  // 半導體（15）
  { id:'2330', name:'台積電',    sector:'半導體',   mcap:200000 },
  { id:'2454', name:'聯發科',    sector:'半導體',   mcap:5800 },
  { id:'3711', name:'日月光投控',sector:'半導體',   mcap:2800 },
  { id:'2303', name:'聯電',      sector:'半導體',   mcap:2600 },
  { id:'6488', name:'環球晶',    sector:'半導體',   mcap:1400 },
  { id:'2344', name:'華邦電',    sector:'半導體',   mcap:800 },
  { id:'3037', name:'欣興',      sector:'半導體',   mcap:750 },
  { id:'6239', name:'力成',      sector:'半導體',   mcap:460 },
  { id:'3443', name:'創意',      sector:'半導體',   mcap:440 },
  { id:'2449', name:'京元電子',  sector:'半導體',   mcap:420 },
  { id:'6770', name:'力積電',    sector:'半導體',   mcap:400 },
  { id:'2351', name:'順德',      sector:'半導體',   mcap:350 },
  { id:'8046', name:'南電',      sector:'半導體',   mcap:280 },
  { id:'3707', name:'漢磊',      sector:'半導體',   mcap:220 },
  { id:'6271', name:'同欣電',    sector:'半導體',   mcap:200 },
  // IC設計（6）
  { id:'3034', name:'聯詠',      sector:'IC設計',   mcap:1200 },
  { id:'2379', name:'瑞昱',      sector:'IC設計',   mcap:1150 },
  { id:'6415', name:'矽力-KY',   sector:'IC設計',   mcap:500 },
  { id:'2385', name:'群光',      sector:'IC設計',   mcap:420 },
  { id:'4967', name:'十銓',      sector:'IC設計',   mcap:300 },
  { id:'3706', name:'神盾',      sector:'IC設計',   mcap:260 },
  // 記憶體（4）
  { id:'2408', name:'南亞科',    sector:'記憶體',   mcap:820 },
  { id:'2337', name:'旺宏',      sector:'記憶體',   mcap:520 },
  { id:'3260', name:'威剛',      sector:'記憶體',   mcap:280 },
  { id:'4977', name:'眾達-KY',   sector:'記憶體',   mcap:180 },
  // 電子製造（10）
  { id:'2317', name:'鴻海',      sector:'電子製造', mcap:4200 },
  { id:'2382', name:'廣達',      sector:'電子製造', mcap:2900 },
  { id:'4938', name:'和碩',      sector:'電子製造', mcap:1000 },
  { id:'2324', name:'仁寶',      sector:'電子製造', mcap:760 },
  { id:'2356', name:'英業達',    sector:'電子製造', mcap:740 },
  { id:'6669', name:'緯穎',      sector:'電子製造', mcap:580 },
  { id:'3231', name:'緯創',      sector:'電子製造', mcap:480 },
  { id:'2354', name:'鴻準',      sector:'電子製造', mcap:460 },
  { id:'2368', name:'金像電',    sector:'電子製造', mcap:360 },
  { id:'2365', name:'昆盈',      sector:'電子製造', mcap:220 },
  // 電子零件（8）
  { id:'2308', name:'台達電',    sector:'電子零件', mcap:3200 },
  { id:'2327', name:'國巨',      sector:'電子零件', mcap:950 },
  { id:'3533', name:'嘉澤',      sector:'電子零件', mcap:560 },
  { id:'2301', name:'光寶科',    sector:'電子零件', mcap:500 },
  { id:'2312', name:'金寶',      sector:'電子零件', mcap:320 },
  { id:'2492', name:'華新科',    sector:'電子零件', mcap:300 },
  { id:'6269', name:'台郡',      sector:'電子零件', mcap:250 },
  { id:'2499', name:'東貝',      sector:'電子零件', mcap:180 },
  // 電腦（6）
  { id:'2357', name:'華碩',      sector:'電腦',     mcap:800 },
  { id:'2353', name:'宏碁',      sector:'電腦',     mcap:780 },
  { id:'2377', name:'微星',      sector:'電腦',     mcap:420 },
  { id:'2376', name:'技嘉',      sector:'電腦',     mcap:540 },
  { id:'3017', name:'奇鋐',      sector:'電腦',     mcap:480 },
  { id:'2364', name:'倫飛',      sector:'電腦',     mcap:160 },
  // 工業電腦（4）
  { id:'2395', name:'研華',      sector:'工業電腦', mcap:1050 },
  { id:'6414', name:'樺漢',      sector:'工業電腦', mcap:340 },
  { id:'3615', name:'安勤',      sector:'工業電腦', mcap:200 },
  { id:'6245', name:'立端',      sector:'工業電腦', mcap:180 },
  // 網通（5）
  { id:'2345', name:'智邦',      sector:'網通',     mcap:900 },
  { id:'3702', name:'大聯大',    sector:'網通',     mcap:580 },
  { id:'2332', name:'友訊',      sector:'網通',     mcap:280 },
  { id:'6266', name:'普萊德',    sector:'網通',     mcap:200 },
  { id:'4906', name:'正文',      sector:'網通',     mcap:160 },
  // 光學（4）
  { id:'3008', name:'大立光',    sector:'光學',     mcap:1100 },
  { id:'2474', name:'可成',      sector:'光學',     mcap:380 },
  { id:'3406', name:'玉晶光',    sector:'光學',     mcap:280 },
  { id:'3491', name:'昇達科',    sector:'光學',     mcap:180 },
  // 數位雲端（4）
  { id:'3661', name:'世芯-KY',   sector:'數位雲端', mcap:600 },
  { id:'2391', name:'台光電',    sector:'數位雲端', mcap:600 },
  { id:'6451', name:'訊芯-KY',   sector:'數位雲端', mcap:300 },
  { id:'5285', name:'界霖',      sector:'數位雲端', mcap:200 },
  // 金融（16）
  { id:'2881', name:'富邦金',    sector:'金融',     mcap:2500 },
  { id:'2882', name:'國泰金',    sector:'金融',     mcap:2300 },
  { id:'2886', name:'兆豐金',    sector:'金融',     mcap:2100 },
  { id:'2891', name:'中信金',    sector:'金融',     mcap:2000 },
  { id:'2884', name:'玉山金',    sector:'金融',     mcap:1550 },
  { id:'2892', name:'第一金',    sector:'金融',     mcap:1500 },
  { id:'5880', name:'合庫金',    sector:'金融',     mcap:1450 },
  { id:'2885', name:'元大金',    sector:'金融',     mcap:1400 },
  { id:'2887', name:'台新金',    sector:'金融',     mcap:1350 },
  { id:'2890', name:'永豐金',    sector:'金融',     mcap:1300 },
  { id:'2883', name:'開發金',    sector:'金融',     mcap:1250 },
  { id:'2880', name:'華南金',    sector:'金融',     mcap:1200 },
  { id:'2801', name:'彰銀',      sector:'金融',     mcap:620 },
  { id:'5871', name:'中租-KY',   sector:'金融',     mcap:600 },
  { id:'2888', name:'新光金',    sector:'金融',     mcap:700 },
  { id:'2834', name:'臺企銀',    sector:'金融',     mcap:420 },
  // 電信（3）
  { id:'2412', name:'中華電',    sector:'電信',     mcap:2400 },
  { id:'3045', name:'台灣大',    sector:'電信',     mcap:720 },
  { id:'4904', name:'遠傳',      sector:'電信',     mcap:700 },
  // 石化（6）
  { id:'1301', name:'台塑',      sector:'石化',     mcap:1900 },
  { id:'1303', name:'南亞',      sector:'石化',     mcap:1800 },
  { id:'1326', name:'台化',      sector:'石化',     mcap:1700 },
  { id:'6505', name:'台塑化',    sector:'石化',     mcap:880 },
  { id:'1304', name:'台聚',      sector:'石化',     mcap:280 },
  { id:'1310', name:'台苯',      sector:'石化',     mcap:200 },
  // 塑膠（4）
  { id:'1314', name:'中石化',    sector:'塑膠',     mcap:320 },
  { id:'1312', name:'國喬',      sector:'塑膠',     mcap:280 },
  { id:'1313', name:'聯成',      sector:'塑膠',     mcap:240 },
  { id:'1316', name:'上曜',      sector:'塑膠',     mcap:150 },
  // 鋼鐵（4）
  { id:'2002', name:'中鋼',      sector:'鋼鐵',     mcap:1600 },
  { id:'2049', name:'上銀',      sector:'鋼鐵',     mcap:480 },
  { id:'2014', name:'中鴻',      sector:'鋼鐵',     mcap:260 },
  { id:'2015', name:'豐興',      sector:'鋼鐵',     mcap:200 },
  // 機電（4）
  { id:'1605', name:'華新',      sector:'機電',     mcap:480 },
  { id:'1504', name:'東元',      sector:'機電',     mcap:420 },
  { id:'1503', name:'士電',      sector:'機電',     mcap:300 },
  { id:'1590', name:'亞德客-KY', sector:'機電',     mcap:1100 },
  // 汽車（4）
  { id:'2207', name:'和泰車',    sector:'汽車',     mcap:840 },
  { id:'2204', name:'中華',      sector:'汽車',     mcap:360 },
  { id:'2201', name:'裕隆',      sector:'汽車',     mcap:300 },
  { id:'2206', name:'三陽工業',  sector:'汽車',     mcap:200 },
  // 航運（8）
  { id:'2603', name:'長榮',      sector:'航運',     mcap:2800 },
  { id:'2609', name:'陽明',      sector:'航運',     mcap:1200 },
  { id:'2615', name:'萬海',      sector:'航運',     mcap:800 },
  { id:'2610', name:'華航',      sector:'航運',     mcap:620 },
  { id:'2618', name:'長榮航',    sector:'航運',     mcap:580 },
  { id:'2605', name:'新興',      sector:'航運',     mcap:200 },
  { id:'2606', name:'裕民',      sector:'航運',     mcap:180 },
  { id:'2637', name:'慧洋-KY',   sector:'航運',     mcap:160 },
  // 生技醫療（6）
  { id:'6446', name:'藥華藥',    sector:'生技醫療', mcap:680 },
  { id:'4174', name:'浩鼎',      sector:'生技醫療', mcap:280 },
  { id:'4105', name:'台灣東洋',  sector:'生技醫療', mcap:220 },
  { id:'1786', name:'科妍',      sector:'生技醫療', mcap:200 },
  { id:'4726', name:'永日',      sector:'生技醫療', mcap:160 },
  { id:'4770', name:'上智',      sector:'生技醫療', mcap:150 },
  // 建材營造（5）
  { id:'1101', name:'台泥',      sector:'建材營造', mcap:580 },
  { id:'1102', name:'亞泥',      sector:'建材營造', mcap:480 },
  { id:'2504', name:'國產',      sector:'建材營造', mcap:200 },
  { id:'2515', name:'中工',      sector:'建材營造', mcap:180 },
  { id:'5522', name:'遠雄',      sector:'建材營造', mcap:160 },
  // 觀光餐旅（4）
  { id:'2727', name:'王品',      sector:'觀光',     mcap:280 },
  { id:'2722', name:'夏都',      sector:'觀光',     mcap:150 },
  { id:'6704', name:'安永鑫',    sector:'觀光',     mcap:120 },
  { id:'2701', name:'萬企',      sector:'觀光',     mcap:100 },
  // 油電燃氣（3）
  { id:'8926', name:'台汽電',    sector:'油電燃氣', mcap:200 },
  { id:'9945', name:'潤泰新',    sector:'油電燃氣', mcap:280 },
  { id:'9944', name:'新麗',      sector:'油電燃氣', mcap:160 },
  // 綠能環保（4）
  { id:'3576', name:'聯合再生',  sector:'綠能環保', mcap:280 },
  { id:'6592', name:'和潤企業',  sector:'綠能環保', mcap:320 },
  { id:'6409', name:'旭隼',      sector:'綠能環保', mcap:180 },
  { id:'3519', name:'綠電',      sector:'綠能環保', mcap:150 },
  // 零售（5）
  { id:'2912', name:'統一超',    sector:'零售',     mcap:640 },
  { id:'5904', name:'寶雅',      sector:'零售',     mcap:380 },
  { id:'2903', name:'遠百',      sector:'零售',     mcap:320 },
  { id:'2905', name:'漢神',      sector:'零售',     mcap:180 },
  { id:'6488', name:'環球晶',    sector:'零售',     mcap:100 },
  // 食品（6）
  { id:'1216', name:'統一',      sector:'食品',     mcap:660 },
  { id:'1210', name:'大成',      sector:'食品',     mcap:280 },
  { id:'1229', name:'聯華',      sector:'食品',     mcap:220 },
  { id:'1201', name:'味全',      sector:'食品',     mcap:180 },
  { id:'1203', name:'味王',      sector:'食品',     mcap:150 },
  { id:'1218', name:'泰山',      sector:'食品',     mcap:140 },
  // 紡織（4）
  { id:'1402', name:'遠東新',    sector:'紡織',     mcap:860 },
  { id:'1434', name:'福懋',      sector:'紡織',     mcap:260 },
  { id:'1409', name:'新纖',      sector:'紡織',     mcap:180 },
  { id:'1416', name:'廣豐',      sector:'紡織',     mcap:120 },
  // 橡膠（3）
  { id:'9910', name:'豐泰',      sector:'橡膠',     mcap:680 },
  { id:'2107', name:'厚生',      sector:'橡膠',     mcap:180 },
  { id:'2102', name:'泰豐',      sector:'橡膠',     mcap:140 },
];

async function loadHeatmap() {
  if (loadHeatmap._busy) return;
  loadHeatmap._busy = true;
  const loadingEl = document.getElementById('heatmapLoading');
  loadingEl.style.display = 'block';
  const total = HM_STOCK_LIST.length;
  loadingEl.innerHTML = `<div class="spinner" style="margin:0 auto 12px;"></div><span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--muted);">從 Supabase 載入台股資料中（${total} 支）…</span>`;
  document.getElementById('heatmapSvgWrap').style.display = 'none';

  try {
    const ids = HM_STOCK_LIST.map(s => s.id);
    // PostgREST in() 語法：stock_id=in.(2330,2454,...)
    const inList = ids.join(',');

    // ① stock_daily_twse：取最新 5 天資料（避免部分更新誤判）
    // 欄位：id, date, stock_id, name, close, prev, chg_pct, volume, source, created_at
    const twseRows = await sbFetch('stock_daily_twse',
      `stock_id=in.(${inList})&order=date.desc&limit=${total * 5}&select=stock_id,date,close,prev,chg_pct,volume`);

    if (!twseRows?.length) throw new Error('stock_daily_twse 無資料');

    // 找最新交易日：取「最近的日期」，而非「出現次數最多的日期」
    // 避免：新一天資料只更新部分股票時，被舊的完整資料蓋過
    const dateCounts = {};
    twseRows.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });

    // 依日期排序（新→舊），取第一個覆蓋率 ≥ 20% 的日期
    const sortedDates = Object.entries(dateCounts).sort((a, b) => b[0].localeCompare(a[0]));
    const minCoverage = Math.max(1, Math.floor(total * 0.2)); // 至少 20% 股票有資料才算有效日期
    const latestEntry = sortedDates.find(([, cnt]) => cnt >= minCoverage) || sortedDates[0];
    const latestDate  = latestEntry[0];
    const latestCount = latestEntry[1];

    // Debug log：幫助追蹤資料覆蓋狀況
    console.group(`[Heatmap] Supabase 日期分布（${sortedDates.length} 個交易日）`);
    sortedDates.slice(0, 5).forEach(([d, c]) =>
      console.log(`  ${d}：${c}/${total} 支（${(c/total*100).toFixed(0)}%）${d === latestDate ? ' ← 採用' : ''}`));
    console.groupEnd();

    // twse lookup（最新日期）
    const twseMap = {};
    twseRows.filter(r => r.date === latestDate).forEach(r => { twseMap[r.stock_id] = r; });

    // ② stock_valuation_daily：分兩批查，用 select=* 確保欄位名正確
    const half = Math.ceil(ids.length / 2);
    const [valRows1, valRows2] = await Promise.all([
      sbFetch('stock_valuation_daily',
        `stock_id=in.(${ids.slice(0, half).join(',')})&order=date.desc&limit=${half * 2}&select=*`),
      sbFetch('stock_valuation_daily',
        `stock_id=in.(${ids.slice(half).join(',')})&order=date.desc&limit=${half * 2}&select=*`),
    ]).catch(() => [[], []]);
    const valRows = [...(valRows1 || []), ...(valRows2 || [])];

    // valuation lookup（每支取最新有 pbr 的一筆）
    const valMap = {};
    valRows.forEach(r => {
      if (!valMap[r.stock_id] && parseFloat(r.pb_ratio) > 0) // listed_shares 欄位不存在，只檢查 pb_ratio
        valMap[r.stock_id] = r;
    });

    // 組合資料
    const data = [];
    for (const s of HM_STOCK_LIST) {
      const t = twseMap[s.id];
      if (!t) continue;

      const close   = parseFloat(t.close) || 0;
      // chg_pct 已是小數（如 0.0122 = +1.22%），直接用
      const chgPct  = parseFloat(t.chg_pct) || 0;

      // 市值推算：優先用 stock_daily_twse 的 volume×close 估算，或靜態 mcap
      // valuation 欄位待確認，暫用靜態值
      let mcap = s.mcap;
      const v = valMap[s.id];
      if (v) {
        // 嘗試各種可能的 PBR 欄位名
        const pbr = parseFloat(v.pb_ratio || v.pbr || v.PBratio || 0);
        const shares = parseFloat(v.listed_shares || v.shares || v.issued_shares || 0);
        if (pbr > 0 && shares > 0) mcap = pbr * shares * close / 100000;
      }

      // 估值欄位（CLAUDE.md: stock_valuation_daily 欄位為 pe_ratio, pb_ratio, dividend_yield）
      // pe_ratio > 200 視為失真（虧損/微利股），前端過濾
      const per = v ? (() => { const p = parseFloat(v.pe_ratio); return (p > 0 && p <= 200) ? p : 0; })() : 0;
      const pbr = v ? parseFloat(v.pb_ratio) || 0 : 0;
      const dy  = v ? parseFloat(v.dividend_yield) || 0 : 0;

      // 本益比警示：以台股歷史均值 15~20 倍為基準
      let valLabel = '', valColor = 'var(--muted)';
      if (per > 0) {
        if      (per < 10)  { valLabel = '偏便宜'; valColor = '#16a34a'; }
        else if (per < 15)  { valLabel = '合理偏低'; valColor = '#0ea5e9'; }
        else if (per < 20)  { valLabel = '合理';   valColor = 'var(--muted)'; }
        else if (per < 30)  { valLabel = '偏貴';   valColor = '#f97316'; }
        else                { valLabel = '高估';   valColor = '#dc2626'; }
      }
      // 高殖利率標記（>5% 視為高息）
      const highDY = dy >= 5;

      data.push({
        id:       s.id,
        name:     s.name,
        sector:   s.sector,
        price:    close,
        prev:     parseFloat(t.prev) || 0,
        chgPct,
        mcap,
        date:     latestDate,
        volume:   parseFloat(t.volume) || 0,
        per, pbr, dy, valLabel, valColor, highDY,
      });
    }

    if (!data.length) throw new Error('無有效股票資料');

    heatmapData = data;
    const d = new Date(latestDate + 'T00:00:00+08:00');
    const weekdays = ['日','一','二','三','四','五','六'];
    const wd = weekdays[d.getDay()];
    const coveragePct = Math.round(latestCount / total * 100);
    const coverageWarn = coveragePct < 80
      ? ` ⚠ 資料僅 ${coveragePct}%（Supabase 尚未完整更新）`
      : '';
    document.getElementById('heatmapTs').textContent =
      `資料日期：${latestDate}（週${wd} 收盤後）${coverageWarn}`;
    renderTreemap(heatmapData);

  } catch(e) {
    loadingEl.innerHTML = `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--muted);">資料載入失敗：${e.message}</span>`;
    console.error('loadHeatmap error:', e);
  } finally {
    loadHeatmap._busy = false;
    // 不論成功或失敗都同步刷新產業 bar
    loadSectorIndexBar();
  }
}

function heatmapBgColor(chgPct) {
  const v = chgPct * 100;
  if (v >=  5)   return '#7b1a1a';
  if (v >=  3)   return '#a83030';
  if (v >=  2)   return '#dc2626';
  if (v >=  1)   return '#e07850';
  if (v >=  0.2) return '#d4917a';
  if (v > -0.2)  return '#8a8480';
  if (v > -1)    return '#4a9d6a';
  if (v > -2)    return '#16a34a';
  if (v > -3)    return '#1a7040';
  return '#0f4a28';
}

// ── Squarified Treemap（正確版）──
// 每個遞迴層用局部 totalVal，避免條紋退化
function squarify(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];

  const results = [];

  function recurse(rem, x, y, w, h) {
    if (!rem.length) return;
    if (rem.length === 1) { results.push({ ...rem[0], x, y, w, h }); return; }

    // 局部 totalVal 和 totalArea（只算剩餘的）
    const localTotal = rem.reduce((s, d) => s + d.value, 0);
    const area = w * h;

    function worstRatio(row, rowLocalTotal) {
      if (!row.length) return Infinity;
      // strip 在短邊方向的長度
      const rowFrac = rowLocalTotal / localTotal;
      const rowArea = rowFrac * area;
      const stripLen = w >= h ? rowArea / w : rowArea / h; // strip 的短邊
      const longLen  = w >= h ? w : h;                     // strip 的長邊
      let maxR = 0;
      for (const item of row) {
        const itemFrac = item.value / localTotal;
        const itemArea = itemFrac * area;
        const itemShort = itemArea / longLen; // 在 strip 長邊方向上的高/寬
        // 每個 item 是 longLen x itemShort，但 item 在 strip 方向上的尺寸
        // 實際 item: stripLen (strip 方向) x (itemArea / stripLen)
        const a = stripLen;
        const b = itemArea / stripLen;
        const r = a > b ? a / b : b / a;
        if (r > maxR) maxR = r;
      }
      return maxR;
    }

    const horiz = w >= h;
    let row = [], rowTotal = 0, i = 0, prevWorst = Infinity;
    while (i < rem.length) {
      const newRow = [...row, rem[i]];
      const newTotal = rowTotal + rem[i].value;
      const ww = worstRatio(newRow, newTotal);
      if (row.length > 0 && ww > prevWorst) break;
      row = newRow; rowTotal = newTotal; prevWorst = ww; i++;
    }

    // 佈局這個 row
    const rowFrac = rowTotal / localTotal;
    if (horiz) {
      // 水平切：strip 佔滿寬度，高度 = rowFrac * h
      const stripH = rowFrac * h;
      let cx = x;
      for (const item of row) {
        const iw = (item.value / rowTotal) * w;
        results.push({ ...item, x: cx, y, w: iw, h: stripH });
        cx += iw;
      }
      recurse(rem.slice(i), x, y + stripH, w, h - stripH);
    } else {
      // 垂直切：strip 佔滿高度，寬度 = rowFrac * w
      const stripW = rowFrac * w;
      let cy = y;
      for (const item of row) {
        const ih = (item.value / rowTotal) * h;
        results.push({ ...item, x, y: cy, w: stripW, h: ih });
        cy += ih;
      }
      recurse(rem.slice(i), x + stripW, y, w - stripW, h);
    }
  }

  recurse(items, x, y, w, h);
  return results;
}

function renderTreemap(data, skipFilterRebuild) {
  document.getElementById('heatmapLoading').style.display = 'none';
  const wrap = document.getElementById('heatmapSvgWrap');
  wrap.style.display = 'block';

  // 正方形版面：squarify 在接近 1:1 比例時效果最好
  const SVG_W = wrap.clientWidth > 0 ? wrap.clientWidth : (window.innerWidth > 960 ? 680 : window.innerWidth - 40);
  const SVG_H = SVG_W; // 正方形
  const GAP = 2;

  const svg = document.getElementById('heatmapSvg');
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  svg.setAttribute('height', SVG_H);
  svg.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';
  const tooltip = document.getElementById('hmTooltip');

  // 整體背景（warm dark from DESIGN.md）
  const bg0 = document.createElementNS(ns, 'rect');
  bg0.setAttribute('x', 0); bg0.setAttribute('y', 0);
  bg0.setAttribute('width', SVG_W); bg0.setAttribute('height', SVG_H);
  bg0.setAttribute('fill', '#1a1a18');
  svg.appendChild(bg0);

  // power scale：壓縮台積電優勢，保留相對大小
  const scaleMcap = v => Math.pow(v, 0.38);

  // ── 第一層：產業區塊 squarify ──
  const sectorMap = {};
  data.forEach(d => {
    if (!sectorMap[d.sector]) sectorMap[d.sector] = [];
    sectorMap[d.sector].push(d);
  });

  const SECTOR_GAP = 4;
  const HDR_H = 18;

  const sectorItems = Object.keys(sectorMap).map(sector => {
    const stocks = sectorMap[sector].sort((a, b) => b.mcap - a.mcap);
    const totalMcap = stocks.reduce((s, d) => s + d.mcap, 0);
    return { sector, stocks, value: scaleMcap(totalMcap) };
  }).sort((a, b) => b.value - a.value);

  // ── 建立產業篩選按鈕（graphify: filter by community）──
  if (!skipFilterRebuild) {
    const filterBar = document.getElementById('hmSectorFilter');
    filterBar.innerHTML = `<button class="hm-filter-btn active" data-sector="all" onclick="hmFilterSector('all',this)">全部</button>`;
    sectorItems.forEach(si => {
      const sc = SECTOR_COLORS[si.sector] || DEFAULT_SECTOR_COLOR;
      filterBar.innerHTML += `<button class="hm-filter-btn" data-sector="${si.sector}" onclick="hmFilterSector('${si.sector}',this)"
        style="border-left: 3px solid ${sc}; padding-left:8px; border-radius:4px 20px 20px 4px;">
        ${si.sector}
      </button>`;
    });
  }

  const sectorRects = squarify(sectorItems, 0, 0, SVG_W, SVG_H);

  // ── 畫每個產業區塊 ──
  sectorRects.forEach(sr => {
    const bx = sr.x + SECTOR_GAP / 2;
    const by = sr.y + SECTOR_GAP / 2;
    const bw = sr.w - SECTOR_GAP;
    const bh = sr.h - SECTOR_GAP;
    if (bw < 10 || bh < 10) return;

    const sc = SECTOR_COLORS[sr.sector] || DEFAULT_SECTOR_COLOR;

    // 產業區塊背景
    const sbg = document.createElementNS(ns, 'rect');
    sbg.setAttribute('x', bx); sbg.setAttribute('y', by);
    sbg.setAttribute('width', bw); sbg.setAttribute('height', bh);
    sbg.setAttribute('fill', '#252522'); sbg.setAttribute('rx', 3);
    svg.appendChild(sbg);

    // 產業 color accent：左側 2px 彩色條（對齊 filter btn 設計）
    if (bh > 20) {
      const accent = document.createElementNS(ns, 'rect');
      accent.setAttribute('x', bx); accent.setAttribute('y', by);
      accent.setAttribute('width', 2); accent.setAttribute('height', bh);
      accent.setAttribute('fill', sc); accent.setAttribute('rx', 1);
      svg.appendChild(accent);
    }

    // 是否夠大顯示標籤列
    const showHdr = bw > 35 && bh > HDR_H + 14;
    const innerX = bx + (bh > 20 ? 3 : 1); // 避開左側 accent bar
    const innerY = showHdr ? by + HDR_H : by + 1;
    const innerW = bw - (bh > 20 ? 4 : 2);
    const innerH = showHdr ? bh - HDR_H - 1 : bh - 2;

    if (showHdr) {
      // 標籤列背景
      const hbg = document.createElementNS(ns, 'rect');
      hbg.setAttribute('x', bx); hbg.setAttribute('y', by);
      hbg.setAttribute('width', bw); hbg.setAttribute('height', HDR_H);
      hbg.setAttribute('fill', '#32322e'); hbg.setAttribute('rx', 3);
      svg.appendChild(hbg);
      // 蓋掉下半圓角
      const hfix = document.createElementNS(ns, 'rect');
      hfix.setAttribute('x', bx); hfix.setAttribute('y', by + HDR_H - 3);
      hfix.setAttribute('width', bw); hfix.setAttribute('height', 3);
      hfix.setAttribute('fill', '#32322e');
      svg.appendChild(hfix);

      // 產業名稱（sector color from DESIGN.md accent system）
      const lSz = Math.min(11, Math.max(7, bw / 10));
      const sLabel = document.createElementNS(ns, 'text');
      sLabel.setAttribute('x', bx + 8);
      sLabel.setAttribute('y', by + HDR_H / 2);
      sLabel.setAttribute('dominant-baseline', 'middle');
      sLabel.setAttribute('fill', sc);  // 用產業色顯示標題
      sLabel.setAttribute('font-size', lSz);
      sLabel.setAttribute('font-family', 'Noto Sans TC, sans-serif');
      sLabel.setAttribute('font-weight', '600');
      sLabel.setAttribute('letter-spacing', '0.02em');
      const maxCh = Math.floor((bw - 10) / (lSz * 0.82));
      sLabel.textContent = sr.sector.length > maxCh
        ? sr.sector.slice(0, maxCh - 1) + '…'
        : sr.sector + ' -';
      svg.appendChild(sLabel);
    }

    if (innerW < 4 || innerH < 4) return;

    // ── 第二層：個股 squarify（在產業內部）──
    const stockItems = sr.stocks.map(d => ({ ...d, value: scaleMcap(d.mcap) }));
    const stockRects = squarify(stockItems, innerX, innerY, innerW, innerH);

    stockRects.forEach(r => {
      const tw = r.w - GAP;
      const th = r.h - GAP;
      const tx = r.x + GAP / 2;
      const ty = r.y + GAP / 2;
      if (tw < 3 || th < 3) return;

      const tileBg = heatmapBgColor(r.chgPct);
      const pct = r.chgPct * 100;
      const sign = pct >= 0 ? '+' : '';

      const g = document.createElementNS(ns, 'g');
      g.style.cursor = 'pointer';

      // 個股底色
      const tile = document.createElementNS(ns, 'rect');
      tile.setAttribute('x', tx); tile.setAttribute('y', ty);
      tile.setAttribute('width', tw); tile.setAttribute('height', th);
      tile.setAttribute('fill', tileBg);
      tile.setAttribute('rx', tw > 16 ? 2 : 0);
      g.appendChild(tile);

      // 文字
      const cx = tx + tw / 2;
      const cy = ty + th / 2;

      if (tw > 72 && th > 52) {
        // 大 tile：名稱 + 代碼 + 漲跌
        const nSz = Math.min(Math.floor(tw / 4.8), Math.floor(th / 4.5), 28);
        const iSz = Math.round(nSz * 0.5);
        const cSz = Math.round(nSz * 0.72);
        const hasId = th > 80;
        const totalTextH = nSz + cSz + (hasId ? iSz + 4 : 0) + 4;
        let curY = cy - totalTextH / 2 + nSz / 2;

        const tN = document.createElementNS(ns, 'text');
        tN.setAttribute('x', cx); tN.setAttribute('y', curY);
        tN.setAttribute('text-anchor', 'middle'); tN.setAttribute('dominant-baseline', 'middle');
        tN.setAttribute('fill', '#fff'); tN.setAttribute('font-size', nSz);
        tN.setAttribute('font-family', 'Noto Sans TC, sans-serif'); tN.setAttribute('font-weight', '900');
        tN.textContent = r.name; g.appendChild(tN);
        curY += nSz / 2 + 4;

        if (hasId) {
          curY += iSz / 2;
          const tI = document.createElementNS(ns, 'text');
          tI.setAttribute('x', cx); tI.setAttribute('y', curY);
          tI.setAttribute('text-anchor', 'middle'); tI.setAttribute('dominant-baseline', 'middle');
          tI.setAttribute('fill', 'rgba(255,255,255,0.6)'); tI.setAttribute('font-size', iSz);
          tI.setAttribute('font-family', 'IBM Plex Mono, monospace');
          tI.textContent = r.id; g.appendChild(tI);
          curY += iSz / 2 + 4;
        }

        curY += cSz / 2;
        const tC = document.createElementNS(ns, 'text');
        tC.setAttribute('x', cx); tC.setAttribute('y', curY);
        tC.setAttribute('text-anchor', 'middle'); tC.setAttribute('dominant-baseline', 'middle');
        tC.setAttribute('fill', '#fff'); tC.setAttribute('font-size', cSz);
        tC.setAttribute('font-family', 'IBM Plex Mono, monospace'); tC.setAttribute('font-weight', '700');
        tC.textContent = `${sign}${pct.toFixed(2)}%`; g.appendChild(tC);

      } else if (tw > 38 && th > 28) {
        // 中 tile：名稱 + 漲跌
        const nSz = Math.min(Math.floor(tw / 5), Math.floor(th / 3.5), 14);
        const cSz = Math.round(nSz * 0.85);
        const tN = document.createElementNS(ns, 'text');
        tN.setAttribute('x', cx); tN.setAttribute('y', cy - cSz / 2 - 2);
        tN.setAttribute('text-anchor', 'middle'); tN.setAttribute('dominant-baseline', 'middle');
        tN.setAttribute('fill', '#fff'); tN.setAttribute('font-size', nSz);
        tN.setAttribute('font-family', 'Noto Sans TC, sans-serif'); tN.setAttribute('font-weight', '700');
        tN.textContent = r.name; g.appendChild(tN);
        const tC = document.createElementNS(ns, 'text');
        tC.setAttribute('x', cx); tC.setAttribute('y', cy + nSz / 2 + 2);
        tC.setAttribute('text-anchor', 'middle'); tC.setAttribute('dominant-baseline', 'middle');
        tC.setAttribute('fill', 'rgba(255,255,255,0.9)'); tC.setAttribute('font-size', cSz);
        tC.setAttribute('font-family', 'IBM Plex Mono, monospace'); tC.setAttribute('font-weight', '600');
        tC.textContent = `${sign}${pct.toFixed(2)}%`; g.appendChild(tC);

      } else if (tw > 22 && th > 16) {
        // 小 tile
        const sz = Math.min(Math.floor(tw / 3.5), Math.floor(th / 2.2), 10);
        if (th > 26 && tw > 28) {
          const tN = document.createElementNS(ns, 'text');
          tN.setAttribute('x', cx); tN.setAttribute('y', cy - sz * 0.5);
          tN.setAttribute('text-anchor', 'middle'); tN.setAttribute('dominant-baseline', 'middle');
          tN.setAttribute('fill', '#fff'); tN.setAttribute('font-size', sz);
          tN.setAttribute('font-family', 'Noto Sans TC, sans-serif'); tN.setAttribute('font-weight', '700');
          tN.textContent = r.name; g.appendChild(tN);
          const tC = document.createElementNS(ns, 'text');
          tC.setAttribute('x', cx); tC.setAttribute('y', cy + sz * 0.7);
          tC.setAttribute('text-anchor', 'middle'); tC.setAttribute('dominant-baseline', 'middle');
          tC.setAttribute('fill', 'rgba(255,255,255,0.85)'); tC.setAttribute('font-size', Math.max(sz - 1, 6));
          tC.setAttribute('font-family', 'IBM Plex Mono, monospace');
          tC.textContent = `${sign}${pct.toFixed(1)}%`; g.appendChild(tC);
        } else {
          const tC = document.createElementNS(ns, 'text');
          tC.setAttribute('x', cx); tC.setAttribute('y', cy);
          tC.setAttribute('text-anchor', 'middle'); tC.setAttribute('dominant-baseline', 'middle');
          tC.setAttribute('fill', 'rgba(255,255,255,0.8)'); tC.setAttribute('font-size', sz);
          tC.setAttribute('font-family', 'IBM Plex Mono, monospace');
          tC.textContent = `${sign}${pct.toFixed(1)}%`; g.appendChild(tC);
        }
      }

      // hover overlay
      const hov = document.createElementNS(ns, 'rect');
      hov.setAttribute('x', tx); hov.setAttribute('y', ty);
      hov.setAttribute('width', tw); hov.setAttribute('height', th);
      hov.setAttribute('fill', 'rgba(255,255,255,0)');
      hov.setAttribute('rx', tw > 16 ? 2 : 0);
      g.appendChild(hov);

      g.addEventListener('mouseenter', () => hov.setAttribute('fill', 'rgba(255,255,255,0.15)'));
      g.addEventListener('mouseleave', () => { hov.setAttribute('fill', 'rgba(255,255,255,0)'); tooltip.style.display = 'none'; });
      g.addEventListener('mousemove', e => {
        const priceStr = r.price ? r.price.toLocaleString('zh-TW', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
        const prevStr  = r.prev  ? r.prev.toLocaleString('zh-TW',  {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
        const mcapStr  = r.mcap >= 10000 ? `${(r.mcap/10000).toFixed(1)} 兆` : `${r.mcap.toLocaleString()} 億`;
        // DESIGN.md warm dark tooltip: #141413 bg, #b0aea5 secondary, #30302e ring
        const sectorColor = SECTOR_COLORS[r.sector] || DEFAULT_SECTOR_COLOR;
        tooltip.innerHTML = `
          <div style="font-size:0.82rem;font-weight:700;color:#f5f3ee;margin-bottom:4px;">${r.name} <span style="font-weight:400;color:#87867f;font-size:0.7rem;">${r.id}</span></div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:${sectorColor};flex-shrink:0;"></span>
            <span style="color:#87867f;font-size:0.65rem;">${r.sector}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;color:#b0aea5;font-size:0.65rem;margin-bottom:5px;">
            <span>收盤</span><span style="color:#f5f3ee;text-align:right;">${priceStr}</span>
            <span>前日</span><span style="color:#f5f3ee;text-align:right;">${prevStr}</span>
            <span>市值</span><span style="color:#f5f3ee;text-align:right;">${mcapStr}</span>
            ${r.per > 0 ? `<span>本益比</span><span style="color:${r.valColor};text-align:right;font-weight:600;">${r.per.toFixed(1)}x ${r.valLabel}</span>` : ''}
            ${r.dy  > 0 ? `<span>殖利率</span><span style="color:${r.highDY?'#f59e0b':'#f5f3ee'};text-align:right;">${r.dy.toFixed(2)}%${r.highDY?' 🔶':''}</span>` : ''}
            ${r.pbr > 0 ? `<span>PBR</span><span style="color:#f5f3ee;text-align:right;">${r.pbr.toFixed(2)}x</span>` : ''}
          </div>
          <div style="font-size:0.85rem;font-weight:700;color:${pct>=0?'#dc2626':'#16a34a'};border-top:1px solid #30302e;padding-top:5px;">${sign}${pct.toFixed(2)}%</div>`;
        tooltip.style.display = 'block';
        const ttW = 200;
        const left = e.clientX + 14 + ttW > window.innerWidth ? e.clientX - ttW - 6 : e.clientX + 14;
        tooltip.style.left = left + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
      });
      g.addEventListener('click', () => openStockModal(r));

      svg.appendChild(g);
    });
  });
  // 產業漲跌幅 bar（市值加權）— 始終用完整資料，只標記當前篩選
  renderSectorBar(window.heatmapData || data, window._hmActiveSector || 'all');
}

// ── 從 Supabase sector_index_daily 載入官方產業指數漲跌幅 ──
async function loadSectorIndexBar() {
  try {
    const rows = await sbFetch('sector_index_daily',
      'order=date.desc&limit=500&select=date,index_name,chg_pct');
    if (!rows || !rows.length) return;

    // 找最新日期
    const latestDate = rows[0].date;
    const dayRows = rows.filter(r => r.date === latestDate);

    // 模糊比對：index_name 包含關鍵字 → sector key
    // 順序重要：長關鍵字優先，避免短字誤觸
    const KEYWORD_MAP = [
      // 科技
      { kw: '半導體',         key: '半導體' },
      { kw: 'IC設計',         key: 'IC設計' },
      { kw: '記憶體',         key: '記憶體' },
      { kw: '電子製造服務',   key: '電子製造' },
      { kw: '電子零組件',     key: '電子零件' },
      { kw: '電子零件',       key: '電子零件' },
      { kw: '光電',           key: '光學' },
      { kw: '通信網路',       key: '網通' },
      { kw: '工業電腦',       key: '工業電腦' },
      { kw: '電腦及週邊',     key: '電腦' },
      { kw: '資訊服務',       key: '電腦' },
      { kw: '數位雲端',       key: '數位雲端' },
      // 金融/電信
      { kw: '金融保險',       key: '金融' },
      { kw: '電信業',         key: '電信' },
      // 石化/塑膠（分開處理，不互搶）
      { kw: '塑膠化工',       key: '石化' },
      { kw: '塑膠類',         key: '塑膠' },
      { kw: '石油煤炭',       key: '石化' },
      { kw: '化學工業',       key: '石化' },
      { kw: '化學類',         key: '石化' },
      // 機電/鋼鐵/汽車
      { kw: '電機機械',       key: '機電' },
      { kw: '機電',           key: '機電' },
      { kw: '鋼鐵',           key: '鋼鐵' },
      { kw: '汽車',           key: '汽車' },
      // 航運
      { kw: '航運',           key: '航運' },
      // 生技醫療（獨立，不混石化）
      { kw: '生技醫療',       key: '生技醫療' },
      // 民生
      { kw: '百貨',           key: '零售' },
      { kw: '電子通路',       key: '零售' },
      { kw: '食品',           key: '食品' },
      { kw: '紡織',           key: '紡織' },
      { kw: '橡膠',           key: '橡膠' },
      // 建材/觀光/能源
      { kw: '建材營造',       key: '建材營造' },
      { kw: '觀光餐旅',       key: '觀光' },
      { kw: '油電燃氣',       key: '油電燃氣' },
      { kw: '綠能環保',       key: '綠能環保' },
      // 追加：TWSE 常見指數名，原本未命中的
      { kw: '塑膠工業',       key: '塑膠' },      // 塑膠工業類指數
      { kw: '電器電纜',       key: '機電' },      // 電器電纜業類指數
      { kw: '玻璃陶瓷',       key: '建材營造' },  // 玻璃陶瓷業類指數
      { kw: '造紙',           key: '建材營造' },  // 造紙工業類指數
      { kw: '水泥',           key: '建材營造' },  // 水泥工業類指數
      { kw: '觀光',           key: '觀光' },      // 觀光事業類指數（舊名）
      { kw: '農業科技',       key: '食品' },      // 農業科技業類指數
      { kw: '生醫',           key: '生技醫療' },  // 生醫相關指數
      { kw: '醫療',           key: '生技醫療' },  // 醫療器材類
      { kw: '電子通路',       key: '零售' },      // 電子通路業類指數
      { kw: '航空',           key: '航運' },      // 航空相關（歸入航運）
      { kw: '數位',           key: '數位雲端' },  // 數位相關
    ];

    function matchKey(indexName) {
      // 排除「報酬指數」版本、槓桿/反向/特選/複合指數
      if (indexName.includes('報酬指數')) return null;
      if (indexName.includes('兩倍') || indexName.includes('反向') ||
          indexName.includes('特選') || indexName.includes('高息') ||
          indexName.includes('等權重') || indexName.includes('日報酬')) return null;
      // 排除綜合大類（非細分產業）
      if (['臺灣資訊科技指數','未含金融指數','未含電子指數','未含金融電子指數',
           '電子工業類指數','電子類兩倍槓桿指數','電子類反向指數',
           '化學生技醫療類指數','其他電子類指數','其他類指數'].includes(indexName)) return null;
      // 先精確比對
      if (SECTOR_INDEX_MAP[indexName]) return SECTOR_INDEX_MAP[indexName];
      // 再關鍵字（長鍵優先）
      for (const { kw, key } of KEYWORD_MAP) {
        if (indexName.includes(kw)) return key;
      }
      return null;
    }

    const sectorData = [];
    const seen = new Set();
    const unmatched = [];
    for (const r of dayRows) {
      const key = matchKey(r.index_name);
      if (!key) { unmatched.push(r.index_name); continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      const pct = parseFloat(r.chg_pct || 0);
      sectorData.push({
        sector:    key,
        chgPct:    pct,
        official:  true,
        indexName: r.index_name,
        date:      latestDate,
      });
    }

    // 僅在有未命中時才印（方便補齊 KEYWORD_MAP）
    if (unmatched.length) console.debug('[SectorBar] 未命中指數:', unmatched);
    if (!sectorData.length) return;
    window._sectorIndexData = sectorData;
    renderSectorBar(null, window._hmActiveSector || 'all', sectorData);
  } catch (e) {
    console.warn('loadSectorIndexBar error:', e);
  }
}

// ── 產業漲跌幅 bar（官方指數優先，fallback 市值加權） ──
function renderSectorBar(data, activeSector, officialData) {
  const barWrap = document.getElementById('hmSectorBar');
  const barRows = document.getElementById('hmSectorBarRows');
  if (!barWrap || !barRows) return;

  // ── 決定資料來源 ──
  // 優先：官方指數（傳入 officialData，或快取 window._sectorIndexData）
  // Fallback：熱圖市值加權
  const srcOfficial = officialData || window._sectorIndexData || null;

  let sectors;
  let isOfficial = false;

  if (srcOfficial && srcOfficial.length) {
    // 官方指數模式：直接排序
    sectors = [...srcOfficial].sort((a, b) => b.chgPct - a.chgPct);
    isOfficial = true;
  } else {
    // Fallback：市值加權（需要 data）
    if (!data || !data.length) return;
    const sectorMap = {};
    for (const d of data) {
      if (!d.sector) continue;
      if (!sectorMap[d.sector]) sectorMap[d.sector] = { totalMcap: 0, weightedChg: 0, count: 0 };
      const mcap = d.mcap || 1;
      sectorMap[d.sector].totalMcap   += mcap;
      sectorMap[d.sector].weightedChg += (d.chgPct || 0) * mcap;
      sectorMap[d.sector].count       += 1;
    }
    sectors = Object.entries(sectorMap).map(([sector, v]) => ({
      sector,
      chgPct: v.totalMcap > 0 ? (v.weightedChg / v.totalMcap) * 100 : 0,
      count: v.count,
      official: false,
    })).sort((a, b) => b.chgPct - a.chgPct);
  }

  if (!sectors.length) return;

  // 更新標題標籤：官方指數 or 市值加權
  const titleEl = document.getElementById('hmSectorBarTitle');
  if (titleEl) {
    if (isOfficial && sectors[0]?.date) {
      titleEl.textContent = `產業指數 ${sectors[0].date}`;
    } else if (isOfficial) {
      titleEl.textContent = '產業指數（官方）';
    } else {
      titleEl.textContent = '產業漲跌幅（市值加權）';
    }
  }

  // 最大絕對值，用來定比例尺
  const maxAbs = Math.max(0.5, ...sectors.map(s => Math.abs(s.chgPct)));

  barRows.innerHTML = sectors.map(s => {
    const color    = SECTOR_COLORS[s.sector] || DEFAULT_SECTOR_COLOR;
    const pct      = s.chgPct;
    const sign     = pct >= 0 ? '+' : '';
    const barColor = pct >= 0.2 ? '#dc2626' : pct <= -0.2 ? '#16a34a' : '#9ca3af';
    const midPct   = 45;
    const scale    = (Math.abs(pct) / maxAbs) * midPct;
    const isPos    = pct >= 0;
    const barLeft  = isPos ? midPct : midPct - scale;
    const barWidth = scale;
    const isActive = activeSector && activeSector !== 'all' && activeSector === s.sector;
    // 右側標籤：官方指數顯示「官方」，fallback 顯示股票數
    const tagLabel = s.official
      ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;color:var(--accent2);width:22px;text-align:right;flex-shrink:0;opacity:0.8;">官方</div>`
      : `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:var(--muted);width:22px;text-align:right;flex-shrink:0;">${s.count || ''}</div>`;
    // tooltip：官方模式顯示完整指數名稱
    const titleAttr = s.indexName ? `title="${s.indexName}"` : '';

    return `<div ${titleAttr} style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:1px 0;border-radius:3px;${isActive ? 'background:var(--surface);padding:1px 3px;box-shadow:0 0 0 1px var(--border-dark);' : ''}"
      onclick="hmFilterSectorByName('${s.sector}')"
      onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--text);width:52px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.sector}</div>
      <div style="flex:1;height:8px;background:var(--bg);border-radius:1px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:${barLeft.toFixed(1)}%;width:${Math.max(1,barWidth).toFixed(1)}%;height:100%;background:${barColor};border-radius:1px;transition:width 0.5s,left 0.5s;"></div>
        <div style="position:absolute;top:0;left:${midPct}%;width:1px;height:100%;background:var(--border-dark);"></div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;font-weight:700;color:${barColor};width:46px;text-align:right;flex-shrink:0;">${sign}${pct.toFixed(2)}%</div>
      ${tagLabel}
    </div>`;
  }).join('');

  barWrap.style.display = 'block';
}

// 從產業 bar 點擊觸發篩選（同步 filter btn 狀態）
function hmFilterSectorByName(sector) {
  window._hmActiveSector = sector;
  const btns = document.querySelectorAll('.hm-filter-btn');
  let found = false;
  btns.forEach(btn => {
    if (btn.dataset.sector === sector) {
      hmFilterSector(sector, btn);
      found = true;
    }
  });
  // 若 btn 還沒建立（資料未完全載入），直接用 heatmapData 篩選
  if (!found && window.heatmapData) {
    const filtered = heatmapData.filter(d => d.sector === sector);
    if (filtered.length) renderTreemap(filtered, true);
  }
}

// ════════ end heatmap ════════
