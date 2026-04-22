# AlphaScope — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-04-22
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 專案概覽

**名稱：** AlphaScope — AI 驅動財經市場情報網站  
**網址：** https://alphascope-fin.vercel.app  
**GitHub：** github.com/kp091656-dotcom/alphascope-api  
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫  
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|----------------|---------|
| 前端主檔 | `/home/claude/index.html` | `index.html` |
| Vercel API | `/home/claude/news.js` | `api/news.js` |
| K 棒圖 | — | `chart.html` |
| 每日收集腳本 | `/home/claude/collect_market_data.js` | `.github/scripts/collect_market_data.js` |
| Actions（每日收集）| — | `.github/workflows/collect.yml` |
| Actions（TWSE測試）| — | `.github/workflows/test_twse.yml` |

> 每次對話開始，請先上傳 index.html 和 news.js，Claude 複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 8 張）

| 表名 | 來源 | 內容 | 每日筆數 |
|------|------|------|---------|
| `stock_daily` | FinMind | 86支個股收盤、漲跌幅（舊熱圖用，逐步淘汰） | ~86 |
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量 | ~1227 |
| `institutional_daily` | FinMind | 三大法人現貨買賣超 | 1 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 |
| `options_daily` | FinMind | P/C Ratio、Max Pain、法人選擇權 | 1 |
| `futures_daily` | stooq+FinMind | 全球商品/指數 | ~35 |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1070 |

### stock_daily_twse 實際欄位（已確認）
```
id, date, stock_id, name, close, prev, chg_pct, volume, source, created_at
```
- `chg_pct`：小數（0.0122 = +1.22%），前端顯示時 ×100
- `prev`：前日收盤價
- `volume`：成交量

### stock_valuation_daily 欄位（待確認）
- `pbr`：確認存在
- `listed_shares`：⚠️ 可能不存在（查詢會 400），欄位名未確認
- 目前熱圖市值用靜態 `mcap` fallback
- `per` 欄位名稱也待確認（查詢用 `select=stock_id,date,pbr,dividend_yield,per` 會 400）

### Supabase 查詢語法注意
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(stock_id.eq.2330,...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400

### Supabase 前端查詢

```js
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';

async function sbFetch(table, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  });
  return r.json();
}
```

### GitHub Actions 每日收集

**排程：** 台灣時間 20:30（UTC 12:30），週一至週五  
**Node.js：** 24  
**8個並行收集：**
1. FinMind 86支個股 → `stock_daily`
2. FinMind 三大法人 → `institutional_daily`
3. FinMind 融資融券 → `margin_daily`
4. FinMind 台指選擇權 → `options_daily`
5. stooq+FinMind 全球商品 → `futures_daily`
6. TWSE 全上市1227支 → `stock_daily_twse`
7. TWSE 官方產業指數76個 → `sector_index_daily`
8. TWSE 本益比/殖利率 → `stock_valuation_daily`

---

## TWSE OpenAPI（GitHub Actions 可用，Vercel IP 403 封鎖）

**Base URL：** `https://openapi.twse.com.tw/v1`

| endpoint | 內容 | 筆數 |
|----------|------|------|
| `/exchangeReport/STOCK_DAY_ALL` | 全上市個股每日成交 | ~1350 |
| `/exchangeReport/MI_INDEX` | 各類官方指數（含產業）| ~267 |
| `/exchangeReport/MI_MARGN` | 個股融資融券明細 | ~1260 |
| `/exchangeReport/BWIBBU_ALL` | 個股本益比/殖利率/PBR | ~1070 |
| `/opendata/t187ap05_L` | 個股月營收 | ~1056 |
| `/exchangeReport/MI_INDEX20` | 成交量前20名 | 20 |

**三大法人整體買賣超：** TWSE 無提供，繼續用 FinMind。

---

## Vercel API 端點

**Base URL：** `https://alphascope-fin.vercel.app/api/news`

| endpoint | 說明 | Cache TTL |
|----------|------|-----------|
| `?endpoint=news` | RSS 新聞 | 無 |
| `?endpoint=fgi` | CNN Fear & Greed | 無 |
| `?endpoint=vix` | VIX term structure | 無 |
| `?endpoint=futures` | 全球商品排行榜 | **30 分鐘** |
| `?endpoint=options` | 台指選擇權籌碼 | **60 分鐘** |
| `?endpoint=institutional` | 三大法人現貨 | **60 分鐘** |
| `?endpoint=margin` | 融資融券 | **60 分鐘** |
| `?endpoint=twheatmap` | 舊熱圖（已廢棄，前端改用 Supabase）| **60 分鐘** |
| `?endpoint=ptt` | PTT 股票版 | 無 |
| `?endpoint=ptt_article&url=...` | PTT 文章內文 | 無 |
| `?endpoint=reddit&sub=...` | Reddit RSS（Vercel proxy，時好時壞）| 無 |
| `?endpoint=gemini` | Gemini AI proxy（Key 存 Vercel env）| 無 |
| `?endpoint=groq` | Groq AI proxy（Key 存 Vercel env）| 無 |

---

## 前端常數

```js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api/news' : 'https://alphascope-fin.vercel.app/api/news';
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
```

---

## 台股熱圖（重大改版）

- **155支股票**，27個產業，改從 **Supabase** 讀取（不再打 FinMind）
- **資料來源：** `stock_daily_twse`（收盤/漲跌）+ `stock_valuation_daily`（市值推算）
- **手動載入**：需按「↻ 更新」
- **個股 Modal**：點股票開走勢圖，讀 `stock_daily_twse`
- **產業漲跌幅 bar**：讀 `sector_index_daily` 官方指數
- **市值**：優先用 `stock_valuation_daily` PBR×股本推算，fallback 靜態值

### HM_STOCK_LIST（前端內建，155支）
存在 `index.html` 的 `const HM_STOCK_LIST = [...]`，涵蓋27個產業：
半導體、IC設計、記憶體、電子製造、電子零件、電腦、工業電腦、網通、光學、數位雲端、金融、電信、石化、塑膠、鋼鐵、機電、汽車、航運、生技醫療、建材營造、觀光、油電燃氣、綠能環保、零售、食品、紡織、橡膠

### SECTOR_COLORS（27個產業）
```js
半導體:'#3b82f6', IC設計:'#6366f1', 記憶體:'#8b5cf6',
電子製造:'#f59e0b', 電子零件:'#fbbf24', 光學:'#f97316', 網通:'#fb923c',
工業電腦:'#ef4444', 電腦:'#f87171', 數位雲端:'#60a5fa',
金融:'#10b981', 電信:'#34d399', 石化:'#6b7280', 塑膠:'#78716c',
鋼鐵:'#9ca3af', 機電:'#a8a29e', 汽車:'#84cc16', 航運:'#38bdf8',
零售:'#a3e635', 食品:'#facc15', 紡織:'#fb7185', 橡膠:'#c084fc',
生技醫療:'#4ade80', 建材營造:'#d97706', 觀光:'#e879f9',
油電燃氣:'#94a3b8', 綠能環保:'#86efac'
```

### 產業指數 bar（loadSectorIndexBar）
- 開啟熱圖分頁自動執行，讀 `sector_index_daily` 最新日
- 用 KEYWORD_MAP 模糊比對 TWSE 指數名 → SECTOR_COLORS key
- `chg_pct` 在 `sector_index_daily` 已是百分比（直接用，不需 ×100）
- 排除「報酬指數」、槓桿/反向版本
- ⚠️ 目前 22/69 命中，47 個未命中（KEYWORD_MAP 待補齊）

### 多空訊號（獨立 tab）
- **📡 多空訊號** 已移為獨立 tab（在台股熱圖後面）
- 版面：全寬訊號燈 → 三欄 grid（選擇權 | 三大法人 | 融資融券+回測）
- `loadMktSignals()` 在切換到多空訊號 tab 時才呼叫
- Max Pain = **賣方（法人）獲利最大點**

---

## 主版面結構（重要！）

`<main>` 是兩欄 grid（`1fr 320px`）：
- **左欄 `<div>`**：newsFeed、futuresPanel、sentimentPanel、heatmapPanel、signalPanel、loadMoreBtn
- **右欄 `<aside class="sidebar">`**：美股簡報、台股簡報、FGI、VIX、台指選擇權、最新快訊

⚠️ 所有 panel 必須在左欄 `<div>` 內，否則 sidebar 會跑到下方。

Tab 切換邏輯：每個 show 函式都要隱藏其他所有 panel（含 signalPanel）。

---

## 社群情緒

### Reddit（Vercel proxy，時好時壞）
- 走 `?endpoint=reddit&sub=xxx&sort=xxx`
- 失敗時 retry 一次（等 3 秒）
- **WSB** = r/wallstreetbets、**INV** = r/investing

### PTT
- 透過 Vercel `?endpoint=ptt` proxy
- 貼文有 `link` 欄位（原文網址），存入 `url`

### 貼文卡片
- 有 url → `cursor:pointer`，`onclick` 開新分頁，標題旁顯示 `↗`
- 無 url → 不可點擊

---

## 設計規範

```css
--accent: #6366f1   /* 主色（紫藍）*/
--accent2: #0ea5e9  /* 天藍 */
--accent3: #10b981  /* 綠 */
--bg: #f4f4f8  --surface: #ffffff  --border: #e0e0ea  --border-dark: #c0c0d0
--text: #18181b  --muted: #71717a  --header-bg: #0f0f1a
/* ring shadow */
box-shadow: 0 0 0 1px var(--border-dark);
```

**漲跌色：** 多頭/漲 = `#dc2626`（紅）、空頭/跌 = `#16a34a`（綠）  
**台股慣例：漲=🔴紅、跌=🟢綠**  
**字體：** IBM Plex Mono（Logo/等寬）+ Noto Sans TC（內文）

---

## AI 引擎

**全部使用 Groq：** `llama-3.1-8b-instant`  
**Key 管理：** `GROQ_API_KEY` 存在 Vercel 環境變數，前端不需輸入  
**Vercel proxy：** `?endpoint=groq`（POST，body: `{prompt, maxTokens, temperature}`）  
**歷史遺留函式名：** `callGemini()` 內部呼叫 `callGroq()`、`fetchMarketaux()` = RSS  

### AI 功能分工
| 功能 | 函式 | max_tokens | 備註 |
|------|------|-----------|------|
| 新聞翻譯 | `translateArticles()` → `callGroq()` | 1200 | 只翻熱門以上（score≥80），一次全部 |
| 情緒分析 | `sentAnalyzeGroq()` → `callGroq()` | 900 | batch 10篇，間隔 4.5s |
| 情緒摘要 | `sentGenerateSummary()` → `callGroq()` | 400 | |
| 台股/美股簡報 | `generateBrief()` → `callGroq()` | 800 | 取前6篇新聞 |
| 單篇摘要 | `doSummarize()` → `callGroq()` | 800 | 手動點擊 |

### Groq 限制與對策
- 免費方案：每日 100,000 tokens（TPD）、每分鐘 6,000 tokens（TPM）
- 429 時：等 35~65 秒重試（情緒分析），翻譯只翻熱門篇降低用量
- `?endpoint=groq` Vercel proxy 有 Exponential Backoff（最多 3 次）

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | 手動觸發 |
| AI 翻譯 | ✅ | Groq，只翻熱門以上（score≥80） |
| Fear & Greed | ✅ | CNN + 加密 |
| VIX term structure | ✅ | |
| 全球商品排行榜 | ✅ | |
| K 棒圖 | ✅ | |
| 社群情緒（PTT+Reddit）| ✅ | Reddit 走 Vercel proxy |
| 台指選擇權籌碼 | ✅ | 60min cache |
| 台股熱圖 | ✅ | **155支**，Supabase，手動載入 |
| 產業漲跌幅 bar | ⚠️ | 22/69 命中，KEYWORD_MAP 待補齊 |
| 多空訊號儀表板 | ✅ | **獨立 tab**，三欄全寬版面 |
| 個股走勢圖 Modal | ✅ | 改讀 stock_daily_twse |
| 貼文點擊連結 | ✅ | PTT/Reddit 貼文可點開原文 |
| Supabase 歷史資料庫 | ✅ | 8張表，預估4~5年到達500MB上限 |
| 官方產業指數收集 | ✅ | TWSE → sector_index_daily |
| 全上市股票收盤 | ✅ | TWSE → stock_daily_twse |
| 個股估值收集 | ✅ | TWSE → stock_valuation_daily |
| **stock_valuation_daily 欄位確認** | 🔜 | `per`、`listed_shares` 欄位名待確認（查詢 400）|
| **Modal 加估值資料** | 🔜 | PER/殖利率/PBR（待欄位確認）|
| **月營收收集** | 🔜 | TWSE t187ap05_L |
| 台股 VIX | ❌ | 無免費來源 |

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `callGroq`/`fetchMarketaux`/`showFutures`/`showHeatmap` |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Groq 429 | 等明天 UTC 00:00（台灣 08:00）重置；或降低請求量 |
| Vercel 30s timeout | AI proxy 每次只處理單一請求，不做批次等待 |
| options 無資料 | 往前找 7 個交易日 |
| 熱圖條紋 | squarify 需正方形版面 |
| Supabase 400 | 改用 `in.(...)` 語法；欄位名不存在；URL 過長要分批 |
| Modal 走勢圖色塊 | bar 用固定 px 寬度（非 flex:1），高度用 hPx 非 hPct |
| Modal 無法彈出 | 確認 #stockModal CSS 有 display:flex (.open) |
| Supabase 無法寫入 | 確認用 service_role key |
| TWSE 從 Vercel 403 | 只能從 GitHub Actions 或瀏覽器呼叫 |
| Reddit 失敗 | Vercel proxy 時好時壞，retry 一次；完全失敗顯示「無資料」 |
| sidebar 跑到下方 | 確認所有 panel 在左欄 `<div>` 內，`</div>` 在 loadMoreBtn 後才關閉 |
| 產業指數 chgPct 顯示 300%+ | sector_index_daily 的 chg_pct 已是百分比，不需 ×100 |
| Gemini quota 耗盡 | 已改回全用 Groq，Gemini proxy 保留但不使用 |

---

## 開發慣例

1. 開新對話上傳 `index.html` 和 `news.js`，Claude 複製到 `/home/claude/`
2. 修改後輸出到 `/mnt/user-data/outputs/`
3. 上傳 GitHub → Vercel 自動部署
4. JS 語法驗證：`node --check news.js`（HTML 用 `new Function()` 驗證 script 區塊）
5. 所有 Vercel API 用 `API_BASE`
6. Shadow：`box-shadow: 0 0 0 1px` ring shadow
7. Supabase 讀取用 anon key，寫入用 service_role key
8. 新增功能同步更新 CLAUDE.md
9. HTML div 平衡驗證：`python3 -c "import re; ..."`（開頭/結尾 div 數量需相等）

---

## 設計參考

- **awesome-design-md**：ring shadow、warm dark palette
- **graphify**：filter by community → 產業篩選
- **nstock.tw/market_index/heatmap**：熱圖 UI
- **tradingview.com/heatmap**：分組 treemap
