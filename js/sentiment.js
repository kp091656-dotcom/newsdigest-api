// ════════════════════════════════════════════════
// 社群情緒儀表板
// ════════════════════════════════════════════════
let sentAllPosts = [];
let sentCurSrc  = 'all';
let sentCurSent = 'all';

function showSentiment() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('sentimentTab').classList.add('active');
  document.getElementById('newsFeed').style.display = 'none';
  const gp = document.getElementById('giftsPanel'); if (gp) gp.style.display = 'none';
  document.getElementById('loadMoreBtn').style.display = 'none';
  document.querySelector('.feed-header').style.display = 'none';
  document.getElementById('futuresPanel').style.display = 'none';
  document.getElementById('heatmapPanel').style.display = 'none';
  document.getElementById('signalPanel').style.display = 'none';
  document.getElementById('sentimentPanel').style.display = 'block';
}

function hideSentiment() {
  document.getElementById('sentimentPanel').style.display = 'none';
  document.getElementById('newsFeed').style.display = 'block';
  document.querySelector('.feed-header').style.display = 'flex';
}

function sentSetGauge(score) {
  const deg = (score / 100) * 180 - 90;
  document.getElementById('sentNeedle').setAttribute('transform', `rotate(${deg},100,100)`);
  const v = document.getElementById('sentGaugeValue');
  const l = document.getElementById('sentGaugeLabel');
  v.textContent = score;
  if (score >= 60)      { v.style.color = '#dc2626'; l.textContent = '偏多頭'; l.style.color = '#dc2626'; }
  else if (score <= 40) { v.style.color = '#16a34a'; l.textContent = '偏空頭'; l.style.color = '#16a34a'; }
  else                  { v.style.color = 'var(--muted)'; l.textContent = '中性偏觀望'; l.style.color = 'var(--muted)'; }
}

function sentRenderDashboard(posts) {
  const bull = posts.filter(p => p.sentiment === 'bull').length;
  const bear = posts.filter(p => p.sentiment === 'bear').length;
  const neu  = posts.filter(p => p.sentiment === 'neutral').length;
  const total = posts.length || 1;
  document.getElementById('sentBullBar').style.width = (bull/total*100)+'%'; document.getElementById('sentBullBar').style.background='#dc2626';
  document.getElementById('sentBearBar').style.width = (bear/total*100)+'%'; document.getElementById('sentBearBar').style.background='#16a34a';
  document.getElementById('sentNeuBar').style.width  = (neu/total*100)+'%';
  document.getElementById('sentBullCnt').textContent = bull;
  document.getElementById('sentBearCnt').textContent = bear;
  document.getElementById('sentNeuCnt').textContent  = neu;
  const score = Math.min(100, Math.max(0, Math.round(50 + ((bull-bear)/total)*50)));
  sentSetGauge(score);
  // per-source breakdown — 三色分段條 + 數字
  const sb = document.getElementById('sentSrcBreakdown');
  sb.innerHTML = ['ptt','wsb','inv'].map(src => {
    const sp    = posts.filter(p => p.source === src);
    const bull  = sp.filter(p => p.sentiment === 'bull').length;
    const neu   = sp.filter(p => p.sentiment === 'neutral').length;
    const bear  = sp.filter(p => p.sentiment === 'bear').length;
    const total = sp.length || 1;
    const bPct  = Math.round(bull/total*100);
    const nPct  = Math.round(neu/total*100);
    const ePct  = 100 - bPct - nPct;
    const lbl   = src === 'ptt' ? 'PTT' : src === 'wsb' ? 'WSB' : 'INV';
    const badgeBg  = src === 'ptt' ? '#fee2e2' : src === 'wsb' ? '#ede9fe' : '#dbeafe';
    const badgeClr = src === 'ptt' ? '#8b1a1a' : src === 'wsb' ? '#7c3010' : '#0c447c';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;font-weight:500;padding:1px 5px;border-radius:3px;background:${badgeBg};color:${badgeClr};width:30px;text-align:center;flex-shrink:0;">${lbl}</span>
      <div style="flex:1;height:13px;background:var(--surface2,#edeae3);border-radius:3px;overflow:hidden;display:flex;">
        <div style="width:${bPct}%;background:#dc2626;height:100%;transition:width 0.8s;"></div>
        <div style="width:${nPct}%;background:#b4b2a9;height:100%;transition:width 0.8s;"></div>
        <div style="width:${ePct}%;background:var(--accent3);height:100%;transition:width 0.8s;"></div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;white-space:nowrap;display:flex;gap:4px;min-width:80px;">
        <span style="color:var(--accent);font-weight:500;">多${bull}</span>
        <span style="color:var(--muted);">中${neu}</span>
        <span style="color:var(--accent3);font-weight:500;">空${bear}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('sentimentTs').textContent =
    `更新：${new Date().toLocaleTimeString('zh-TW')} · ${posts.length} 篇`;
  sentRenderPosts();
}

function sentRenderPosts() {
  let filtered = sentAllPosts;
  if (sentCurSrc  !== 'all') filtered = filtered.filter(p => p.source === sentCurSrc);
  if (sentCurSent !== 'all') filtered = filtered.filter(p => p.sentiment === sentCurSent);
  const srcBadge = s =>
    s==='ptt' ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;padding:1px 5px;border-radius:2px;background:#fde;color:#e44;border:1px solid #fcc;">PTT</span>`
    : s==='wsb' ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;padding:1px 5px;border-radius:2px;background:#ffe8dc;color:var(--accent);border:1px solid #fcc;">WSB</span>`
    : `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;padding:1px 5px;border-radius:2px;background:#dde8f8;color:var(--accent2);border:1px solid #c0d4ef;">INV</span>`;
  if (!filtered.length) {
    document.getElementById('sentPostList').innerHTML = `<div style="text-align:center;padding:28px;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.75rem;">沒有符合條件的貼文</div>`;
    return;
  }
  document.getElementById('sentPostList').innerHTML = filtered.map(p => {
    const sc = p.sentiment==='bull' ? 'sent-bull' : p.sentiment==='bear' ? 'sent-bear' : 'sent-neutral';
    const sl = p.sentiment==='bull' ? '多頭' : p.sentiment==='bear' ? '空頭' : '中性';
    const safeUrl = p.url ? p.url.replace(/'/g,'%27') : '';
    const clickable = safeUrl ? `style="cursor:pointer;" onclick="window.open('${safeUrl}','_blank')" title="點擊開啟原文"` : '';
    const linkIcon  = safeUrl ? `<span style="font-size:0.55rem;color:var(--accent2);margin-left:4px;opacity:0.8;">↗</span>` : '';
    return `<div class="sent-post-card" ${clickable}>
      <span class="sent-s-pill ${sc}">${sl}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.83rem;line-height:1.4;margin-bottom:4px;">${p.title_zh||p.title}${linkIcon}</div>
        ${p.title_zh && p.title_zh !== p.title ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);margin-bottom:3px;">${p.title}</div>` : ''}
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${srcBadge(p.source)}<span>${p.time}</span>${p.reason?`<span>${p.reason}</span>`:''}
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--muted);text-align:right;white-space:nowrap;min-width:56px;">
        <strong style="display:block;font-size:0.85rem;color:${(p.rank&&p.rank<=5)?'var(--accent)':'var(--text)'};">${p.rank ? '#'+p.rank : '—'}</strong>
        <span style="font-size:0.6rem;">${p.source==='ptt'?'時間排名':'熱度排名'}</span>
        ${p.source==='ptt' && p.pushes ? `<div style="font-size:0.6rem;color:${p.pushes>0?'#dc2626':p.pushes<0?'#16a34a':'#aaa'};">推${p.pushes>0?'+':''}${p.pushes}</div>` : ''}
        ${p.confidence ? `<div style="font-size:0.55rem;margin-top:2px;color:${p.confidence==='high'?'var(--accent3)':p.confidence==='low'?'#aaa':'var(--accent2)'};">${p.confidence==='high'?'◆高信心':p.confidence==='low'?'◇低信心':'◈中信心'}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function sentFilterSrc(src, el) {
  sentCurSrc = src;
  document.querySelectorAll('.sent-src-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  sentRenderPosts();
}

function sentFilterSentiment(s, el) {
  sentCurSent = s;
  document.querySelectorAll('.sent-pill').forEach(p => { p.className = 'sent-pill'; });
  el.className = `sent-pill active-${s}`;
  sentRenderPosts();
}

async function sentFetchPTT() {
  // 透過 Vercel API proxy 抓 PTT Stock RSS
  try {
    const res  = await fetch(API_BASE + '?endpoint=ptt');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return (json.data || []).map(e => {
      const ts = e.updated ? new Date(e.updated).getTime() : 0;
      return {
        title:  e.title,
        body:   e.body || '',
        pushes: e.pushes || 0,
        rank:   e.rank  || 0,
        time:   e.updated ? new Date(e.updated).toLocaleDateString('zh-TW') : '',
        score:  e.pushes || 0,
        source: 'ptt',
        url:    e.link || '',
        sentiment: null,
        reason: '',
        ts,
      };
    }).slice(0, 20);
  } catch(e) {
    console.warn('PTT proxy failed:', e.message);
    return [];
  }
}

async function sentFetchReddit(sub) {
  // 透過 Vercel proxy 抓 Reddit RSS（server-side fetch，無 CORS 問題）
  const srcKey = sub === 'wallstreetbets' ? 'wsb' : 'inv';
  const now24  = Date.now() - 24 * 60 * 60 * 1000;
  const seen   = new Set();
  let posts    = [];

  for (const sort of ['hot', 'new']) {
    let data = null;
    // 最多 retry 2 次（Vercel IP 偶爾被封）
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `${API_BASE}?endpoint=reddit&sub=${sub}&sort=${sort}&limit=25`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        data = json.data || [];
        break; // 成功就跳出 retry
      } catch(e) {
        if (attempt === 0) {
          console.warn(`Reddit ${sub}/${sort} attempt 1 failed: ${e.message}, retrying...`);
          await new Promise(r => setTimeout(r, 3000)); // 等 3 秒再試
        } else {
          console.warn(`Reddit ${sub}/${sort} failed after retry: ${e.message}`);
        }
      }
    }
    if (!data) continue;

    for (const p of data) {
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      const ts = (p.created || 0) * 1000;
      posts.push({
        title:    p.title || '',
        body:     p.body || '',
        time:     ts ? new Date(ts).toLocaleDateString('zh-TW') : '',
        score:    p.score || 0,
        rank:     p.rank || posts.length + 1,
        comments: p.num_comments || 0,
        url:      p.url || '',
        source:   srcKey,
        sentiment: null,
        reason:   '',
        ts,
      });
    }
  }
  const recent = posts.filter(p => p.ts >= now24);
  const older  = posts.filter(p => p.ts < now24);
  return [...recent, ...older].slice(0, 20);
}

async function sentAnalyzeGroq(posts, onStatus) {
  const BATCH = 10; // llama-3.1-8b-instant 較省 token，可加大 batch
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i+BATCH);
    // 組合每篇貼文的分析素材
    const postLines = batch.map((p, j) => {
      const src    = p.source.toUpperCase();
      const engStr = p.source === 'ptt'
        ? `時間排名:#${p.rank||'?'}（越小=越新），推文淨值:${p.pushes>0?'+':''}${p.pushes||0}（正=多推認同）`
        : (p.rank ? `熱度排名:#${p.rank}（Reddit演算法，數字越小越熱門）` : '熱度:未知');
      const body = p.body ? `\n   摘要：${p.body.slice(0, 60)}` : '';
      return `${j}. [${src}] ${p.title}${body}\n   互動→ ${engStr}`;
    }).join('\n');

    // 情緒分析 prompt：參考 equity-research 的催化劑分類框架
    const prompt = `你是財經情緒分析師。分析以下每篇社群貼文的市場情緒。
判斷標準：bull=明確利多催化劑（財報超預期/Fed降息/政策利好/突破技術面），bear=明確利空（盈警/衰退數據/地緣風險/流動性收緊），neutral=資訊/討論型無明確方向。
confidence：high=訊號清晰，mid=需觀察，low=訊息模糊。
reason：點出核心催化劑，8字內繁中（例：「Fed鴿派超預期」「台積電下修展望」）。
輸出純JSON不要其他文字：[{"idx":0,"sentiment":"bull","reason":"8字內繁中","title_zh":"繁中標題","confidence":"high"}]
貼文：
${postLines}`;

    let analyzed = false;
    for (let attempt = 0; attempt < 3 && !analyzed; attempt++) {
      try {
        const rawText = await callGroq(prompt, 900, 0.15);
        // 強健 JSON 提取：取第一個 [ 到最後一個 ] 之間的內容，避免 Groq 夾雜說明文字
        const jsonMatch = rawText.match(/\[.*\]/s);
        if (!jsonMatch) throw new Error('No JSON array found in response');
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.forEach(r => {
          if (batch[r.idx]) {
            batch[r.idx].sentiment   = r.sentiment;
            batch[r.idx].reason      = r.reason || '';
            batch[r.idx].confidence  = r.confidence || 'mid';
            if (r.title_zh) batch[r.idx].title_zh = r.title_zh;
          }
        });
        analyzed = true;
      } catch(e) {
        const is429 = e.message?.includes('429') || e.message?.includes('rate_limit');
        if (is429 && attempt < 2) {
          const waitSec = attempt === 0 ? 35 : 65;
          console.warn(`Groq 429，等 ${waitSec} 秒後重試`); if(onStatus) onStatus(`AI 速率限制，等待 ${waitSec} 秒後重試…`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
        } else {
          console.warn('Groq 分析失敗:', e.message);
          batch.forEach(p => { p.sentiment = p.sentiment || 'neutral'; p.confidence = 'low'; });
          analyzed = true; // 放棄這個 batch
        }
      }
    }
    if (i+BATCH < posts.length) await new Promise(r=>setTimeout(r,4500)); // Groq TPM 限速緩衝
  }
  return posts;
}

async function sentGenerateSummary(posts) {
  const bull=posts.filter(p=>p.sentiment==='bull').length, bear=posts.filter(p=>p.sentiment==='bear').length, neu=posts.filter(p=>p.sentiment==='neutral').length;
  const topPosts = posts.slice(0,8).map(p=>`[${p.source.toUpperCase()}${p.sentiment==='bull'?'↑':p.sentiment==='bear'?'↓':''}] ${p.title_zh||p.title}`).join('；');
  // 參考 wealth-management client-report 框架：情緒分布→分歧點→主題→風險提示
  const prompt = `你是機構資產管理部門的情緒研究員。根據以下社群討論數據，用繁體中文撰寫市場情緒快報（300字以內，段落形式）。
結構：①情緒分布與整體傾向（多空比例意義）②各來源分歧點（PTT vs Reddit 看法差異）③市場主要關注議題（catalysts）④尾部風險提示（where might consensus be wrong）。數據具體，語氣專業，每個段落完整收尾。

數據：PTT ${posts.filter(p=>p.source==='ptt').length}篇（多${posts.filter(p=>p.source==='ptt'&&p.sentiment==='bull').length}/空${posts.filter(p=>p.source==='ptt'&&p.sentiment==='bear').length}）、WSB ${posts.filter(p=>p.source==='wsb').length}篇（多${posts.filter(p=>p.source==='wsb'&&p.sentiment==='bull').length}/空${posts.filter(p=>p.source==='wsb'&&p.sentiment==='bear').length}）、r/investing ${posts.filter(p=>p.source==='inv').length}篇（多${posts.filter(p=>p.source==='inv'&&p.sentiment==='bull').length}/空${posts.filter(p=>p.source==='inv'&&p.sentiment==='bear').length}）
熱門討論：${topPosts}

請分析：1)整體情緒傾向 2)各來源差異 3)主要關注議題 4)短期市場風險提示`;
  try {
    return await callGroq(prompt, 900, 0.5);
  } catch(e) { return null; }
}

async function startSentimentAnalysis() {
  // Groq ready via Vercel proxy
  const btn = document.getElementById('sentimentAnalyzeBtn');
  const setMsg = (msg) => {
    document.getElementById('sentPostList').innerHTML = `<div style="text-align:center;padding:36px;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.75rem;"><div class="spinner" style="margin:0 auto 12px;"></div>${msg}</div>`;
  };
  btn.disabled = true; btn.textContent = '⏳ 抓取中...';
  setMsg('正在從 PTT、Reddit 抓取貼文…');
  document.getElementById('sentAiSummary').style.display = 'none';
  try {
    const [ptt,wsb,inv] = await Promise.all([sentFetchPTT(), sentFetchReddit('wallstreetbets'), sentFetchReddit('investing')]);
    let posts = [...ptt,...wsb,...inv].sort((a,b) => (b.ts||0) - (a.ts||0));
    if (!posts.length) { setMsg('無法取得資料，請改用 Demo 模式'); btn.disabled=false; btn.textContent='▶ 分析'; return; }

    // ── 爬 PTT 文章內文（逐篇，最多 20 篇，避免 Vercel 超時）──
    const pttPosts = posts.filter(p => p.source === 'ptt' && p.link).slice(0, 20);
    if (pttPosts.length) {
      setMsg(`正在讀取 PTT 文章內文（0/${pttPosts.length}）…`);
      for (let i = 0; i < pttPosts.length; i++) {
        try {
          const r = await fetch(API_BASE + `?endpoint=ptt_article&url=${encodeURIComponent(pttPosts[i].link)}`);
          if (r.ok) {
            const d = await r.json();
            pttPosts[i].body   = d.body   || '';
            pttPosts[i].pushes = d.pushes ?? pttPosts[i].pushes;
            pttPosts[i].pushCount = d.pushCount || 0;
            pttPosts[i].booCount  = d.booCount  || 0;
          }
        } catch(e) { /* 單篇失敗不中斷 */ }
        setMsg(`正在讀取 PTT 文章內文（${i+1}/${pttPosts.length}）…`);
        if (i < pttPosts.length - 1) await new Promise(r => setTimeout(r, 300));
      }
    }

    btn.textContent = `⏳ AI 分析 ${posts.length} 篇...`;
    setMsg(`Groq AI 情緒分析中（共 ${posts.length} 篇）…`);
    posts = await sentAnalyzeGroq(posts, setMsg);
    const summary = await sentGenerateSummary(posts);
    if (summary) { document.getElementById('sentAiText').textContent=summary; document.getElementById('sentAiSummary').style.display='block'; }
    sentAllPosts = posts;
    sentRenderDashboard(posts);
  } catch(e) { document.getElementById('sentPostList').innerHTML=`<div style="text-align:center;padding:36px;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:0.75rem;">錯誤：${e.message}</div>`; }
  btn.disabled=false; btn.textContent='▶ 重新分析';
}

function loadSentimentDemo() {
  if (loadSentimentDemo._busy) return;
  loadSentimentDemo._busy = true;
  setTimeout(() => { loadSentimentDemo._busy = false; }, 3000); // 3秒後解鎖
  const demo = [
    {title:'[標的] 台積電 2330 多',time:'03/26',score:85,source:'ptt',sentiment:'bull',reason:'AI 需求強勁',title_zh:'[標的] 台積電 2330 多'},
    {title:'[閒聊] 今天大盤漲很多，是真的嗎',time:'03/26',score:42,source:'ptt',sentiment:'bull',reason:'正面行情',title_zh:'[閒聊] 今天大盤漲很多，是真的嗎'},
    {title:'[新聞] Fed 可能升息，市場震盪',time:'03/26',score:61,source:'ptt',sentiment:'bear',reason:'升息利空',title_zh:'[新聞] Fed 可能升息，市場震盪'},
    {title:'[心得] 這波下跌是好機會嗎？',time:'03/25',score:33,source:'ptt',sentiment:'neutral',reason:'觀望態度',title_zh:'[心得] 這波下跌是好機會嗎？'},
    {title:'[標的] 聯發科 2454 空，目標 1000',time:'03/25',score:28,source:'ptt',sentiment:'bear',reason:'目標做空',title_zh:'[標的] 聯發科 2454 空，目標 1000'},
    {title:'NVDA to $1000 EOY - here is why',time:'03/26',score:12400,source:'wsb',sentiment:'bull',reason:'AI 樂觀',title_zh:'輝達年底目標 1000 美元分析'},
    {title:'I lost everything. YOLO on puts',time:'03/25',score:8900,source:'wsb',sentiment:'bear',reason:'看跌操作',title_zh:'我賠光了，梭哈買賣權'},
    {title:"SPY calls printing, who's with me?",time:'03/26',score:6700,source:'wsb',sentiment:'bull',reason:'買入看漲',title_zh:'SPY 買權大漲，誰跟我一起？'},
    {title:'Fed is going to crash this market',time:'03/25',score:4200,source:'wsb',sentiment:'bear',reason:'Fed 利空',title_zh:'Fed 將導致市場崩潰'},
    {title:'TSMC blows out earnings again 🚀',time:'03/26',score:3300,source:'wsb',sentiment:'bull',reason:'財報亮眼',title_zh:'台積電再度繳出亮眼財報 🚀'},
    {title:'Is the market overvalued? Analysis inside',time:'03/26',score:2800,source:'inv',sentiment:'neutral',reason:'估值分析',title_zh:'市場估值過高了嗎？深度分析'},
    {title:"Why I'm building cash for the correction",time:'03/26',score:2100,source:'inv',sentiment:'bear',reason:'預期修正',title_zh:'為何我正在儲備現金等待修正'},
    {title:'Dollar-cost averaging through volatility',time:'03/25',score:1900,source:'inv',sentiment:'neutral',reason:'定期定額',title_zh:'在波動中堅持定期定額投資'},
    {title:'Tech sector showing strong momentum',time:'03/26',score:1600,source:'inv',sentiment:'bull',reason:'科技動能',title_zh:'科技板塊展現強勁上漲動能'},
    {title:'Inflation data surprises to downside',time:'03/26',score:1400,source:'inv',sentiment:'bull',reason:'通膨降溫',title_zh:'通膨數據優於預期，低於市場預估'},
  ];
  sentAllPosts = demo;
  document.getElementById('sentAiText').textContent = '整體社群情緒偏向多頭，多空比例約為 8:5。PTT 股票版討論聚焦台積電與聯發科，多頭訊號明顯，但部分版友對 Fed 升息疑慮保持謹慎。Reddit WSB 情緒最為兩極，輝達 AI 題材持續吸引多頭資金，但也有大量看跌貼文反映恐懼情緒。r/investing 相對理性，多數討論圍繞估值過高風險與現金部位配置，暗示機構型投資人已開始布局防守。關鍵風險在於 Fed 利率決策不確定性及科技股高估值，短期雖偏多但波動率可能上升。';
  document.getElementById('sentAiSummary').style.display = 'block';
  sentRenderDashboard(demo);
}
// ════════ end sentiment ════════
