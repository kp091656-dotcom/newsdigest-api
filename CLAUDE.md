# NewsDigest.AI — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-04-13
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 專案概覽

**名稱：** NewsDigest.AI — AI 驅動財經新聞網站  
**網址：** https://newsdigest-api.vercel.app  
**GitHub：** github.com/kp091656-dotcom/newsdigest-api  
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫  
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

| 檔案 | Claude 工作路徑 | 部署位置 |
|------|----------------|---------|
| 前端主檔 | `/home/claude/index.html` | `newsdigest-vercel/index.html` |
| Vercel API | `/home/claude/news.js` | `newsdigest-vercel/api/news.js` |
| K 棒圖 | — | `newsdigest-vercel/chart.html` |
| 每日收集腳本 | — | `.github/scripts/collect_market_data.js` |
| Actions workflow | — | `.github/workflows/collect.yml` |

> 每次對話開始，請先上傳 index.html 和 news.js，Claude 會複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**用途：** 每日盤後自動收集市場資料，供歷史走勢圖、籌碼分析、回測使用  
**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取用）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表

| 表名 | 內容 | 更新頻率 |
|------|------|---------|
| `stock_daily` | 86支個股收盤、漲跌幅、市值 | 每日盤後 |
| `institutional_daily` | 三大法人現貨買賣超（外資/投信/自營商）| 每日 15:00 |
| `margin_daily` | 融資餘額、融券餘額及變化 | 每日 21:00 |
| `options_daily` | P/C Ratio、Max Pain、法人選擇權部位 | 每日盤後 |
| `futures_daily` | 全球商品/指數價格（35支）| 每日盤後 |

### Supabase 查詢方式（前端）

```js
const SUPABASE_URL = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';

// 例：查最近30天台積電收盤
const r = await fetch(
  `${SUPABASE_URL}/rest/v1/stock_daily?stock_id=eq.2330&order=date.desc&limit=30`,
  { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
);
const data = await r.json();
```

### GitHub Actions 自動收集

**排程：** 每天台灣時間 20:30（UTC 12:30），週一至週五  
**手動觸發：** repo → Actions → Daily Market Data Collector → Run workflow  
**GitHub Secrets：**
- `SUPABASE_URL` = `https://fdxedcwtmlurumfjmlys.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role key（Supabase Settings → API）
- `VERCEL_API_BASE` = `https://newsdigest-api.vercel.app/api/news`

---

## Vercel API 端點

**Base URL：** `https://newsdigest-api.vercel.app/api/news`

| endpoint | 說明 | 來源 | Cache TTL |
|----------|------|------|-----------|
| `?endpoint=news` | RSS 新聞（預設）| Reuters/CNBC/Bloomberg/MarketWatch/FT | 無 |
| `?endpoint=fgi` | CNN Fear & Greed Index | production.dataviz.cnn.io | 無 |
| `?endpoint=vix` | VIX 波動率 term structure | Yahoo Finance（server-side）| 無 |
| `?endpoint=futures` | 全球商品排行榜 | stooq + FinMind 混合 | **30 分鐘** |
| `?endpoint=options` | 台指選擇權籌碼 | FinMind | **60 分鐘** |
| `?endpoint=institutional` | 三大法人現貨買賣超 | FinMind | **60 分鐘** |
| `?endpoint=margin` | 融資融券餘額 | FinMind | **60 分鐘** |
| `?endpoint=twheatmap` | 台股86支熱圖資料 | FinMind TaiwanStockPrice | **60 分鐘** |
| `?endpoint=twheatmap&refresh=1` | 強制跳過 cache | FinMind | — |
| `?endpoint=ptt` | PTT 股票版文章列表 | PTT HTML | 無 |
| `?endpoint=ptt_article&url=...` | PTT 單篇文章內文 | PTT HTML | 無 |
| `?endpoint=reddit&sub=...` | Reddit RSS | Reddit RSS | 無 |
| `?endpoint=twvix` | 台股 VIX（未完成）| TAIFEX | — |
| `?endpoint=commodities` | ❌ 已棄用 | — | — |

### Server-side Cache（global 變數）
- `global._futuresCache`：futures，30 分鐘
- `global._optionsCache`：options，60 分鐘
- `global._instCache`：institutional，60 分鐘
- `global._marginCache`：margin，60 分鐘
- `global._hmCache`：twheatmap，60 分鐘（`refresh=1` 可強制跳過）

### 重要修正記錄
- `options` endpoint：連假 bug 已修，搜尋範圍從 3 天擴大到 **7 天**（`i <= 7`）
- `commodities` endpoint：**已棄用**，前端不再呼叫，只用 `futures`
- `twheatmap`：股票數從 50 擴充到 **86 支**，改為全部並行抓取

---

## 前端全域常數

```js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api/news'
  : 'https://newsdigest-api.vercel.app/api/news';
```

**重要：** 所有 API 呼叫必須使用 `API_BASE`，不可硬編碼 URL。

---

## 全球商品排行榜（endpoint=futures）架構

### FinMind usSymbols（USStockPrice，欄位大寫：Open/High/Low/Close）
| symbol | 名稱 | cat |
|--------|------|-----|
| `^GSPC` | S&P500 | 美股指數 |
| `^IXIC` | 那斯達克 | 美股指數 |
| `^DJI` | 道瓊 | 美股指數 |
| `^VIX` | VIX波動率 | **波動率** |
| `^SOX` | 費城半導體 | 美股指數 |
| `GLD` | 黃金(GLD) | 金屬 |
| `SLV` | 白銀(SLV) | 金屬 |
| `USO` | WTI原油 | 能源 |
| `BNO` | 布倫特原油 | 能源 |
| `IBIT` | 比特幣ETF | 加密貨幣 |
| `FETH` | 以太幣ETF | 加密貨幣 |

### 排行榜類別顯示順序（含波動率）
`['波動率','美股指數','亞股指數','能源','金屬','農產品','外匯','債券','加密貨幣']`

---

## 台股熱圖（endpoint=twheatmap + 前端 treemap）

### API 端點
- `?endpoint=twheatmap&refresh=1`：強制重抓（手動按更新時用）
- 回傳 `{id, name, sector, mcap, price, prev, chgPct, date}`
- **86 支股票**，19 個產業，全部並行抓取（~2-4 秒）
- **手動載入**：點分頁不自動打 API，需按「↻ 更新」

### 前端渲染（SVG Squarified Treemap）
**算法：** 正確的 squarified treemap（Bruls et al. 2000），使用局部 totalVal 遞迴  
**版面：** 正方形（1:1），`SVG_W × SVG_W`  
**Scale：** `Math.pow(mcap, 0.38)` 壓縮台積電優勢（台積電約佔 12% 面積）  
**兩層結構：**
1. 第一層：產業區塊 squarify（依產業總市值排序）
2. 第二層：個股 squarify（在各產業區塊內部）

**產業漲跌幅 bar：** `renderSectorBar(data, activeSector)` — 市值加權平均，點擊聯動篩選  
**產業篩選：** `hmFilterSector(sector, btn)` — graphify inspired filter by community  
**Tooltip：** DESIGN.md warm dark palette（`#141413` bg, `#b0aea5` secondary）  
**點擊：** 開啟 TradingView `TWSE:{id}`

### 產業色票（SECTOR_COLORS）
```js
半導體: '#3b82f6', IC設計: '#6366f1', 記憶體: '#8b5cf6',  // DRAM 已合併進記憶體
電子製造: '#f59e0b', 電子零件: '#fbbf24', 光學: '#f97316', 網通: '#fb923c',
工業電腦: '#ef4444', 電腦: '#f87171', 金融: '#10b981', 電信: '#34d399',
石化: '#6b7280', 鋼鐵: '#9ca3af', 汽車: '#84cc16', 零售: '#a3e635',
食品: '#facc15', 紡織: '#fb7185', 橡膠: '#c084fc'
```

### 右側多空訊號儀表板（mktSignalPanel）
- 開啟熱圖分頁時自動呼叫 `loadMktSignals()`
- 同時抓取 options + institutional + margin
- 計算綜合多空得分（-6 ~ +6），顯示訊號燈
- 包含：P/C Ratio (OI+Vol)、Max Pain、法人選擇權部位、三大法人現貨、融資融券、近10日走勢

---

## 前端設計規範（DESIGN.md token 對齊）

**字體：** Playfair Display + IBM Plex Mono + Noto Sans TC  
**設計系統來源：** awesome-design-md / Claude DESIGN.md

```css
/* 色彩 */
--accent: #c8521a   /* 橘紅（漲/多頭）*/
--accent2: #1a6bc8  /* 藍 */
--accent3: #2a9d5c  /* 綠（跌/空頭）*/
--bg: #f7f6f2  --surface: #ffffff  --border: #e4e2d9  --border-dark: #c8c5b8
--text: #1a1a18  --muted: #7a7870

/* Shadow 系統（DESIGN.md ring shadow）*/
box-shadow: 0 0 0 1px var(--border-dark)          /* ring shadow 取代 border */
box-shadow: 0 0 0 1px rgba(0,0,0,0.2), 0 4px 24px rgba(0,0,0,0.10)  /* ring + whisper */

/* 圓角規範 */
4px: 最小元素  8px: 標準按鈕/卡片  12px: 主要容器  20px: pill 形按鈕
```

**台股慣例顏色（與一般相反）：**
- 漲/多頭 → 🔴 紅色（`var(--accent)` = `#c8521a`）
- 跌/空頭 → 🟢 綠色（`var(--accent3)` = `#2a9d5c`）

---

## 環境變數（Vercel）

| 變數 | 用途 |
|------|------|
| `FINMIND_TOKEN` | FinMind API（600 req/hr）|
| `THENEWSAPI_TOKEN` | 已棄用 |
| `TWELVE_DATA_KEY` | 已棄用 |

---

## AI 引擎

**Groq：** `llama-3.3-70b-versatile`  
**函式名稱（歷史遺留，勿改）：** `callGemini()` = Groq、`fetchMarketaux()` = RSS

### 翻譯機制（Groq 兩波策略）
- 只翻英文文章（跳過含中文字元的 PTT 文章）
- 第一波：前 25 篇，每 8 篇一批，批次間隔 500ms
- 等待 62 秒（TPM 重置，Groq 免費版 12,000 TPM/分鐘）
- 第二波：後 25 篇
- 遇 429 rate limit：等待 20 秒後重試（最多 2 次）
- `max_tokens: 1024`

### generateBrief() 注意
- 無 Groq Key 或無新聞時直接用 fallback，不呼叫 API

---

## Sticky Header 架構

三層 sticky，從上到下：
1. `header`：`top: 0; z-index: 100`
2. `.api-config-bar`：`top: 64px; z-index: 90`（含 GROQ KEY 列）
3. `.category-bar`：`top` 由 JS `updateStickyOffsets()` 動態計算

`updateStickyOffsets()` 在頁面載入和 resize 時執行。

---

## 社群情緒儀表板（sentimentPanel）

### 資料來源
| 來源 | API | 資料內容 |
|------|-----|---------|
| PTT 股票版 | `API_BASE?endpoint=ptt` | 標題、時間排名(#1=最新)、推文淨值 |
| PTT 文章內文 | `API_BASE?endpoint=ptt_article` | 內文前300字、推/噓/→詳細統計 |
| Reddit WSB | `API_BASE?endpoint=reddit&sub=wallstreetbets` | 標題、熱度排名(#1=最熱)、body摘要 |
| r/investing | `API_BASE?endpoint=reddit&sub=investing` | 同上 |

---

## 台指選擇權籌碼（optSection + mktSignalPanel）

### P/C Ratio 解讀
| 數值（未平倉口數）| 訊號 |
|---|---|
| < 0.7 | 偏多頭（紅色）|
| 0.7–1.0 | 略偏多（藍色）|
| 1.0–1.3 | 中性（灰色）|
| 1.3–1.7 | 略偏空（橘色）|
| > 1.7 | 偏空頭（綠色）|

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | 手動點「載入財經新聞」觸發 |
| AI 翻譯（Groq 兩波）| ✅ | 50篇分兩分鐘完成 |
| 今日市場摘要 | ✅ | |
| 美股/台股簡報 | ✅ | 無新聞/無 Key 自動用 fallback |
| Fear & Greed (CNN + 加密) | ✅ | |
| VIX term structure + Contango/Backwardation | ✅ | |
| 全球商品排行榜 | ✅ | 波動率類別已加，30分鐘 cache |
| K 棒圖（台股+美股+指標）| ✅ | |
| 社群情緒儀表板 | ✅ | PTT + Reddit WSB + r/investing |
| 社群情緒 PTT 內文分析 | ✅ | 逐篇爬蟲，約20-30秒 |
| 台指選擇權籌碼 | ✅ | 搜尋最近7天（連假修正），60分鐘 cache |
| 台股市場熱圖 | ✅ | 86支，squarify treemap，手動載入 |
| 產業漲跌幅 bar | ✅ | 市值加權，點擊聯動篩選 |
| 多空訊號儀表板 | ✅ | options+institutional+margin 綜合得分 |
| **Supabase 歷史資料庫** | ✅ **新增** | GitHub Actions 每日 20:30 自動收集 |
| 歷史走勢圖 | 🔜 待開發 | 讀 Supabase stock_daily |
| 法人籌碼趨勢圖 | 🔜 待開發 | 讀 Supabase institutional_daily |
| 多空訊號回測 | 🔜 待開發 | 讀 Supabase options_daily |
| 自動刷新新聞 | ❌ 已移除 | 避免 Groq TPM 超限 |
| 台股 VIX | ❌ | 無免費來源 |

---

## 已知限制

1. **Groq TPM 12,000/分鐘** — 翻譯改用兩波策略，間隔 62 秒
2. **stooq `.F`** — 需登入，用 ETF 替代
3. **Yahoo Finance** — 完全 CORS 封鎖
4. **台股 VIX** — 無免費 API
5. **FinMind GoldPrice** — 台幣計價，用 GLD ETF 替代
6. **Reddit score** — RSS 無此欄位，改用 hot feed 排名(rank)代替
7. **PTT 內文爬蟲** — Vercel 10s 上限，採逐篇呼叫方式（每篇獨立 endpoint）
8. **台指選擇權資料** — 盤後才更新，盤中看到的是昨日資料；連假最多往前找 7 天
9. **台股熱圖** — FinMind 盤後資料（約17:00後），不是即時；squarify 需正方形版面
10. **Vercel Serverless Cache** — global 變數 cache 不跨 instance 共享（低流量專案無影響）
11. **Supabase 免費版** — 500MB 儲存、超過 1 週無使用會暫停（需每週登入一次或升級）

---

## 常見問題

| 問題 | 解法 |
|------|------|
| 函式 undefined | 檢查 `saveGroqKey`/`fetchMarketaux`/`showFutures`/`showHeatmap` 是否存在 |
| stooq 空白 | `.F` 不支援；`^` 需編碼為 `%5E` |
| FinMind 空 | 檢查 dataset 大小寫；USStockPrice 欄位是大寫 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| Contango 不更新 | 確認 vix3m?.price 和 price 都有值 |
| Groq 429 | TPM 超限，翻譯已有 retry 機制；社群分析等 20 秒重試 |
| PTT 推文數全是 0 | 用 split('<div class="r-ent">') 解析，勿用 regex |
| Reddit 500 | RSS 版本不需授權，JSON API 被 Vercel IP 封鎖 |
| options 無資料 | 自動往前找 7 個交易日（含連假）；FinMind TaiwanOptionDaily 盤後才更新 |
| 熱圖條紋 | squarify 必須用正方形版面（SVG_H = SVG_W），且算法要用局部 totalVal |
| 熱圖台積電太大 | scaleMcap = v => Math.pow(v, 0.38)，台積電約佔 12% |
| API URL 錯誤 | 使用 API_BASE 常數，不可硬編碼 newsdigest-api.vercel.app |
| Supabase 無法寫入 | 確認用 service_role key，不是 anon key |
| GitHub Actions 失敗 | 檢查三個 Secrets 是否都設定；查 Actions log |
| 產業漲跌幅太小 | chgPct 是小數需 ×100；maxAbs 預設最小 0.5% |

---

## 開發慣例

1. 開新對話時上傳 `index.html` 和 `news.js`，Claude 複製到 `/home/claude/`
2. 修改完成後輸出到 `/mnt/user-data/outputs/`
3. 上傳 GitHub → Vercel 自動部署
4. 測試 API：瀏覽器直接開 endpoint URL
5. JS 語法驗證：`node --check news.js`
6. 所有 API 呼叫用 `API_BASE`，不硬編碼 URL
7. Shadow 系統：用 `box-shadow: 0 0 0 1px` ring shadow，不用 `border`
8. 新增功能時同步更新 CLAUDE.md 的功能狀態表
9. Supabase 讀取用 anon key，寫入用 service_role key（只放 GitHub Secrets）

---

## 設計參考

- **awesome-design-md** (github.com/VoltAgent/awesome-design-md)：Claude DESIGN.md token 對齊，ring shadow、warm dark palette、generously rounded
- **graphify** (github.com/safishamsi/graphify)：filter by community 概念 → 台股熱圖產業篩選
- **nstock.tw/market_index/heatmap**：台股熱圖 UI 參考
- **tradingview.com/heatmap**：分組 treemap 排版參考
