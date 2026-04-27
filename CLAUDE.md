# AlphaScope — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-04-27
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
| Actions（每日收集）| `/home/claude/collect.yml` | `.github/workflows/collect.yml` |
| Actions（TWSE測試）| — | `.github/workflows/test_twse.yml` |

> 每次對話開始，請先上傳 index.html、news.js、CLAUDE.md，Claude 複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 8 張）

| 表名 | 來源 | 內容 | 每日筆數 |
|------|------|------|---------|
| `stock_daily` | FinMind | 86支個股收盤、漲跌幅（舊熱圖用，逐步淘汰） | ~86 |
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量 | ~1230 |
| `institutional_daily` | FinMind | 三大法人現貨買賣超 | 1 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 |
| `options_daily` | FinMind | P/C Ratio、Max Pain、法人選擇權 | 1 |
| `futures_daily` | stooq+FinMind | 全球商品/指數 | ~35 |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1071 |

### stock_daily_twse 實際欄位（已確認）
```
id, date, stock_id, name, close, prev, chg_pct, volume, source, created_at
```
- `chg_pct`：小數（0.0122 = +1.22%），前端顯示時 ×100
- `prev`：前日收盤價
- `volume`：成交量

### stock_valuation_daily 欄位（已確認）
- `pb_ratio`：PBR（collect 腳本寫入用此名）
- `pe_ratio`：PER
- `dividend_yield`：殖利率
- `listed_shares`：❌ 不存在，前端不要查此欄位
- 熱圖市值：優先用 `pb_ratio` 推算，fallback 靜態 `mcap`
- 前端查詢用 `select=*` 避免 400（不要手動指定欄位名）

### Supabase 查詢語法注意
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(stock_id.eq.2330,...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400
- `stock_valuation_daily` 查詢一定用 `select=*`

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

**排程：** 兩段（COLLECT_MODE 區分），週一至週五  
**Node.js：** 24

| 排程 | 台灣時間 | UTC | COLLECT_MODE | 收集內容 |
|------|---------|-----|-------------|---------|
| `0 8 * * 1-5` | 16:00 | 08:00 | `twse` | TWSE 個股、產業指數、估值 |
| `0 9 * * 1-5` | 17:00 | 09:00 | `finmind` | FinMind 法人、融資券、選擇權、全球商品 |
| 手動觸發 | — | — | `all` | 全部 |

**注意：** GitHub Actions 免費帳號有約 1~1.5 小時延遲，排程時間要保守估計。

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
**TWSE 資料更新時間：** 收盤（13:30）後約 2~2.5 小時，約 15:30~16:00 有當日資料。

---

## FinMind API

**Base URL：** `https://api.finmindtrade.com/api/v4/data`  
**認證方式：** `Authorization: Bearer ${TOKEN}`（HTTP header）  
**⚠️ 注意：** 2025-05-25 起 token 從 URL `&token=xxx` 改為 header，舊寫法會 404

```js
// 正確寫法
fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })

// 錯誤寫法（會 404）
fetch(`${url}&token=${TOKEN}`)
```

**Token 管理：** `FINMIND_TOKEN` 存在 Vercel 環境變數，GitHub Secrets 也有一份  
**GitHub Actions 可用，Vercel serverless 也可用**

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
| `?endpoint=gemini` | Gemini AI proxy（Key 存 Vercel env，保留但不使用）| 無 |
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

## 台股熱圖

- **155支股票**，27個產業，從 **Supabase** 讀取
- **資料來源：** `stock_daily_twse`（收盤/漲跌）+ `stock_valuation_daily`（市值推算）
- **頁面載入自動顯示**（不需手動點 tab）：init 呼叫 `showHeatmap()` + `loadHeatmap()`
- **個股 Modal**：點股票開走勢圖，讀 `stock_daily_twse`
- **產業漲跌幅 bar**：讀 `sector_index_daily` 官方指數，`loadHeatmap()` finally 觸發
- **市值**：優先用 `stock_valuation_daily` `pb_ratio` 推算，fallback 靜態值

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
- 熱圖載入後由 `loadHeatmap()` 的 `finally` 呼叫，不需手動觸發
- 用 KEYWORD_MAP + SECTOR_INDEX_MAP 比對 TWSE 指數名 → SECTOR_COLORS key
- `chg_pct` 在 `sector_index_daily` 已是百分比（直接用，不需 ×100）
- 排除「報酬指數」、槓桿/反向版本
- ⚠️ 目前命中率約 50%，KEYWORD_MAP 可繼續補齊（console.debug 顯示未命中清單）

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
/* 主要 Token */
--bg: #f0f0f5  --surface: #ffffff  --border: #e2e2ec  --border-dark: #c4c4d4
--accent: #6366f1  --accent2: #0ea5e9  --accent3: #10b981
--text: #16161a  --muted: #6e6e7e  --header-bg: #0c0c18
--up: #dc2626  --down: #16a34a   /* 漲=紅 跌=綠（台股慣例）*/

/* Type Scale */
--text-2xs: 0.58rem  --text-xs: 0.65rem  --text-sm: 0.72rem
--text-md: 0.82rem   --text-lg: 1rem     --text-xl: 1.25rem
--text-2xl: 1.5rem   --text-3xl: 2rem

/* Radius */
--r-sm: 6px  --r-md: 10px  --r-lg: 14px  --r-xl: 18px

/* Shadow */
--shadow-sm / --shadow-md / --shadow-lg
--ring: 0 0 0 1px var(--border-dark)
```

**漲跌色：** 漲 = `var(--up)` = `#dc2626`（紅）、跌 = `var(--down)` = `#16a34a`（綠）  
**⚠️ 禁止用 `var(--accent)` 表示漲幅**（`--accent` 是 UI 主色，不是漲跌色）  
**字體：** IBM Plex Mono（Logo/等寬）+ Noto Sans TC（內文）+ Playfair Display（標題）

### CSS Utility Classes
常用 class 避免 inline style：
- `.panel-title` — Playfair 大標題
- `.panel-header` — flex row 標題列
- `.icon-btn` — ↻ 更新類按鈕
- `.ts-label` — 時間戳小字
- `.info-badge` — 說明標籤
- `.fut-sort-btn` — 排行榜排序按鈕
- `.badge-critical` / `.badge-hot` — ⚡重大 / 🔥熱門 badge
- `.fgi-scale-row.{extreme-fear|fear|neutral|greed|extreme-greed}` — FGI 量表
- `.opt-maxpain` / `.opt-oi-grid` / `.opt-oi-cell` — 選擇權 widget
- `#mktSignalSummary` / `#mktSignalDot` / `#mktSignalScore` — 多空訊號燈（CSS ID）

---

## AI 引擎

**全部使用 Groq：** `llama-3.1-8b-instant`  
**Key 管理：** `GROQ_API_KEY` 存在 Vercel 環境變數，前端不需輸入  
**Vercel proxy：** `?endpoint=groq`（POST，body: `{prompt, maxTokens, temperature}`）  
**歷史遺留函式名：** `callGemini()` 內部呼叫 `callGroq()`、`fetchMarketaux()` = RSS

### Groq 請求佇列
所有 `callGroq()` 呼叫通過佇列依序執行，防止 TPM 超限：
```js
const GROQ_MIN_GAP_MS = 8000; // 每個請求間隔 8 秒
```

### AI 功能分工
| 功能 | 函式 | max_tokens | 備註 |
|------|------|-----------|------|
| 新聞翻譯 | `translateArticles()` → `callGroq()` | 1200 | 只翻熱門以上（score≥80） |
| 情緒分析 | `sentAnalyzeGroq()` → `callGroq()` | 900 | batch 10篇，間隔 4.5s |
| 情緒摘要 | `sentGenerateSummary()` → `callGroq()` | 400 | |
| 台股/美股簡報 | `generateBrief()` → `callGroq()` | 800 | 取前6篇新聞，頁面載入自動觸發 |
| 單篇摘要 | `doSummarize()` → `callGroq()` | 800 | 手動點擊 |

### Groq 限制與對策
- 免費方案：每日 100,000 tokens（TPD）、每分鐘 6,000 tokens（TPM）
- 429 時：等 35~65 秒重試（情緒分析），翻譯只翻熱門篇降低用量

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | 手動觸發 |
| AI 翻譯 | ✅ | Groq，只翻熱門以上（score≥80） |
| Fear & Greed | ✅ | CNN + 加密 |
| VIX term structure | ✅ | |
| 全球商品排行榜 | ✅ | stooq + FinMind |
| K 棒圖 | ✅ | |
| 社群情緒（PTT+Reddit）| ✅ | Reddit 走 Vercel proxy |
| 台指選擇權籌碼 | ✅ | 60min cache |
| 台股熱圖 | ✅ | 155支，Supabase，**頁面載入自動顯示** |
| 產業漲跌幅 bar | ⚠️ | 命中率約50%，KEYWORD_MAP 可繼續補齊 |
| 多空訊號儀表板 | ✅ | 獨立 tab，三欄全寬版面 |
| 個股走勢圖 Modal | ✅ | 讀 stock_daily_twse |
| 貼文點擊連結 | ✅ | PTT/Reddit 貼文可點開原文 |
| Supabase 歷史資料庫 | ✅ | 8張表，預估4~5年到達500MB上限 |
| FinMind Bearer Token | ✅ | 2025-05-25 改版，已修正 |
| 每日收集雙排程 | ✅ | TWSE 16:00 / FinMind 17:00 |
| **Modal 加估值資料** | 🔜 | PER/殖利率/PBR |
| **月營收收集** | 🔜 | TWSE t187ap05_L |
| 台股 VIX | ❌ | 無免費來源 |

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `callGroq`/`fetchMarketaux`/`showFutures`/`showHeatmap` |
| FinMind 404 | 確認用 `Authorization: Bearer` header，不是 `&token=` URL 參數 |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Groq 429 | 等明天 UTC 00:00（台灣 08:00）重置；或降低請求量 |
| Vercel 30s timeout | AI proxy 每次只處理單一請求，不做批次等待 |
| options 無資料 | 往前找 7 個交易日 |
| 熱圖條紋 | squarify 需正方形版面 |
| Supabase 400 | 改用 `in.(...)` 語法；欄位名不存在用 `select=*`；URL 過長要分批 |
| Modal 走勢圖色塊 | bar 用固定 px 寬度（非 flex:1），高度用 hPx 非 hPct |
| Modal 無法彈出 | 確認 #stockModal CSS 有 display:flex (.open) |
| Supabase 無法寫入 | 確認用 service_role key |
| TWSE 從 Vercel 403 | 只能從 GitHub Actions 或瀏覽器呼叫 |
| Reddit 失敗 | Vercel proxy 時好時壞，retry 一次；完全失敗顯示「無資料」 |
| sidebar 跑到下方 | 確認所有 panel 在左欄 `<div>` 內，`</div>` 在 loadMoreBtn 後才關閉 |
| 產業指數 chgPct 顯示 300%+ | sector_index_daily 的 chg_pct 已是百分比，不需 ×100 |
| Groq TPM 超限 | 佇列已限制 8s 間隔；載入時只觸發 translateArticles → generateBrief（循序） |
| Actions 資料太舊 | GitHub 免費帳號有 1~1.5 小時延遲，排程要保守；TWSE 排程設 UTC 08:00 |
| badge 字串顯示在頁面上 | index.html 開頭有垃圾前綴，確認從 `<!DOCTYPE html>` 開始 |

---

## 開發慣例

1. 開新對話上傳 `index.html`、`news.js`、`CLAUDE.md`，Claude 複製到 `/home/claude/`
2. 修改後輸出到 `/mnt/user-data/outputs/`
3. 上傳 GitHub → Vercel 自動部署
4. JS 語法驗證：`node --check news.js`（HTML 用 `new Function()` 驗證 script 區塊）
5. 所有 Vercel API 用 `API_BASE`
6. Shadow：`box-shadow: 0 0 0 1px` ring shadow → 用 `var(--ring)`
7. Supabase 讀取用 anon key，寫入用 service_role key
8. 新增功能同步更新 CLAUDE.md
9. HTML div 平衡驗證：`python3 -c "import re; ..."` （開頭/結尾 div 數量需相等）
10. 漲跌色一律用 `var(--up)` / `var(--down)`，禁止用 `var(--accent)`
11. 大量 inline style 改用 CSS class，禁止 `onmouseover`/`onmouseout`（改用 CSS :hover）
12. 修改 CSS 時注意不要截斷檔案（renderSectorBar 踩過的坑）

---

## 設計參考

- **awesome-design-md**：ring shadow、warm dark palette
- **graphify**：filter by community → 產業篩選
- **nstock.tw/market_index/heatmap**：熱圖 UI
- **tradingview.com/heatmap**：分組 treemap
