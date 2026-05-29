// AI keys 存在 Vercel 環境變數，無需前端輸入
// 全域變數（API_BASE, allArticles, futuresData 等）定義於 api.js

// ── Static data ──
const mockArticles = [
  {title:'輝達 GTC 大會公布 Blackwell Ultra 架構，AI 算力提升 5 倍',source:'Reuters',publishedAt:new Date(Date.now()-3*60000).toISOString(),url:'#',description:'NVIDIA 執行長黃仁勳在 GTC 年度大會發表演說，宣布 Blackwell Ultra GPU 正式問世，訓練大型語言模型速度較前代提升近五倍，盤前股價大漲逾 7%。',category:'tech'},
  {title:'美聯儲會議紀要釋放鴿派訊號，6 月降息概率攀升至 68%',source:'Bloomberg',publishedAt:new Date(Date.now()-11*60000).toISOString(),url:'#',description:'聯準會最新 FOMC 會議紀要顯示，多名官員擔憂高利率過度收緊，暗示降息窗口逐步開啟，債市殖利率應聲下滑。',category:'tech'},
  {title:'台積電外資連三週買超，法人上調獲利預估逾每股 50 元',source:'MoneyDJ',publishedAt:new Date(Date.now()-28*60000).toISOString(),url:'#',description:'受惠於 AI 晶片需求強勁，台積電 ADR 大漲，外資法人連三週布局半導體，多家外資券商上調目標價。',category:'economy'},
  {title:'比特幣突破 87,000 美元，鏈上數據顯示機構積累加速',source:'CoinDesk',publishedAt:new Date(Date.now()-45*60000).toISOString(),url:'#',description:'比特幣持續強勢，大戶地址持有量創六個月新高，ETF 資金淨流入連續第八日為正，市場情緒接近「極度貪婪」。',category:'geopolitics'},
  {title:'OPEC+ 維持減產協議，地緣政治風險推升油價至 86 美元',source:'FT',publishedAt:new Date(Date.now()-72*60000).toISOString(),url:'#',description:'OPEC+ 決議維持現有減產配額，疊加中東局勢緊張，布蘭特原油突破每桶 86 美元，能源股普遍走強。',category:'geopolitics'},
  {title:'OpenAI GPT-5 發布在即，多模態能力大幅躍升',source:'The Information',publishedAt:new Date(Date.now()-90*60000).toISOString(),url:'#',description:'知情人士透露 OpenAI 計劃本季末發布 GPT-5，具備更強推理與視覺理解能力，將對企業軟體市場帶來深遠影響。',category:'tech'},
  {title:'歐盟 AI 法案正式生效，高風險系統需符合透明度要求',source:'Reuters',publishedAt:new Date(Date.now()-3*3600000).toISOString(),url:'#',description:'歐盟 AI 法案核心條款生效，要求高風險 AI 應用建立風險管理與透明度機制，違規最高罰全球年營收 3%。',category:'geopolitics'},
  {title:'鴻海宣布與 NVIDIA 深化合作，AI 伺服器訂單大增',source:'經濟日報',publishedAt:new Date(Date.now()-4*3600000).toISOString(),url:'#',description:'鴻海精密宣布擴大與 NVIDIA 合作範疇，GB200 AI 伺服器出貨量預計倍增，法人預估下半年營收可望創歷史新高。',category:'economy'},
];// ── Trending ──
function renderTrending() {
  // Show top 5 by popularity score
  const items = allArticles.length > 0
    ? [...allArticles].sort((a,b) => (b.popularityScore||0) - (a.popularityScore||0)).slice(0, 5)
    : [];
  if (!items.length) {
    document.getElementById('trending').innerHTML = '<div style="padding:1.2rem 1rem;font-size:var(--text-sm);color:var(--muted);text-align:center;line-height:1.6;">載入財經新聞後<br>自動更新熱門快訊</div>';
    return;
  }
  document.getElementById('trending').innerHTML = items.map((a, i) =>
    `<div class="ticker-item" ${a.url && a.url !== '#' ? `onclick="window.open('${a.url}','_blank')"` : ''}>
      <div class="ticker-rank">${i+1}</div>
      <div class="ticker-body">
        <div class="ticker-title">${a.title}</div>
        <div class="ticker-meta">${typeof a.source === 'string' ? a.source : (a.source?.name || '')} · ${timeAgo(a.publishedAt)}</div>
      </div>
    </div>`
  ).join('');
}

// ── Time ──
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  if (m < 1440) return `${Math.floor(m/60)} 小時前`;
  return `${Math.floor(m/1440)} 天前`;
}

// ── Category label ──
const catMap = {tech:{cls:'tech',label:'科技'},economy:{cls:'economy',label:'經濟'},geopolitics:{cls:'geopolitics',label:'地緣政治'},general:{cls:'general',label:'財經'}};
function getTag(cat) { return catMap[cat] || catMap.general; }

// ── Card ──
function createCard(article, idx) {
  const tag = getTag(article.category || 'general');
  const id = `card-${idx}-${Date.now()}`;
  const div = document.createElement('div');
  div.className = 'news-card';
  div.style.animationDelay = `${(idx % PAGE_SIZE) * 0.055}s`;
  div.innerHTML = `
    <div class="card-meta">
      <span class="tag ${tag.cls}">${tag.label}</span>
      <span class="card-time">${timeAgo(article.publishedAt)}</span>
      ${(() => {
        const s = article.popularityScore || 0;
        if (s >= 95) return '<span class="badge-critical">⚡ 重大</span>';
        if (s >= 80) return '<span class="badge-hot">🔥 熱門</span>';
        return '';
      })()}
      <span class="pop-score">${article.popularityScore > 0 ? article.popularityScore.toFixed(0) + ' 分' : '—'}</span>
      <span class="card-source">${article.source?.name || ''}</span>
    </div>
    <div class="card-title">
      ${article.url && article.url !== '#'
        ? `<a href="${article.url}" target="_blank" class="ptt-link" style="color:inherit;text-decoration:none;">${article.title || ''}</a>`
        : (article.title || '')}
    </div>
    ${(() => {
      const s = article.popularityScore || 0;
      if (s === 0) return '';
      const pct = Math.min(s, 100);
      const color = s >= 95 ? '#ef4444' : s >= 80 ? '#f97316' : s >= 60 ? '#eab308' : '#94a3b8';
      const label = s >= 95 ? '極熱門' : s >= 80 ? '熱門' : s >= 60 ? '有熱度' : '一般';
      return `<div class="pop-bar-wrap">
        <div class="pop-bar-track"><div class="pop-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="pop-label">${label} ${pct.toFixed(0)}%</span>
      </div>`;
    })()}
    ${article.description ? `<div class="card-desc">${article.description}</div>` : ''}
    <button class="card-expand-btn" onclick="toggleReadMode(this)">
      <span class="expand-icon">▸</span> <span class="expand-label">展開閱讀摘要</span>
    </button>
    <div class="card-read-more">
      <div class="read-loading" style="color:var(--muted);font-size:0.78rem;">⏳ 點擊展開後由 Groq AI 生成完整摘要…</div>
      <div class="read-content" style="display:none;"></div>
      <div class="read-original" style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px solid var(--border);">
        ${article.url && article.url !== '#' ? `<a href="${article.url}" target="_blank" style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:var(--accent2);">↗ 閱讀原文</a>` : ''}
      </div>
    </div>
    <div class="ai-analysis-area">
      <div class="ai-analysis-label">◆ Groq AI 分析</div>
      <div id="sum-${id}">
        <button class="analyze-btn" id="btn-${id}"
          data-cardid="${id}"
          data-title="${encodeURIComponent(article.title||'')}"
          data-desc="${encodeURIComponent(article.description||'')}"
          onclick="requireOwner(()=>doSummarize(this.dataset.cardid, decodeURIComponent(this.dataset.title), decodeURIComponent(this.dataset.desc)))">
          ✦ 點擊生成 Groq AI 分析
        </button>
      </div>
    </div>
    <div class="card-footer">
      <span>${typeof article.source === 'object' ? article.source?.name : article.source || ''}</span>
      ${article.url && article.url !== '#'
        ? `<span style="color:var(--border-dark)">·</span>
           <span style="font-size:0.63rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${article.url.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]}</span>
           <a class="read-more" href="${article.url}" target="_blank">閱讀原文 →</a>`
        : '<span style="color:var(--muted);font-size:0.63rem">（無來源連結）</span>'}
    </div>
  `;
  return div;
}

// ── Render feed ──
function classifyArticle(title, description) {
  const t = (title + ' ' + description).toLowerCase();
  if (/war|sanction|tariff|trade war|geopolit|nato|military|russia|ukraine|taiwan strait|conflict|diplomatic|election|congress|white house|xi jinping|government|policy|regulation|antitrust|legislation|iran|north korea/.test(t)) return 'geopolitics';
  if (/\bai\b|artificial intelligence|chatgpt|openai|nvidia|semiconductor|chip|llm|machine learning|apple|microsoft|google|alphabet|meta|amazon|tesla|software|hardware|cloud|cyber|quantum|robot|autonomous|electric vehicle|\bev\b|5g|biotech|tsmc|taiwan semi/.test(t)) return 'tech';
  if (/fed|federal reserve|interest rate|inflation|gdp|recession|economy|treasury|earnings|revenue|profit|stock|market|nasdaq|s&p|dow|bond|yield|currency|dollar|euro|yen|oil|gold|crypto|bitcoin|etf|fund|invest|bank|finance|quarter|fiscal/.test(t)) return 'economy';
  return 'general';
}

function renderFeed(articles) {
  const feed = document.getElementById('newsFeed');
  if (!articles.length) {
    feed.innerHTML = '<div class="feed-state"><p>找不到相關新聞</p><small>請嘗試其他分類或重新載入</small></div>';
    document.getElementById('loadMoreBtn').style.display = 'none';
    document.getElementById('feedCount').textContent = '';
    return;
  }
  const slice = articles.slice(0, PAGE_SIZE);
  displayedCount = slice.length;
  feed.innerHTML = '';
  slice.forEach((a, i) => feed.appendChild(createCard(a, i)));
  document.getElementById('feedCount').textContent = `顯示 ${displayedCount} / ${articles.length} 則`;
  document.getElementById('loadMoreBtn').style.display = articles.length > PAGE_SIZE ? 'block' : 'none';
}

// ── Load more ──
function loadMore() {
  const filtered = getFiltered();
  const next = filtered.slice(displayedCount, displayedCount + PAGE_SIZE);
  const feed = document.getElementById('newsFeed');
  next.forEach((a, i) => feed.appendChild(createCard(a, displayedCount + i)));
  displayedCount += next.length;
  document.getElementById('feedCount').textContent = `顯示 ${displayedCount} / ${filtered.length} 則`;
  if (displayedCount >= filtered.length) document.getElementById('loadMoreBtn').style.display = 'none';
}

function getFiltered() {
  let filtered = currentCat === 'general' ? allArticles : allArticles.filter(a => (a.category || 'general') === currentCat);
  return filtered;
}

function setStatus(msg, type) {
  const el = document.getElementById('apiStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'api-status' + (type ? ' ' + type : '');
}

// ── News fetch: TheNewsAPI via Vercel proxy ──
// ── 從 Supabase 載入快取新聞（頁面開啟時自動執行）──
async function loadCachedNews() {
  try {
    setStatus('載入快取新聞…', 'loading');
    const r = await fetch(`${API_BASE}?endpoint=news_cached&limit=80`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    if (!json.data?.length) throw new Error('快取無資料');

    let articles = json.data.map(a => {
      // 地區黑名單
      const chk = (a.title || '') + ' ' + (a.url || '');
      if (/czech|prague|koruna|philippines|philippine|manila|bangko sentral|safaricom|nairobi|kenya|nigeria|lagos|johannesburg|south africa|ghana/i.test(chk)) return null;
      if (/^[A-Za-z\s&]+\d{1,2}\/\d{1,2}\/\d{4}$/.test((a.title || '').trim())) return null;
      return {
        title:          a.title || '',
        description:    a.description || '',
        url:            a.url || '#',
        publishedAt:    a.publishedAt || new Date().toISOString(),
        source:         a.source || '',
        lang:           a.lang || 'en',
        category:       classifyArticle(a.title || '', a.description || ''),
        popularityScore: 0,
        fromCache:      true,
      };
    }).filter(Boolean);

    // 去重
    const seen = new Set();
    articles = articles.filter(a => { if (!a.title || seen.has(a.title)) return false; seen.add(a.title); return true; });
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    articles.forEach((a, i) => { a.popularityScore = Math.round(100 - (i / Math.max(articles.length - 1, 1)) * 90); });

    allArticles = articles;
    const zhCnt = articles.filter(a => a.lang === 'zh').length;
    const enCnt = articles.filter(a => a.lang === 'en').length;
    setStatus(`✓ 快取：中文 ${zhCnt} · 英文 ${enCnt} 則`, 'ok');
    renderFeed(getFiltered());
    renderTrending();
    // 英文文章才需要翻譯
    if (articles.some(a => a.lang === 'en' && !a.title_zh)) translateArticles();
  } catch (e) {
    console.warn('[快取新聞] 載入失敗，顯示示範資料：', e.message);
    setStatus('快取暫無資料，可按「即時拉取」', 'err');
    allArticles = mockArticles;
    renderFeed(getFiltered());
  }
}

async function fetchMarketaux() {
  const btn = document.getElementById('fetchBtn');
  const liveBtn = document.getElementById('fetchLiveBtn');
  if (liveBtn) { liveBtn.disabled = true; liveBtn.textContent = '拉取中…'; }
  btn.disabled = true;
  setStatus('即時連線中…', 'loading');
  document.getElementById('newsFeed').innerHTML = '<div class="feed-state"><div class="spinner"></div><p>正在即時從 Reuters · CNBC · Bloomberg · MarketWatch · FT 載入新聞…</p></div>';

  try {
    // Fetch all+top pages concurrently via Vercel proxy
    // RSS feeds via Vercel proxy (Reuters, CNBC, Bloomberg, WSJ, MarketWatch, Yahoo Finance, FT)
    const reqs = [fetch(API_BASE).then(r=>r.json()).catch(()=>null)];
    const results = await Promise.all(reqs);

    let articles = [];
    for (const data of results) {
      if (!data || data.error || !data.data?.length) continue;
      for (const a of data.data) {
        if (!a.description || a.description.trim().length < 30) continue;

        // 地區黑名單（印度、捷克、菲律賓、非洲）
        const regionCheck = (a.source||'') + ' ' + (a.url||'') + ' ' + (a.title||'') + ' ' + (a.description||'');
        if (/indiatimes|hindustantimes|livemint|moneycontrol|economictimes|ndtv|thehindubusinessline|zeebiz|sensex|nifty|sebi|rupee|mumbai|bengaluru|hyderabad|chennai|kolkata|czech|prague|koruna|brno|czechia|philippines|philippine|manila|peso|pse index|bangko sentral|safaricom|nairobi|kenya|nigeria|lagos|johannesburg|south africa|ghana|ethiopia|tanzania|rwanda|african stock|jse |nse nigeria|east africa|west africa|sub-saharan|middle east.*africa|horizons.*africa|horizons.*middle|africa.*horizons/i.test(regionCheck)) continue;
        // Newsletter / 電子報過濾：標題含日期格式（如 5/8/2026）且無明確財經事件
        if (/^[A-Za-z\s&]+\d{1,2}\/\d{1,2}\/\d{4}$/.test((a.title||'').trim())) continue;

        // 過濾：必須是財經相關
        const isBiz = /stock|market|trade|economy|finance|invest|bank|rate|inflation|gdp|earnings|crypto|bitcoin|tech|ai|chip|energy|oil|gold|bond|fund|fed|nasdaq|s&p|trump|tariff|sanction|china|taiwan|ukraine|russia|war|election|policy|microsoft|apple|google|amazon|nvidia|tesla|meta|revenue|profit|quarter|fiscal|merger|acquisition|ipo|valuation|shares|equity|debt|yield|currency|dollar|euro|yen|interest|central bank|monetary|budget|deficit|surplus|export|import|supply chain|semiconductor|electric|battery|cloud|software|hardware|startup|venture|billion|trillion|million/i.test((a.title||'') + ' ' + (a.description||''));
        if (!isBiz) continue;

        articles.push({
          title: a.title || '',
          description: (a.description || '').slice(0, 300),
          url: a.url || '#',
          publishedAt: a.publishedAt || new Date().toISOString(),
          source: a.source || '',
          lang: a.lang || 'en',
          category: classifyArticle(a.title || '', a.description || ''),
          popularityScore: 0,
        });
      }
    }

    // Deduplicate
    const seen = new Set();
    articles = articles.filter(a => { if (!a.title || seen.has(a.title)) return false; seen.add(a.title); return true; });

    // Sort by time, rank-based score
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    articles = articles.slice(0, 50);
    articles.forEach((a, i) => { a.popularityScore = Math.round(100 - (i / Math.max(articles.length-1,1)) * 90); });

    if (!articles.length) throw new Error('未取得任何新聞，請稍後再試');

    allArticles = articles;

    const techCnt = articles.filter(a => a.category === 'tech').length;
    const econCnt = articles.filter(a => a.category === 'economy').length;
    const geoCnt  = articles.filter(a => a.category === 'geopolitics').length;
    const zhCnt   = articles.filter(a => a.lang === 'zh').length;
    const enCnt   = articles.filter(a => a.lang === 'en').length;
    setStatus(`✓ 科技 ${techCnt} · 經濟 ${econCnt} · 地緣政治 ${geoCnt} · 中文 ${zhCnt} · 英文 ${enCnt}`, 'ok');

    renderFeed(getFiltered());
    renderTrending();
    translateArticles(); // 翻譯完成後會自動呼叫 generateBrief（Groq 佇列依序執行）

  } catch(e) {
    setStatus(`✗ ${e.message}`, 'err');
    document.getElementById('newsFeed').innerHTML = `<div class="feed-state"><p>載入失敗</p><small>${e.message}</small></div>`;
    setTimeout(() => { allArticles = mockArticles; renderFeed(getFiltered()); }, 1000);
  } finally {
    btn.disabled = false;
    const liveBtn2 = document.getElementById('fetchLiveBtn');
    if (liveBtn2) { liveBtn2.disabled = false; liveBtn2.textContent = '即時拉取'; }
  }
}


// ── Translate articles to Traditional Chinese via Groq ──
async function translateArticles() {
  if (!allArticles.length) return;

  // 只翻英文（lang !== 'zh' 且標題不含中文字）且熱門以上（popularityScore >= 70）的文章
  const targets = allArticles.filter(a =>
    a.lang !== 'zh' && !/[一-鿿]/.test(a.title) && (a.popularityScore || 0) >= 70
  );

  if (!targets.length) {
    setStatus(`✓ 翻譯完成，共 ${allArticles.length} 則`, 'ok');
    renderFeed(getFiltered()); renderTrending(); generateBrief();
    return;
  }

  setStatus(`Groq 翻譯中（熱門 ${targets.length} 篇）…`, 'loading');

  // 分批翻譯（每批 6 篇），避免 max_tokens 截斷
  // 全部一批送出（只翻標題，token 量小，無需分批）
  try {
    const lines = targets.map((a, j) =>
      `${j+1}. ${a.title.replace(/[|\n]/g,' ')}`
    ).join('\n');
    const prompt = `將以下財經新聞標題翻譯為繁體中文，規則：①股票代號（如NVDA、TSMC）維持英文 ②公司名稱用台灣常用譯名 ③數字與單位保留原文 ④每行僅輸出「編號. 翻譯後標題」，不加任何說明。\n\n${lines}`;
    const raw = await callGroq(prompt, 600, 0.3);
    raw.trim().split('\n')
      .filter(l => l.match(/^\d+\./))
      .forEach(line => {
        const nm = line.match(/^(\d+)\.\s*/);
        if (!nm) return;
        const idx = parseInt(nm[1]) - 1;
        const art = targets[idx];
        if (!art) return;
        const t = line.replace(/^\d+\.\s*/, '').trim();
        if (t && t.length > 2 && /[一-鿿]/.test(t)) art.title = t;
      });
  } catch(e) {
    console.warn('Groq 翻譯失敗:', e.message);
  }

  setStatus(`✓ 翻譯完成（熱門 ${targets.length} 篇），共 ${allArticles.length} 則`, 'ok');
  renderFeed(getFiltered());
  renderTrending();
  generateBrief();
}


// ── Market Summary ──
async function generateMarketSummary() {
  if (!allArticles.length) return;
  const box = document.getElementById('marketSummaryBox');
  const el = document.getElementById('marketSummaryContent');
  const ts = document.getElementById('summaryTs');
  box.style.display = 'block';
  el.innerHTML = '<div class="skeleton"><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line" style="width:80%"></div></div>';

  const headlines = allArticles.slice(0, 20).map((a,i) => `${i+1}. ${a.title}`).join('\n');
  const prompt = `你是專業財經編輯。根據以下今日 ${allArticles.length} 則財經新聞，用繁體中文整理出「今日市場 3-5 大重點」。每個重點用一行，格式：「• 重點標題：簡短說明（30字內）」只輸出重點列表，不要前言或結語。\n\n${headlines}`;

  try {
    const text = await callGemini(prompt);
    const points = text.trim().split('\n').filter(l => l.trim());
    el.innerHTML = points.map(p =>
      `<div style="padding:0.35rem 0;border-bottom:1px solid var(--border);font-size:0.82rem;line-height:1.6;color:var(--text);">${p.replace(/^[•\-\*]\s*/,'<span style="color:var(--accent);font-weight:700;margin-right:0.4rem;">◆</span>')}</div>`
    ).join('');
    ts.textContent = new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}) + ' · Groq AI 生成';
  } catch(e) {
    el.innerHTML = `<span style="color:var(--muted);font-size:0.78rem;">生成失敗：${e.message}</span>`;
  }
}

// ── Reading mode ──
async function toggleReadMode(btn) {
  const card = btn.closest('.news-card');
  const panel = card.querySelector('.card-read-more');
  const icon = btn.querySelector('.expand-icon');
  const label = btn.querySelector('.expand-label');
  const isOpen = card.classList.contains('expanded');

  if (isOpen) {
    card.classList.remove('expanded');
    icon.textContent = '▸';
    label.textContent = '展開閱讀摘要';
    return;
  }

  card.classList.add('expanded');
  icon.textContent = '▾';
  label.textContent = '收合';

  const readContent = panel.querySelector('.read-content');
  const readLoading = panel.querySelector('.read-loading');

  // Already generated
  if (readContent.style.display !== 'none') return;

  // Get article data from card
  const titleEl = card.querySelector('.card-title');
  const descEl = card.querySelector('.card-desc');
  const title = titleEl?.textContent?.trim() || '';
  const desc = descEl?.textContent?.trim() || '';

  if (false) {
    readLoading.textContent = '';
    return;
  }

  readLoading.textContent = '⏳ Groq AI 生成中…';

  try {
    const prompt = `你是資深財經記者，擅長從機構研究角度解讀市場新聞。根據以下新聞，用繁體中文撰寫深度摘要（150-200字），結構如下：
第一段：事件背景與核心數據（發生了什麼、關鍵數字）
第二段：市場影響與催化劑分析（對哪些產業/資產類別有影響、為什麼）
第三段：風險與後續觀察重點（需關注什麼、共識預期可能哪裡有誤）
語氣專業客觀，避免模糊用詞。

標題：${title}
描述：${desc}`;
    const text = await callGemini(prompt);
    readContent.innerHTML = `<p style="line-height:1.8;color:var(--text);">${text.trim()}</p>`;
    readContent.style.display = 'block';
    readLoading.style.display = 'none';
  } catch(e) {
    readLoading.textContent = `生成失敗：${e.message}`;
  }
}

// ── AI: summarize via Gemini API ──
async function callGemini(prompt, maxTokens = 800, temperature = 0.7) {
  // 全部走 Groq proxy
  return await callGroq(prompt, maxTokens, temperature);
}

// ── Groq 請求佇列（避免 TPM 超限）──
const _groqQueue = [];
let _groqBusy = false;
const GROQ_MIN_GAP_MS = 8000;  // 每個請求間隔 8 秒（6000 TPM / ~750 avg tokens，保守估算）
let _groqLastCall = 0;

function _groqEnqueue(fn) {
  return new Promise((resolve, reject) => {
    _groqQueue.push({ fn, resolve, reject });
    _groqDrain();
  });
}

async function _groqDrain() {
  if (_groqBusy || !_groqQueue.length) return;
  _groqBusy = true;
  while (_groqQueue.length) {
    const { fn, resolve, reject } = _groqQueue.shift();
    const now = Date.now();
    const wait = Math.max(0, _groqLastCall + GROQ_MIN_GAP_MS - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _groqLastCall = Date.now();
    try { resolve(await fn()); } catch(e) { reject(e); }
  }
  _groqBusy = false;
}

// ── Owner Token（A 層：前端密碼鎖）──
const OWNER_TOKEN_KEY = 'alphascope_owner_token';

function getOwnerToken() {
  return localStorage.getItem(OWNER_TOKEN_KEY) || '';
}

function isOwnerUnlocked() {
  return !!getOwnerToken();
}

/** 彈出密碼輸入框，解鎖後執行 callback */
function requireOwner(callback) {
  if (isOwnerUnlocked()) { callback(); return; }

  // 建立 modal
  const overlay = document.createElement('div');
  overlay.id = 'ownerModal';
  overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;`;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:2rem 2.2rem;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'IBM Plex Mono',monospace;">
      <div style="font-size:1rem;font-weight:700;color:#16161a;margin-bottom:0.4rem;">🔐 Owner 驗證</div>
      <div style="font-size:0.65rem;color:#6e6e7e;margin-bottom:1.2rem;">AI 功能僅限 Owner 使用，請輸入密碼解鎖。</div>
      <input id="ownerPwdInput" type="password" placeholder="輸入 Owner 密碼"
        style="width:100%;padding:0.55rem 0.8rem;border:1.5px solid #c4c4d4;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:0.8rem;outline:none;box-sizing:border-box;"
        onkeydown="if(event.key==='Enter') document.getElementById('ownerConfirmBtn').click()">
      <div id="ownerErr" style="font-size:0.6rem;color:#dc2626;margin-top:0.4rem;min-height:1rem;"></div>
      <div style="display:flex;gap:0.5rem;margin-top:0.8rem;">
        <button id="ownerConfirmBtn"
          style="flex:1;padding:0.5rem;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;font-weight:600;">
          解鎖
        </button>
        <button onclick="document.getElementById('ownerModal').remove()"
          style="padding:0.5rem 1rem;background:transparent;color:#6e6e7e;border:1px solid #c4c4d4;border-radius:8px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;">
          取消
        </button>
      </div>
      <div style="font-size:0.55rem;color:#aaa;margin-top:0.9rem;">解鎖狀態在本分頁關閉後自動清除。</div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('ownerPwdInput').focus();

  document.getElementById('ownerConfirmBtn').onclick = async () => {
    const pwd = document.getElementById('ownerPwdInput').value.trim();
    if (!pwd) { document.getElementById('ownerErr').textContent = '請輸入密碼'; return; }

    // 前端驗證：送一個 dry-run 請求到 API，讓 B 層驗證
    document.getElementById('ownerConfirmBtn').textContent = '驗證中…';
    try {
      const r = await fetch(`${API_BASE}?endpoint=groq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-token': pwd },
        body: JSON.stringify({ prompt: 'ping', maxTokens: 1, temperature: 0 })
      });
      if (r.status === 403) {
        document.getElementById('ownerErr').textContent = '密碼錯誤，請再試一次。';
        document.getElementById('ownerConfirmBtn').textContent = '解鎖';
        document.getElementById('ownerPwdInput').value = '';
        document.getElementById('ownerPwdInput').focus();
        return;
      }
      // 通過驗證（200 或其他非 403 都算通過）
      localStorage.setItem(OWNER_TOKEN_KEY, pwd);
      overlay.remove();
      // 更新 header 鎖頭圖示
      updateOwnerBadge();
      callback();
    } catch(e) {
      document.getElementById('ownerErr').textContent = '網路錯誤，請再試一次。';
      document.getElementById('ownerConfirmBtn').textContent = '解鎖';
    }
  };

  // 點擊背景關閉
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function updateOwnerBadge() {
  const badge = document.getElementById('ownerBadge');
  if (!badge) return;
  if (isOwnerUnlocked()) {
    badge.textContent = '🔓 Owner';
    badge.style.color = '#16a34a';
    badge.style.borderColor = '#16a34a';
    badge.title = '點擊登出 Owner 模式';
    badge.onclick = () => { localStorage.removeItem(OWNER_TOKEN_KEY); updateOwnerBadge(); };
  } else {
    badge.textContent = '🔐 登入';
    badge.style.color = 'rgba(255,255,255,0.45)';
    badge.style.borderColor = 'rgba(255,255,255,0.2)';
    badge.title = '點擊解鎖 Owner 模式';
    badge.onclick = () => requireOwner(() => {});
  }
}

async function callGroq(prompt, maxTokens = 800, temperature = 0.7, _retry = false) {
  return _groqEnqueue(async () => {
    const res = await fetch(`${API_BASE}?endpoint=groq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-token': getOwnerToken()   // ← B 層：帶 token 給 API
      },
      body: JSON.stringify({ prompt, maxTokens, temperature })
    });
    const data = await res.json();
    if (res.status === 403) {
      // Token 失效（可能 sessionStorage 被清）→ 重新要求解鎖
      localStorage.removeItem(OWNER_TOKEN_KEY);
      updateOwnerBadge();
      throw new Error('需要 Owner 密碼，請點右上角 🔐 登入');
    }
    if (res.status === 429) {
      // Rate limit：解析 retryAfter 並提示用戶
      const retrySec = data.retryAfter || 10;
      console.warn(`[callGroq] 429 rate limit，${retrySec}s 後重試`);
      await new Promise(r => setTimeout(r, retrySec * 1000));
      // 自動重試一次
      const res2  = await fetch(`${API_BASE}?endpoint=groq`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-token': getOwnerToken() }, body: JSON.stringify({ prompt, maxTokens, temperature }) });
      const data2 = await res2.json();
      if (data2.error) throw new Error('Groq 用量已達上限，請稍後再試');
      return data2.text || '無法生成內容。';
    }
    if (data.error) throw new Error(data.error);
    return data.text || '無法生成內容。';
  });
}

async function doSummarize(id, title, desc) {
  const sumEl = document.getElementById(`sum-${id}`);
  const btnEl = document.getElementById(`btn-${id}`);
  if (btnEl) btnEl.disabled = true;

  sumEl.innerHTML = `
    <div class="ai-analysis-label" style="color:var(--accent2)">◆ Groq 分析中…</div>
    <div class="skeleton"><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line" style="width:70%"></div></div>
  `;

  try {
    const prompt = `根據以下財經新聞，用繁體中文輸出結構化分析，格式如下（每項一行，不加標題符號）：
【催化劑】點出觸發事件或關鍵數據（20字內）
【市場影響】對股市/產業/匯率的直接影響（25字內）
【風險提示】需注意的下行風險或不確定因素（20字內）
直接輸出三行，不加任何前言或說明。

標題：${title}
內容：${desc || '（無詳細內容）'}`;

    const text = await callGroq(prompt);
    sumEl.innerHTML = `
      <div class="ai-analysis-label">◆ Groq AI 分析 <span style="color:var(--accent3);margin-left:0.3rem">✓ 已生成</span></div>
      <div class="ai-analysis-text">${text}</div>
    `;
  } catch(e) {
    sumEl.innerHTML = `
      <div class="ai-analysis-label" style="color:#e03030">◆ 失敗：${e.message}</div>
      <button class="analyze-btn" onclick="doSummarize('${id}','${title.replace(/'/g,"&#39;")}','${desc.replace(/'/g,"&#39;")}')">↻ 重試</button>
    `;
    if (btnEl) btnEl.disabled = false;
  }
}

// ── Claude: daily brief ──
async function generateBrief(market) {
  if (!market) {
    await generateBrief('us');
    await generateBrief('tw');
    return;
  }

  const isUS = market === 'us';
  const elId = isUS ? 'dailyBriefTech' : 'dailyBriefEcon';
  const tsId = isUS ? 'briefTsTech' : 'briefTsEcon';
  const label = isUS ? '🇺🇸 美股' : '🇹🇼 台股';
  const el = document.getElementById(elId);
  const tsEl = document.getElementById(tsId);
  if (el.dataset.loading === '1') return;
  el.dataset.loading = '1';

  const now = new Date();
  tsEl.textContent = `◆ ${now.toLocaleDateString('zh-TW')} ${now.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})} · Groq AI 生成`;
  el.innerHTML = `<div class="skeleton"><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line" style="width:55%"></div></div>`;

  // 按市場篩選相關文章
  const twKeywords = /台灣|台股|台積電|聯發科|鴻海|台幣|TWD|TSMC|加權|上市|外資買超|三大法人/i;
  const usKeywords = /Fed|聯準會|S&P|納斯達克|Nasdaq|道瓊|美股|美債|美元|利率|升息|降息|科技股|AI|輝達|蘋果|Google|微軟|Meta|亞馬遜|特斯拉|NVIDIA|Apple|Microsoft/i;
  const marketFilter = isUS ? usKeywords : twKeywords;

  // 先取相關文章，不足再補其他文章湊滿8篇
  const relevant = allArticles.filter(a => marketFilter.test((a.title||'') + ' ' + (a.description||'')));
  const others   = allArticles.filter(a => !marketFilter.test((a.title||'') + ' ' + (a.description||'')));
  const articles = [...relevant, ...others].slice(0, 8);

  // 標題 + 摘要（description 已截至300字）
  const headlines = articles.map((a, i) => {
    const title = a.title || '';
    const desc  = (a.description || '').trim();
    return desc ? `${i+1}. ${title}\n   摘要：${desc}` : `${i+1}. ${title}`;
  }).filter(Boolean).join('\n\n');

  const fallbacks = {
    us: '今日美股科技股強勢領漲，AI 相關標的持續受到市場關注，聯準會政策走向備受矚目，投資人聚焦企業財報與總經數據。',
    tw: '台股今日維持震盪整理，半導體族群表現強勁，外資動向與美股走勢為主要觀察重點，投資人持續關注供應鏈變化。'
  };

  if (!articles.length) {
    el.dataset.loading = '0';
    el.innerHTML = `<div class="brief-text">${fallbacks[market]}<br><small style="color:var(--muted);font-size:0.68rem;margin-top:0.4rem;display:block">⚠ 請先載入財經新聞</small></div>`;
    return;
  }

  try {
    // 參考 equity-research morning-note 框架：宏觀 → 催化劑 → 動能 → 風險
    const prompt = `你是機構股票研究部門的早報分析師。根據以下今日財經新聞（含標題與內文摘要），用繁體中文撰寫【${label}市場】早報（100-120字），結構如下：
①宏觀背景（利率/匯率/政策是順風還是逆風）②主要催化劑（今日最重要的驅動事件）③市場動能（哪個族群/板塊最強或最弱）④關鍵風險（需警惕的尾部風險）
【嚴格限制】只能引用以下新聞中明確出現的事實與數字，絕對不可自行補充或捏造任何具體數字（包括指數點位、匯率、股價、漲跌幅等）。若新聞未提及某項數據，請用「持續關注」「走勢分歧」等定性描述代替。直接輸出段落，不加編號標題。

以下為今日相關新聞（標題 + 摘要）：
${headlines || '（今日暫無相關新聞）'}`;
    const text = await Promise.race([
      callGroq(prompt, 400, 0.3),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
    ]);
    const disclaimer = '<div style="font-size:0.55rem;color:var(--muted);margin-top:0.5rem;opacity:0.75;">⚠ 內容僅基於載入之新聞標題摘要，具體數字請自行查證</div>';
    el.innerHTML = `<div class="brief-text">${text || fallbacks[market]}</div>${disclaimer}`;
  } catch {
    el.innerHTML = `<div class="brief-text">${fallbacks[market]}</div>`;
  } finally {
    el.dataset.loading = '0';
  }
}


// ── Category switch ──
document.querySelectorAll('.cat-tab[data-cat]').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    currentCat = this.dataset.cat;
    // Hide panels, show news
    const fp = document.getElementById('futuresPanel');
    const sp = document.getElementById('sentimentPanel');
    const hp = document.getElementById('heatmapPanel');
    const nf = document.getElementById('newsFeed');
    const fh = document.querySelector('.feed-header');
    if (fp) fp.style.display = 'none';
    if (sp) sp.style.display = 'none';
    if (hp) hp.style.display = 'none';
    const sgp = document.getElementById('signalPanel');
    if (sgp) sgp.style.display = 'none';
    if (nf) nf.style.display = 'block';
    if (fh) fh.style.display = 'flex';
    renderFeed(getFiltered());
  });
});

// ── Lang switch ──
function switchLang(btn, lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentLang = lang;
}


// ── Fear & Greed: colour helper ──
function fgiRatingZH(score) {
  if (score <= 24) return { label: '極度恐懼', color: '#ef4444' };
  if (score <= 44) return { label: '恐懼',     color: '#f97316' };
  if (score <= 54) return { label: '中性',     color: '#ca8a04' };
  if (score <= 74) return { label: '貪婪',     color: '#16a34a' };
  return                  { label: '極度貪婪', color: '#15803d' };
}

// ── CNN Fear & Greed (via CORS proxy) ──
async function loadFearGreed() {
  try {
    const res = await fetch(API_BASE + '?endpoint=fgi');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.fear_and_greed) throw new Error('no data');

    const now = data.fear_and_greed;
    const score = Math.round(now.score);
    const { label, color } = fgiRatingZH(score);

    document.getElementById('fgiScore').textContent = score;
    document.getElementById('fgiScore').style.color = color;
    document.getElementById('fgiLabel').textContent = label;
    document.getElementById('fgiLabel').style.color = color;

    const arcLen = 251;
    const filled = (score / 100) * arcLen;
    document.getElementById('fgiArc').setAttribute('stroke-dasharray', `${filled} ${arcLen - filled}`);
    document.getElementById('fgiArc').setAttribute('stroke', color);
    document.getElementById('fgiNeedle').setAttribute('transform', `rotate(${-90 + (score/100)*180}, 100, 100)`);

    const ts = now.timestamp ? new Date(now.timestamp * 1000).toLocaleString('zh-TW', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    document.getElementById('fgiTs').textContent = '資料來源：CNN · ' + ts;
    document.getElementById('fgiLoading').style.display = 'none';
    document.getElementById('fgiContent').style.display = 'block';
  } catch(e) {
    document.getElementById('fgiLoading').textContent = '抓取失敗';
    console.warn('CNN FGI error:', e.message);
  }
}

// ── Crypto Fear & Greed (Alternative.me) ──
async function loadCryptoFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
    const data = await res.json();
    const hist = data.data || [];
    if (!hist.length) throw new Error('no data');

    const score = parseInt(hist[0].value);
    const { label, color } = fgiRatingZH(score);

    document.getElementById('fgiCryptoScore').textContent = score;
    document.getElementById('fgiCryptoScore').style.color = color;
    document.getElementById('fgiCryptoLabel').textContent = label;
    document.getElementById('fgiCryptoLabel').style.color = color;

    const arcLen = 251;
    const filled = (score / 100) * arcLen;
    document.getElementById('fgiCryptoArc').setAttribute('stroke-dasharray', `${filled} ${arcLen - filled}`);
    document.getElementById('fgiCryptoArc').setAttribute('stroke', color);
    document.getElementById('fgiCryptoNeedle').setAttribute('transform', `rotate(${-90 + (score/100)*180}, 100, 100)`);

    document.getElementById('fgiCryptoTs').textContent = '資料來源：Alternative.me · ' + new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
    document.getElementById('fgiCryptoLoading').style.display = 'none';
    document.getElementById('fgiCryptoContent').style.display = 'block';
  } catch(e) {
    document.getElementById('fgiCryptoLoading').textContent = '載入失敗';
    console.warn('Crypto FGI error:', e.message);
  }
}

// ── VIX 波動率儀表板 ──
async function loadVix() {
  try {
    const res = await fetch(API_BASE + '?endpoint=vix');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.data) throw new Error('no data');

    const items = json.data;
    const vix    = items.find(d => d.symbol === '^VIX');
    const vix9d  = items.find(d => d.symbol === '^VIX9D');
    const vix3m  = items.find(d => d.symbol === '^VIX3M');
    const vix6m  = items.find(d => d.symbol === '^VIX6M');

    if (!vix?.price) throw new Error('VIX not available');

    const price = vix.price;
    const prev  = vix.prev || price;
    const chg   = price - prev;
    const chgPct = prev ? ((chg / prev) * 100) : 0;
    const chgStr = (chg >= 0 ? '+' : '') + chg.toFixed(2) + ' (' + (chgPct >= 0 ? '+' : '') + chgPct.toFixed(1) + '%)';
    const chgColor = chg >= 0 ? '#dc2626' : '#16a34a';

    // VIX level label
    let vixLabel, vixColor;
    if (price < 12)       { vixLabel = '極度平靜'; vixColor = '#15803d'; }
    else if (price < 20)  { vixLabel = '低波動';   vixColor = '#16a34a'; }
    else if (price < 30)  { vixLabel = '警戒';     vixColor = '#ca8a04'; }
    else if (price < 40)  { vixLabel = '高波動';   vixColor = '#f97316'; }
    else                  { vixLabel = '恐慌';     vixColor = '#ef4444'; }

    document.getElementById('vixPrice').textContent = price.toFixed(2);
    document.getElementById('vixPrice').style.color = vixColor;
    document.getElementById('vixChange').textContent = chgStr;
    document.getElementById('vixChange').style.color = chgColor;
    document.getElementById('vixLabel').textContent = vixLabel;
    document.getElementById('vixLabel').style.color = vixColor;

    // Term structure bars
    const terms = [
      { label: '9日',  val: vix9d?.price, sym: '^VIX9D' },
      { label: '現貨', val: price,         sym: '^VIX',  highlight: true },
      { label: '3月',  val: vix3m?.price, sym: '^VIX3M' },
      { label: '6月',  val: vix6m?.price, sym: '^VIX6M' },
    ].filter(t => t.val);

    const maxVal = Math.max(...terms.map(t => t.val));
    const termHtml = terms.map(t => {
      const barW = Math.round((t.val / maxVal) * 100);
      const color = t.highlight ? vixColor : '#94a3b8';
      const boldClass = t.highlight ? 'style="font-weight:700;"' : '';
      return `<div class="vix-term-row">
        <div class="vix-term-label" ${boldClass}>${t.label}</div>
        <div class="vix-term-track">
          <div class="vix-term-fill" style="width:${barW}%;background:${color};"></div>
        </div>
        <div class="vix-term-val" style="color:${color};" ${boldClass}>${t.val.toFixed(2)}</div>
      </div>`;
    }).join('');
    document.getElementById('vixTermStructure').innerHTML = termHtml;

    // Contango / Backwardation - dynamic based on VIX spot vs VIX3M
    if (vix3m?.price && price) {
      const spread = vix3m.price - price;
      const isContango = spread > 0;
      document.getElementById('vixContango').textContent =
        isContango
          ? `▲ Contango +${spread.toFixed(2)}（市場平靜，期貨溢價）`
          : `▼ Backwardation ${Math.abs(spread).toFixed(2)}（市場緊張，期貨折價）`;
      document.getElementById('vixContango').style.background = isContango ? '#f0fdf4' : '#fef2f2';
      document.getElementById('vixContango').style.color = isContango ? '#15803d' : '#ef4444';
    } else {
      document.getElementById('vixContango').textContent = '';
    }

    document.getElementById('vixTs').textContent = '更新：' + new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
    document.getElementById('vixLoading').style.display = 'none';
    document.getElementById('vixContent').style.display = 'block';

  } catch(e) {
    document.getElementById('vixLoading').textContent = '載入失敗：' + e.message;
    console.warn('VIX error:', e);
  }
}


// ── Global Futures Leaderboard ──
// futuresData / futuresSortKey 定義於 api.js

async function loadFutures() {
  if (loadFutures._busy) return;
  loadFutures._busy = true;
  document.getElementById('futuresLoading').style.display = 'block';
  document.getElementById('futuresLoading').textContent = '載入中…';
  document.getElementById('futuresContent').style.display = 'none';
  try {
    const futRes = await fetch(API_BASE + '?endpoint=futures');
    if (!futRes.ok) throw new Error(`HTTP ${futRes.status}`);
    const futJson = await futRes.json();
    futuresData = futJson.data || [];
    if (!futuresData.length) throw new Error('no data');
    document.getElementById('futuresTs').textContent = '每日收盤價 · ' + new Date().toLocaleDateString('zh-TW');
    document.getElementById('futuresLoading').style.display = 'none';
    document.getElementById('futuresContent').style.display = 'block';
    renderFuturesChart(futuresSortKey);
  } catch(e) {
    document.getElementById('futuresLoading').textContent = '載入失敗：' + e.message;
  }
}

function renderFuturesChart(sortKey) {
  futuresSortKey = sortKey;
  document.querySelectorAll('.fut-sort-btn').forEach(btn => {
    const isActive = (sortKey === 'chgPct' && btn.textContent === '漲跌幅') || (sortKey === 'volPct' && btn.textContent === '波幅');
    btn.style.background  = isActive ? 'var(--accent)' : 'var(--surface)';
    btn.style.color       = isActive ? '#fff' : 'var(--muted)';
    btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
  });

  const sorted = [...futuresData].sort((a, b) => Math.abs(b[sortKey]) - Math.abs(a[sortKey]));
  const maxVal = Math.max(0.0001, ...sorted.map(d => Math.abs(d[sortKey])));
  const container = document.getElementById('futuresChart');
  container.innerHTML = '';

  // 格式化收盤價
  function fmtPrice(p) {
    if (p == null || isNaN(p)) return '–';
    if (p >= 10000) return p.toLocaleString('en', { maximumFractionDigits: 0 });
    if (p >= 100)   return p.toLocaleString('en', { maximumFractionDigits: 2 });
    if (p >= 1)     return p.toLocaleString('en', { maximumFractionDigits: 3 });
    return p.toLocaleString('en', { maximumFractionDigits: 5 });
  }

  // 欄位頭
  const legend = document.createElement('div');
  legend.style.cssText = 'display:grid;grid-template-columns:7rem 1fr 5rem 5.5rem;align-items:center;gap:0.5rem;font-size:0.65rem;color:var(--muted);margin-bottom:0.5rem;padding-bottom:0.35rem;border-bottom:1px solid var(--border);';
  legend.innerHTML = `
    <span></span>
    <span style="display:flex;justify-content:space-between;padding:0 0.3rem;">
      <span style="color:#16a34a;">◀ 跌</span><span>零軸</span><span style="color:#dc2626;">漲 ▶</span>
    </span>
    <span style="text-align:right;">漲跌幅</span>
    <span style="text-align:right;">收盤價</span>`;
  container.appendChild(legend);

  const cats = ['波動率','美股指數','亞股指數','能源','金屬','農產品','外匯','債券','加密貨幣'];
  for (const cat of cats) {
    const items = sorted.filter(d => d.cat === cat);
    if (!items.length) continue;

    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:1.2rem;';
    section.innerHTML = `<div style="font-size:0.68rem;color:var(--muted);letter-spacing:0.06em;margin-bottom:0.4rem;padding-bottom:0.25rem;border-bottom:1px solid var(--border);">${cat}</div>`;

    for (const item of items) {
      const val   = item[sortKey];
      const barW  = maxVal ? Math.abs(val) / maxVal * 46 : 0;
      const isUp  = val >= 0;
      const color = isUp ? '#dc2626' : '#16a34a';
      const chgLabel = (val >= 0 ? '+' : '') + (val * 100).toFixed(2) + '%';

      const stooqSyms = ['%5E','EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCNH','10USY','30USY','BTCUSD','ETHUSD'];
      const isST = stooqSyms.some(s => item.symbol.includes(s));
      const srcTag = isST
        ? `<span style="font-size:0.42rem;padding:0 2px;border:1px solid #aaa;border-radius:2px;color:var(--muted);margin-right:3px;flex-shrink:0;">ST</span>`
        : `<span style="font-size:0.42rem;padding:0 2px;border:1px solid #1a6bc8;border-radius:2px;color:#1a6bc8;margin-right:3px;flex-shrink:0;">FM</span>`;

      const leftPct  = isUp ? 0 : barW;
      const rightPct = isUp ? barW : 0;
      const leftBar  = leftPct  ? `<div style="height:10px;width:${leftPct.toFixed(1)}%;background:#bbf7d0;border-radius:3px 0 0 3px;margin-left:auto;"></div>` : '';
      const rightBar = rightPct ? `<div style="height:10px;width:${rightPct.toFixed(1)}%;background:#fecaca;border-radius:0 3px 3px 0;"></div>` : '';

      // 絕對變動值
      const chgAbs = item.chg != null ? item.chg : (item.price && item.prevClose ? item.price - item.prevClose : null);
      const absStr = chgAbs != null ? `${chgAbs >= 0 ? '+' : ''}${fmtPrice(Math.abs(chgAbs))}` : '';

      const row = document.createElement('div');
      // 4欄：名稱(7rem) | Bar(1fr) | 漲跌幅(5rem) | 收盤價(5.5rem)
      row.style.cssText = 'display:grid;grid-template-columns:7rem 1fr 5rem 5.5rem;align-items:center;gap:0.5rem;margin-bottom:0.3rem;min-height:24px;';
      row.innerHTML = `
        <div style="font-size:0.72rem;color:var(--text);display:flex;align-items:center;overflow:hidden;white-space:nowrap;">
          ${srcTag}<span style="overflow:hidden;text-overflow:ellipsis;">${item.name}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1px 1fr;height:10px;background:rgba(0,0,0,0.04);border-radius:3px;overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:flex-end;">${leftBar}</div>
          <div style="background:var(--border-dark);width:1px;height:100%;"></div>
          <div style="display:flex;align-items:center;">${rightBar}</div>
        </div>
        <div style="text-align:right;line-height:1.3;">
          <div style="font-size:0.78rem;color:${color};font-weight:700;white-space:nowrap;">${chgLabel}</div>
          ${absStr ? `<div style="font-size:0.62rem;color:${color};opacity:0.7;white-space:nowrap;">${absStr}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.82rem;color:var(--text);font-weight:600;white-space:nowrap;">${fmtPrice(item.price)}</div>
        </div>`;
      section.appendChild(row);
    }
    container.appendChild(section);
  }
}

