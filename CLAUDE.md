# AlphaScope — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-05-11
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
| K 線圖 | `/home/claude/chart.html` | `chart.html` |
| 每日收集腳本 | `/home/claude/collect_market_data.js` | `.github/scripts/collect_market_data.js` |
| Actions 排程 | `/home/claude/collect.yml` | `.github/workflows/collect.yml` |
| PWA SW | `/home/claude/service-worker.js` | `service-worker.js` |
| PWA Manifest | `/home/claude/pwa/manifest.json` | `manifest.json` |
| PWA Deploy | `/home/claude/deploy.yml` | `.github/workflows/deploy.yml` |

> 每次對話開始，請先上傳 index.html、news.js、CLAUDE.md（以及需要修改的 chart.html 或 collect_market_data.js），Claude 複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 8 張）

| 表名 | 來源 | 內容 | 每日筆數 |
|------|------|------|---------|
| `stock_daily` | FinMind | 86支個股收盤（舊熱圖用，逐步淘汰） | ~86 |
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量 | ~1230 |
| `institutional_daily` | FinMind | 三大法人現貨買賣超 | 1 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 |
| `options_daily` | FinMind | P/C Ratio、法人選擇權 | 1 |
| `futures_daily` | stooq+FinMind | 全球商品/指數（前端走 Vercel proxy，此表備份用）| ~35 |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1071 |

### 各表實際欄位（已逐一確認，嚴格遵守）

```
stock_daily_twse     : date, stock_id, name, close, prev, chg_pct, volume, source, created_at
stock_valuation_daily: date, stock_id, name, pe_ratio, pb_ratio, dividend_yield
institutional_daily  : date, foreign_net, trust_net, dealer_net, total_net
margin_daily         : date, margin_balance, margin_chg, short_balance, short_chg
options_daily        : date, pc_ratio_vol, pc_ratio_oi, foreign_opt_net
sector_index_daily   : date, index_name, close, change, chg_pct
```

⚠️ **重要：**
- `stock_daily_twse.chg_pct` 是小數（0.0122 = +1.22%），前端顯示時 ×100
- `sector_index_daily.chg_pct` 已是百分比（1.54 = +1.54%），直接用，不需 ×100
- `margin_daily` FinMind name 值為英文：`MarginPurchase`（融資）、`ShortSale`（融券）
- `options_daily` 前端讀取欄位：`date, pc_ratio_oi, foreign_opt_net`
- `stock_valuation_daily` 查詢一定用 `select=*` 避免 400
- `stock_valuation_daily.name` 已加入（2026-05-06 起 collect 腳本寫入）
- `stock_valuation_daily.pe_ratio > 200` 視為失真（微利股），腳本層與前端層雙重過濾
- `listed_shares` ❌ 不存在，前端不要查此欄位
- `futures_daily` 前端走 Vercel proxy，不讀 Supabase；Supabase 欄位尚未完整確認，collect 腳本暫不寫入

### Supabase 查詢注意
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400
- Upsert 必須指定 `on_conflict` 欄位，且欄位必須存在於資料表
- 寫入前先對照本文件確認欄位名稱，多餘欄位會 400（PGRST204）

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

---

## GitHub Actions 每日收集

**Node.js：** 24  
**⚠️ TWSE OpenAPI 更新時間：** 約 05:30（台灣時間），收集排程設為 06:00 確保資料就緒

| cron | UTC | 台灣時間 | job 名稱 | 收集內容 |
|------|-----|---------|---------|---------|
| `0 22 * * 0-4` | 週日~週四 22:00 | **週一~週五 06:00** | `collect-twse` | TWSE 個股、產業指數、估值 |
| `30 22 * * 0-4` | 週日~週四 22:30 | **週一~週五 06:30** | `collect-finmind` | FinMind 法人、融資券、選擇權、全球商品 |
| 手動觸發 | — | — | 兩個 job 各自判斷 | 依 inputs.mode |

**⚠️ 重要修正（2026-05-06）：** 舊版用 `date -u +%M` 判斷分鐘數決定 mode，GitHub Actions 不保證準時，導致 TWSE 永遠跑不到。現已改為**兩個獨立 job**，各自用 `github.event.schedule` 判斷是哪個 cron 觸發，完全不依賴執行時分鐘數。

**GitHub Secrets 必要項目：** `FINMIND_TOKEN`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`

### lastTradingDay() 邏輯
TWSE STOCK_DAY_ALL 不含日期欄位，必須自行推算：
- 台灣時間 16:00 前執行 → 當日資料未發布，用前一日
- 週末 → 往前找週五
- 06:00 執行（hour=6 < 16）→ 退一天 → 正確拿到前一交易日 ✅

---

## TWSE OpenAPI（GitHub Actions 可用，Vercel IP 403 封鎖）

**Base URL：** `https://openapi.twse.com.tw/v1`

| endpoint | 內容 | 欄位（已確認）|
|----------|------|-------------|
| `/exchangeReport/STOCK_DAY_ALL` | 全上市個股每日成交 | Code, Name, ClosingPrice, Change, TradeVolume |
| `/exchangeReport/MI_INDEX` | 各類官方指數 | 日期, 指數, 收盤指數, 漲跌, 漲跌點數, 漲跌百分比 |
| `/exchangeReport/BWIBBU_ALL` | 個股本益比/殖利率/PBR | Code, Name, PEratio, PBratio, DividendYield |

**三大法人整體買賣超：** TWSE 無提供，繼續用 FinMind。

---

## FinMind API

**Base URL：** `https://api.finmindtrade.com/api/v4/data`  
**認證方式：** `Authorization: Bearer ${TOKEN}`（HTTP header）  
**⚠️ 注意：** 2025-05-25 起 token 從 URL `&token=xxx` 改為 header，舊寫法會 404

```js
fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })  // ✅ 正確
fetch(`${url}&token=${TOKEN}`)                                  // ❌ 會 404
```

**Token 管理：** `FINMIND_TOKEN` 存在 GitHub Secrets 及 Vercel 環境變數

### FinMind dataset 名稱（已驗證）

| dataset | 說明 |
|---------|------|
| `TaiwanStockTotalInstitutionalInvestors` | 三大法人整體（buy, sell, name, date）|
| `TaiwanStockTotalMarginPurchaseShortSale` | 融資融券整體（name: MarginPurchase/ShortSale, TodayBalance, YesBalance）|
| `TaiwanOptionDaily` | 台指選擇權每日（call_put, strike_price, volume, open_interest）|
| `TaiwanOptionInstitutionalInvestors` | 法人選擇權部位 |
| `USStockPrice` | 美股/指數（支援 ^GSPC ^IXIC ^DJI ^VIX，欄位大寫 Close/High/Low）|
| `GoldPrice` | 黃金現貨（price 欄位）⚠️ 非 GoldFuturesDailyPrice（422）|
| `CrudeOilPrices` | 原油（data_id: WTI / Brent，price 欄位）|

---

## Vercel API 端點

**Base URL：** `https://alphascope-fin.vercel.app/api/news`

| endpoint | 說明 |
|----------|------|
| `?endpoint=futures` | 全球商品排行榜（30 分鐘 cache）|
| `?endpoint=groq` | Groq AI proxy（POST，需 x-owner-token header）|
| `?endpoint=fgi` | CNN Fear & Greed |
| `?endpoint=vix` | VIX term structure |
| `?endpoint=ptt` | PTT 股票版 |
| `?endpoint=reddit&sub=...` | Reddit RSS |

### Groq endpoint Owner 驗證（A+B 雙層）
- **B 層（API）：** `x-owner-token` header → SHA-256 hash → 對比 `OWNER_TOKEN_HASH` 環境變數
- **A 層（前端）：** `localStorage` 存明文密碼（已改為 localStorage，APP 關掉不登出）
- **解鎖 UI：** 右上角 🔐 登入，解鎖後 🔓 Owner
- **產生 hash：** `node -e "console.log(require('crypto').createHash('sha256').update('密碼').digest('hex'))"`
- **Vercel 環境變數：** `OWNER_TOKEN_HASH`

---

## 前端常數

```js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api/news' : 'https://alphascope-fin.vercel.app/api/news';
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';
const OWNER_TOKEN_KEY = 'alphascope_owner_token'; // localStorage key（已從 sessionStorage 改為 localStorage）
```

---

## K 線圖（chart.html）

### 功能
- TradingView Widget（免費版）
- 分類快速選單：🇹🇼 台股 / 📊 指數 / ⚡ 期貨 / 🇺🇸 美股 / 💼 商品ETF / 💱 外匯
- 台股個股：右側 Supabase 近期走勢 bar + PER/殖利率/PBR
- 圖表無法顯示：立即顯示底部跳轉提示條（30 秒後淡出）

### TradingView Symbol 對照（已驗證）

| 標的 | symbol | 免費？|
|------|--------|------|
| 台股個股 | `TWSE:2330` | 需登入 TV 帳號（免費）|
| 台灣加權指數 | `INDEX:TAIEX` | ✅ |
| 台指期近月 | `TAIFEX:TXF1!` | 需登入 TV |
| 台指期次月 | `TAIFEX:TXF2!` | 需登入 TV |
| S&P500 | `SP:SPX` | ✅ |
| 那斯達克 | `NASDAQ:IXIC` | ✅ |
| VIX | `TVC:VIX` | ✅ |
| 日經225 | `TVC:NI225` | ✅ |
| ES 期貨 | `CME_MINI:ES1!` | ✅ |
| WTI 原油 | `NYMEX:CL1!` | ✅ |
| 黃金期貨 | `COMEX:GC1!` | ✅ |
| 美元指數 | `TVC:DXY` | ✅ |
| 外匯 | `FX:EURUSD` 等 | ✅ |

⚠️ **常見錯誤：**
- `TAIFEX:TX1!` ❌ → `TAIFEX:TXF1!` ✅
- `TVC:TAIEX` ❌ → `INDEX:TAIEX` ✅
- `TWSE:TAIEX` ❌ → `INDEX:TAIEX` ✅
- `TSE:2330` ❌ → `TWSE:2330` ✅

### renderTVChart 關鍵邏輯
- `tv.js` 只載入一次（`_tvScriptLoaded` flag），不可重複插入 `<script src="tv.js">`
- 每次切換：清空 container → 新建 `<div id="tradingview_chart">` → `new TradingView.widget({symbol})`

### chart.html JS 注意
- `switchCat(cat, el)` 必須傳 `this`：`onclick="switchCat('tw',this)"`
- `setInterval(iv, el)` 必須傳 `this`：`onclick="setInterval('D',this)"`
- 不可用裸露的 `event` 全域變數（嚴格模式報錯 → 整個 script 失效）
- `loadSupabaseData` 函式頭必須完整（`async function loadSupabaseData(id) {`），`await` 不可在函式外

---

## 台股熱圖

- **155支**，27個產業，從 Supabase 讀取
- **最新日期判斷：** 依日期字串排序（新→舊），取覆蓋率 ≥ 20% 的最新日期（避免部分更新誤判）
- **除錯按鈕：** 熱圖右上「🔍 除錯」，顯示各日期覆蓋率
- `sector_index_daily.chg_pct` 已是百分比，直接用（不乘 100）
- **Tooltip 估值顯示：** 滑鼠移到個股顯示本益比（含偏貴/合理/偏便宜標籤）、殖利率（≥5% 標記🔶）、PBR
- **點擊個股 modal：** 底部有「✦ 生成機構風格個股分析」按鈕（Owner 限定），呼叫 `runStockAI()`

---

## 全球商品排行榜

- 雙向 bar：零軸置中，漲往右（淡紅）、跌往左（淡綠）
- 上方圖例：「◀ 跌 ｜ 零軸 ｜ 漲 ▶」

---

## AI 引擎

**全部使用 Groq：** `llama-3.1-8b-instant`  
**繁體中文：** system message 強制繁體中文，嚴禁簡體中文  
**佇列：** `GROQ_MIN_GAP_MS = 8000`（8 秒間隔）  
**AI 按鈕：** 全部包在 `requireOwner(callback)` 內

### Groq System Prompt（news.js，已升級）
參考 equity-research 框架，角色為「資深股票研究分析師」，內建六大分析維度：
宏觀背景、催化劑、基本面、價格動能、風險因子、投資論點（where might consensus be wrong）

### 各 AI 功能 prompt 框架

| 功能 | 框架來源 | 輸出格式 |
|------|---------|---------|
| 單篇新聞摘要 | equity-research earnings-analysis | 【催化劑】【市場影響】【風險提示】三行 |
| 展開閱讀摘要 | 機構研究框架 | 三段：背景+數據→催化劑分析→風險觀察 |
| 市場早報 | equity-research morning-note | ①宏觀 ②催化劑 ③動能 ④風險 |
| 情緒分析（batch）| 催化劑分類框架 | JSON：sentiment/reason/confidence |
| 情緒總結 | wealth-management client-report | 情緒分布→分歧→議題→尾部風險 |
| 個股快速研究 | equity-research LSEG | Catalyst/Fundamentals/Momentum/Risk/Thesis |

### 新聞篩選規範

**地區黑名單（regionCheck）：** 印度、捷克、菲律賓、非洲相關詞一律丟棄
- 捷克：`czech, czechia, prague, koruna`
- 菲律賓：`philippines, philippine, manila, peso, pse index, bangko sentral`
- 非洲：`safaricom, nairobi, kenya, nigeria, lagos, johannesburg, south africa, ghana, east africa, west africa, sub-saharan`

**Newsletter 過濾：** 標題符合 `^[A-Za-z\s&]+\d{1,2}\/\d{1,2}\/\d{4}$`（如 `Horizons Middle East & Africa 5/8/2026`）直接丟棄

**翻譯門檻：** `popularityScore >= 70`（約前 16-17 篇），單批送出，只翻標題
- 每批 token 預算：~750（遠低於 6,000 TPM 上限）
- max_tokens：600，temperature：0.3

**簡報來源篩選：**
- 台股簡報（isUS=false）：優先取含 `台灣|台股|台積電|TSMC|台幣|加權|外資買超` 的文章
- 美股簡報（isUS=true）：優先取含 `Fed|S&P|Nasdaq|科技股|AI|NVIDIA|Apple|Microsoft` 的文章
- 各取最多 8 篇（相關優先，不足補其他文章）

### 翻譯 prompt 注意
- ⚠️ prompt 裡不可出現「標題」「描述」等字眼作為格式說明，AI 會誤把它當輸出
- 解析時必須過濾：只處理含 `|||` 的行；結果等於「標題」「描述」或長度 ≤ 2 則跳過

---

## PWA（漸進式網頁應用）

**已完成（2026-05-06）：**
- `manifest.json`：APP 名稱、icon、主題色、快捷方式（台股熱圖、多空訊號）
- `service-worker.js`：靜態資源 Cache First，API 請求 Network First
- `icons/`：72/96/128/144/152/192/384/512px + apple-touch-icon + favicon-32
- iOS 安裝提示 banner（Safari → 分享 → 加入主畫面）
- Android Chrome beforeinstallprompt 安裝 banner

**版本號自動更新（deploy.yml）：**
- `service-worker.js` 用 `__SW_VERSION__` 佔位符
- 每次 push 前端檔案或每日收集完成後，Actions 自動替換為時間戳
- 格式：`alphascope-20260506-070000`

**手機版優化：**
- `viewport-fit=cover` + `env(safe-area-inset-top)` 修正動態島遮擋
- header 高度 `calc(60px + env(safe-area-inset-top))`
- 底部加 `env(safe-area-inset-bottom)` 修正 Home Bar
- 字體切換（AAA）：手機版各自保留 sm/md/lg 大小差異
- Owner token 改用 `localStorage`（APP 關掉不登出）

---

## 多空訊號面板（新增功能）

| 新增卡片 | 資料來源 | 說明 |
|---------|---------|------|
| 熱圖估值分布 | `stock_valuation_daily` | 偏便宜/合理/偏貴各幾支，平均 PER/殖利率，市場估值情境 |
| CAPM β 值分析 | `stock_daily_twse`（0050 為市場代理）| 60 日 β 計算，低波動/市場/高波動分布，Top 5 高 β |
| 訊號回測（P/C Ratio）| `stock_daily_twse`（0050 漲跌）| ⚠️ 必須查 `stock_daily_twse`，`stock_daily` 無 0050 資料 |
| VIX 複合訊號 | 側欄已載入的 VIX 值 | VIX≥35 扣 2 分，VIX≥25 扣 1 分，VIX≤15 加 1 分，附在多空描述列 |

---

## 設計規範

```css
--bg: #f0f0f5  --surface: #ffffff  --border: #e2e2ec  --border-dark: #c4c4d4
--accent: #6366f1  --accent2: #0ea5e9  --text: #16161a  --muted: #6e6e7e
--up: #dc2626（漲=紅）  --down: #16a34a（跌=綠）  --header-bg: #0c0c18
```

**字體：** IBM Plex Mono + Noto Sans TC  
**禁止：** 用 `var(--accent)` 表示漲幅；用裸露 `event` 全域變數

### 多空訊號顏色對照（已修正 2026-05-11）

| 訊號 | 顏色 |
|------|------|
| 強力/明顯多頭 | `var(--up)` 紅色 |
| 略偏多頭 | `#f97316` 橘色 |
| 中性觀望 | `var(--muted)` |
| 略偏空頭 | `var(--down)` 綠色 |
| 明顯偏空 | `#15803d` 深綠 |

⚠️ 禁止用 `var(--accent2)`（藍色）表示多頭訊號

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | |
| AI（翻譯/分析/摘要）| ✅ | Owner 限定，Groq，已升級 prompt |
| 個股 AI 快速研究 | ✅ | 熱圖點擊 modal，機構研究框架，Owner 限定；結果 sessionStorage 快取，含生成時間戳 |
| 全球商品排行榜 | ✅ | 雙向 bar |
| K 線圖 | ✅ | TradingView，6分類選單 |
| 台股熱圖 | ✅ | 155支，估值 tooltip，點擊 AI 研究 |
| 多空訊號 | ✅ | 含估值分布、β 值、VIX 複合訊號 |
| 字體大小切換 | ✅ | 三段，localStorage，手機版修正；已覆蓋右側 sidebar（.brief-text 等）|
| Owner 密碼保護 | ✅ | A+B 雙層，localStorage 保持登入 |
| 每日收集 TWSE | ✅ | 台灣時間 06:00，獨立 job |
| 每日收集 FinMind | ✅ | 台灣時間 06:30，獨立 job |
| 熱圖日期修正 | ✅ | 按日期排序取最新 |
| PWA 安裝 | ✅ | iOS/Android，版本號自動更新 |
| 手機版安全區域 | ✅ | 動態島/Home Bar 修正 |
| 估值警示 | ✅ | tooltip + 多空面板分布 |
| CAPM β 值 | ✅ | 多空面板，60日，0050 代理 |
| 產業指數 bar | ⚠️ | 命中率約 50% |
| 月營收收集 | 🔜 | |
| 台股 VIX | ❌ | 無免費來源 |

---

## 常見問題

| 問題 | 解法 |
|------|------|
| FinMind 404 | 確認用 `Authorization: Bearer` header |
| FinMind 422 | 檢查 dataset 名稱（`GoldPrice` 非 `GoldFuturesDailyPrice`）|
| Supabase 400 PGRST204 | 欄位不存在；對照本文件欄位表，移除多餘欄位 |
| 熱圖顯示舊日期 | 用日期字串排序取最新，不用票數最多 |
| Groq 簡體中文 | system message 已強制繁體；prompt 也要明確要求 |
| AI 按鈕無法點 | 確認 `requireOwner` 包覆；`OWNER_TOKEN_HASH` 已設定於 Vercel |
| 翻譯後標題顯示「標題」| prompt 裡不可有「標題」字眼；解析已加防禦過濾 |
| chart.html 按鈕無反應 | 檢查裸露 `event` 用法（改傳 `this`）；確認 `loadSupabaseData` 函式完整 |
| chart.html 顯示舊 symbol | `tv.js` 重複插入不執行；只載一次，每次 `new TradingView.widget()` |
| TV「此商品不存在」 | 確認 symbol 格式（`TAIFEX:TXF1!` 非 `TX1!`；`TVC:TAIEX` 非 `TWSE:TAIEX`）|
| TV「此商品僅TV可用」 | 需登入 TradingView 免費帳號；點「↗ TV 開啟」直連 |
| TWSE 收集到舊日期 | 排程改為獨立 job（collect-twse / collect-finmind），不再用分鐘數判斷 |
| Vercel env 不生效 | 新增後必須 Redeploy |
| PWA 更新沒生效 | service-worker.js 版本號需更新；deploy.yml 已自動處理 |
| 動態島遮擋 header | 已加 `env(safe-area-inset-top)`，需確認 manifest 有 `viewport-fit=cover` |
| pe_ratio 極端值（>200）| 腳本層存 null，前端層顯示時過濾，不影響估值標籤 |
| Groq 429 rate limit | news.js 自動重試；前端 callGroq 收到 429 也自動等待重試 |
| 社群情緒被截斷 | `max_tokens` 需 900（四段結構約 300 字）；prompt 說明「每段完整收尾」|
| 簡報分析來源混亂 | 台股/美股簡報各自用關鍵字篩選相關文章（twKeywords / usKeywords），不共用 |
| options endpoint 504 | FinMind 超時改查 Supabase options_daily fallback（pc_ratio_oi / foreign_opt_net）|
| 新聞標題未翻譯 | 翻譯門檻 popularityScore >= 70；單批送出，max_tokens 600 |
| AI 簡報出現幻覺數字 | prompt 嚴格限制：只能引用新聞明確出現的數字，不可自行補充 |
| Supabase valMap 估值空白 | 欄位名 `pb_ratio` 非 `pbr`，過濾條件必須用 `r.pb_ratio` |

---

## 開發慣例

1. 開新對話上傳 `index.html`、`news.js`、`CLAUDE.md`（視需要加 `chart.html`、`collect_market_data.js`）
2. Claude 複製到 `/home/claude/`，修改後輸出到 `/mnt/user-data/outputs/`
3. JS 驗證：`node --check file.js`
4. HTML div 平衡：`python3 -c "import re; h=open('x.html').read(); print(len(re.findall(r'<div[\\s>]',h)), len(re.findall(r'</div>',h)))"`
5. 漲跌色一律 `var(--up)` / `var(--down)`
6. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
7. Supabase 寫入前先對照本文件確認欄位名稱
8. 翻譯 prompt 不可出現「標題」「描述」等字眼
9. 新增功能同步更新 CLAUDE.md

---

## 工程原則（參考 agent-skills）

### Debug 流程
- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- 找到根源後說明原因，再提出修法，確認後再動手
- 修改後用 `grep` 驗證沒有殘留舊寫法

### Security
- API key 只存 Vercel env 或 GitHub Secrets，前端不得暴露任何 secret
- `GROQ_KEY`、`FINMIND_TOKEN`、`SUPABASE_SERVICE_KEY` 絕不出現在前端程式碼
- Groq endpoint 一律走 `requireOwner()` + `x-owner-token` 雙層保護

### Performance（Groq TPM 管理）
- `llama-3.1-8b-instant` 免費上限：**6,000 TPM**
- 翻譯：只翻標題，單批送出，max_tokens 600，約 750 tokens
- 簡報生成：max_tokens 400，temperature 0.3
- 情緒分析：已有 4.5 秒批次間隔
- 遇 429：news.js 解析 retry-after 自動重試；前端 callGroq 也自動重試

### Supabase 查詢原則
- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（舊表，逐步淘汰）
- 查詢加 `limit` 避免回傳過多資料
- 欄位名稱寫入前必須對照本文件，多餘欄位會 400（PGRST204）

### Vercel Serverless 限制
- Free tier timeout：**10 秒**
- 外部 API（FinMind）每次 fetch 上限 5 秒，整體 deadline 8 秒
- 超時優先回傳 Supabase 快取資料，不要直接 500
- 迴圈次數控制：options endpoint 最多 4 次迴圈

### 每次輸出前 checklist
- [ ] 改了哪些檔案？
- [ ] 影響哪些功能？
- [ ] 有無殘留舊寫法（grep 確認）？
- [ ] div 是否平衡？
- [ ] JS 語法是否正確？
