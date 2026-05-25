# AlphaScope — 專案記憶文件 (CLAUDE.md)
> 更新日期：2026-05-22
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
| 備份腳本 | `/home/claude/backup.js` | `.github/scripts/backup.js` |
| PWA SW | `/home/claude/service-worker.js` | `service-worker.js` |
| PWA Manifest | `/home/claude/pwa/manifest.json` | `manifest.json` |
| PWA Deploy | `/home/claude/deploy.yml` | `.github/workflows/deploy.yml` |

> 每次對話開始，請先上傳 index.html、news.js、CLAUDE.md（以及需要修改的 chart.html 或 collect_market_data.js），Claude 複製到 /home/claude/ 再修改，完成後輸出到 /mnt/user-data/outputs/。

---

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 12 張）

| 表名 | 來源 | 內容 | 每日筆數 |
|------|------|------|---------|
| `stock_daily_twse` | TWSE OpenAPI | 全上市股票收盤、成交量；**含 stock_id='TAIEX'（加權指數）** | ~1230+1 |
| `institutional_daily` | FinMind | 三大法人現貨買賣超（千股單位）| 1 |
| `margin_daily` | FinMind | 融資/融券餘額 | 1 |
| `options_daily` | FinMind | P/C Ratio、法人選擇權 | 1 |
| `futures_daily` | stooq+FinMind | 全球商品/指數（前端走 Vercel proxy，此表備份用）| ~35 |
| `sector_index_daily` | TWSE OpenAPI | 官方產業指數（76個）| 76 |
| `stock_valuation_daily` | TWSE OpenAPI | 個股本益比/殖利率/PBR | ~1071 |
| `news_daily` | RSS（多來源） | 財經新聞快取（英文+台股中文，保留 48 小時）| ~150 |
| `alpha_daily_report` | Groq AI | Alpha 交易員每日報告（推薦、市場判斷）| 1 |
| `trader_positions` | Alpha 自動 | Alpha 持倉紀錄（open/closed，含損益）| 動態 |
| `chips_daily` | FinMind + TAIFEX OpenAPI | 籌碼資料（現貨+期貨+選擇權三大法人）| 1 |

> ⚠️ `stock_daily`（舊表）已廢棄，禁止查詢，等待刪除。

### 各表實際欄位（已逐一確認，嚴格遵守）

```
stock_daily_twse     : date, stock_id, name, close, prev, chg_pct, volume, source, created_at
                       ⚠️ stock_id='TAIEX' 為加權指數（由 collectSectorIndex 每日寫入）✅ 已確認正常

news_daily           : id, url, title, title_zh, description, source, lang, published_at, collected_at

alpha_daily_report   : id, report_date, market_mood, market_summary, alpha_note,
                       recommendations(jsonb), data_sources(jsonb), generated_at
                       ⚠️ report_date 用台灣時間（todayTW()），避免 UTC 22:xx 寫入前一天
                       ✅ 新增欄位（2026-05-22）：
                          dominant_player（今日主導者）
                          retail_signal（散戶訊號）
                          suggest_cash（boolean，建議空手）
                          cash_reason（空手理由）
                          margin_alert（融資警示）
                          recommendations 每筆新增 signal_source 欄位

trader_positions     : id, stock_id, stock_name, entry_price, target_price, stop_loss,
                       shares, style, reason, status, exit_price, pnl, pnl_pct, opened_at, closed_at

stock_valuation_daily: date, stock_id, name, pe_ratio, pb_ratio, dividend_yield

institutional_daily  : date, foreign_net, trust_net, dealer_net, total_net

margin_daily         : date, margin_balance, margin_chg, short_balance, short_chg

options_daily        : date, pc_ratio_vol, pc_ratio_oi, foreign_opt_net

sector_index_daily   : date, index_name, close, change, chg_pct

chips_daily          : date（UNIQUE）,
                       spot_dealer_buy/sell/net, spot_trust_buy/sell/net, spot_foreign_buy/sell/net, spot_total_net,
                       fut_tx_dealer_long/short/net, fut_tx_trust_long/short/net, fut_tx_foreign_long/short/net, fut_tx_total_net,
                       fut_mtx_dealer_long/short/net, fut_mtx_trust_long/short/net, fut_mtx_foreign_long/short/net, fut_mtx_total_net,
                       fut_tmf_dealer_long/short/net, fut_tmf_trust_long/short/net, fut_tmf_foreign_long/short/net, fut_tmf_total_net,
                       fut_tmf_total_oi（✅ 新增 2026-05-22，integer，微台全體未平倉量）,
                       inst_foreign_net, inst_trust_net, inst_dealer_net（現貨三大法人億元）,
                       margin_balance, margin_change（融資餘額/變化，張）,
                       opt_call_dealer_long/short/net, opt_call_trust_long/short/net, opt_call_foreign_long/short/net,
                       opt_put_dealer_long/short/net, opt_put_trust_long/short/net, opt_put_foreign_long/short/net
```

⚠️ **重要：**
- `stock_daily_twse.chg_pct` 是小數（0.0122 = +1.22%），前端顯示時 ×100
- `sector_index_daily.chg_pct` 已是百分比（1.54 = +1.54%），直接用，不需 ×100
- `margin_daily` FinMind name 值為英文：`MarginPurchase`（融資）、`ShortSale`（融券）
- `options_daily` 前端讀取欄位：`date, pc_ratio_oi, foreign_opt_net`
- `stock_valuation_daily` 查詢一定用 `select=*` 避免 400
- `stock_valuation_daily.pe_ratio > 200` 視為失真（微利股），腳本層與前端層雙重過濾
- `listed_shares` ❌ 不存在，前端不要查此欄位
- `futures_daily` 前端走 Vercel proxy，不讀 Supabase；Supabase 欄位尚未完整確認，collect 腳本暫不寫入
- `chips_daily.spot_*` 單位億元（FinMind 原始單位元 ÷ 100,000,000）
- `chips_daily.fut_*` / `opt_*` 單位口數（OI）
- `chips_daily.fut_tmf_total_oi` 需先在 Supabase 執行 `ALTER TABLE chips_daily ADD COLUMN IF NOT EXISTS fut_tmf_total_oi integer;`

### 加權指數資料來源
- `collectSectorIndex()` 每日把「發行量加權指數」額外寫入 `stock_daily_twse`，`stock_id='TAIEX'` ✅ 已正常運作
- 前端今日總結橫幅讀取順序：`TAIEX` → fallback `0050`

### Supabase 查詢注意
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400
- Upsert 必須指定 `on_conflict` 欄位，且欄位必須存在於資料表
- 寫入前先對照本文件確認欄位名稱，多餘欄位會 400（PGRST204）
- schema cache 更新：`NOTIFY pgrst, 'reload schema';`

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
| `0 22 * * 0-4` | 週日~週四 22:00 | **週一~週五 06:00** | `collect-twse` | TWSE 個股、產業指數、估值、籌碼（chips） |
| `0 22 * * 0-4` | — | **TWSE 完成後自動** | `collect-alpha` | Alpha 停損停利 + 生成每日報告（needs: collect-twse）|
| `30 22 * * 0-4` | 週日~週四 22:30 | **週一~週五 06:30** | `collect-finmind` | FinMind 法人、融資券、選擇權 |
| `0 */2 * * *` | 全天 偶數整點 | **全天每 2 小時** | `collect-news` | RSS 新聞抓取存 Supabase |
| `0 1 * * 0` | 週日 01:00 UTC | **週日 09:00 台灣** | `backup-to-pcloud` | Supabase 各表備份到 pCloud |
| 手動觸發 | — | — | 各 job 自判斷 | 依 inputs.mode（all/twse/finmind/alpha/news/backup）|

**GitHub Secrets 必要項目：**
`FINMIND_TOKEN`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`GROQ_API_KEY`、`RCLONE_PCLOUD_TOKEN`、`RCLONE_PCLOUD_HOSTNAME`

### lastTradingDay() 邏輯
TWSE STOCK_DAY_ALL 不含日期欄位，必須自行推算：
- 台灣時間 16:00 前執行 → 當日資料未發布，用前一日
- 週末 → 往前找週五
- 06:00 執行（hour=6 < 16）→ 退一天 → 正確拿到前一交易日 ✅

### getTradeDate() 時區修正（2026-05-22）
- `news.js` 的 FinMind options/institutional endpoint 改用台灣時間（UTC+8）
- `const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);`
- 用 `setUTCDate / getUTCDay` 操作，避免 local timezone 干擾
- 凌晨 00:00–07:59 執行時不再取到前一天日期

### report_date 時區注意
- `alpha_daily_report.report_date` 必須用 `todayTW()`（UTC+8），不能用 `new Date().toISOString().slice(0,10)`（UTC）
- UTC 22:xx 執行時，UTC 日期是前一天，台灣日期是正確的今天

---

## TWSE OpenAPI（GitHub Actions 可用，Vercel IP 403 封鎖）

**Base URL：** `https://openapi.twse.com.tw/v1`

| endpoint | 內容 | 欄位（已確認）|
|----------|------|-------------|
| `/exchangeReport/STOCK_DAY_ALL` | 全上市個股每日成交 | Code, Name, ClosingPrice, Change, TradeVolume |
| `/exchangeReport/MI_INDEX` | 各類官方指數 | 日期, 指數, 收盤指數, 漲跌, 漲跌點數, 漲跌百分比 |
| `/exchangeReport/BWIBBU_ALL` | 個股本益比/殖利率/PBR | Code, Name, PEratio, PBratio, DividendYield |
| `/exchangeReport/MI_INST` | 三大法人整體買賣超 | 買賣別, 買進金額, 賣出金額, 買賣超額（千元）⚠️ 偶爾回傳 HTML |
| `/exchangeReport/BFIA01` | 三大法人買賣金額（備用）| 買賣別, 買進金額, 賣出金額, 買賣超額（千元）⚠️ 偶爾回傳 HTML |

**三大法人現貨：** MI_INST → BFIA01 → FinMind 三層 fallback（collect_market_data.js 已實作）

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
| `TaiwanStockTotalInstitutionalInvestors` | 三大法人整體買賣（name 為英文：Dealer_self/Investment_Trust/Foreign_Investor，單位：元）|
| `TaiwanStockTotalMarginPurchaseShortSale` | 融資融券整體（name: MarginPurchase/ShortSale, TodayBalance, YesBalance）|
| `TaiwanOptionDaily` | 台指選擇權每日（call_put 值為英文 C/P，strike_price, volume, open_interest）|
| `TaiwanOptionInstitutionalInvestors` | 法人選擇權部位（data_id=TXO，**call_put=買權/賣權（繁體中文）**，institutional_investors 欄位）|
| `TaiwanFuturesInstitutionalInvestors` | 期貨法人（data_id=MTX/TMF 等）|
| `USStockPrice` | 美股/指數（支援 ^GSPC ^IXIC ^DJI ^VIX，欄位大寫 Close/High/Low）|
| `GoldPrice` | 黃金現貨（price 欄位）⚠️ 非 GoldFuturesDailyPrice（422）|
| `CrudeOilPrices` | 原油（data_id: WTI / Brent，price 欄位）|

### FinMind 欄位與單位注意

| dataset | name 值 | 單位 | 換算億元 |
|---------|---------|------|---------|
| `TaiwanStockTotalInstitutionalInvestors` | `Dealer_self`（自營商自行）<br>`Investment_Trust`（投信）<br>`Foreign_Investor`（外資及陸資）<br>`Dealer_Hedging`（自營商避險）<br>`Foreign_Dealer_Self`（外資自營商） | 元 | ÷ 100,000,000 |
| `TaiwanOptionInstitutionalInvestors` | `call_put`：`買權`/`賣權`（**繁體中文**）<br>`institutional_investors`：`自營商`/`投信`/`外資及陸資` | 口數 | 不需換算 |

⚠️ **自營商重複計算問題：** `TaiwanStockTotalInstitutionalInvestors` 自營商出現兩筆（自行+避險），合計三大法人加總時會虛高。現貨法人合計數字與籌碼面板數字可能不同。

---

## TAIFEX OpenAPI（期貨/選擇權三大法人）

**Base URL：** `https://openapi.taifex.com.tw/v1`

| endpoint | 內容 | 欄位 |
|----------|------|------|
| `MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate?queryDate=YYYYMMDD` | 期貨三大法人（全商品）| ContractCode（中文名稱！）、Item（身份別）、OpenInterest(Long/Short/Net) |
| `MarketDataOfMajorInstitutionalTradersDetailsOfOptionsContractsBytheDate?queryDate=YYYYMMDD` | 選擇權三大法人（整體 OI，無 CALL/PUT 分開）| 同上 |

### TMF 全體未平倉量抓取（2026-05-22 實作）

**⚠️ openapi.taifex.com.tw 被 GitHub Actions IP 封鎖（回傳 HTML 錯誤頁）**

正確做法（雙策略）：
1. **策略1（主線）：** POST `https://www.taifex.com.tw/cht/3/futDailyMarketCSV`，body: `queryDate=2026/05/22&marketType=0&commodity_id=TMF`，解析 CSV 標題列找「未沖銷契約量」欄位 index，再從小計列取該 index 值
2. **策略2（Fallback）：** GET `https://www.taifex.com.tw/cht/3/futDailyMarketExcel?commodity_id=TMF`，解析 HTML 小計列，取合計成交量（最大值）後面的第一個數字

CSV 小計列格式：`2026/05/21,TMF,小計,,,,,,,,366998,,57139,一般,`（OI 在「未沖銷契約量」標題對應欄位）

### TAIFEX 商品代碼對照（ContractCode 是中文！）

| 英文代號 | TAIFEX ContractCode | 說明 |
|---------|--------------------|----|
| TX | `臺股期貨` | 大台指 |
| MTX | `小型臺指期貨` | 小台 |
| TMF | `微型臺指期貨` | 微台（2024-07-29 上市）|
| TXO | `臺指選擇權` | 台指選擇權（CALL/PUT 用 FinMind 取得）|

⚠️ `contractCode` query 參數無效，一次取全部後在記憶體過濾

---

## 微台指散戶多空比（2026-05-22 新增）

**公式：** `散戶多空比 = -1 × 三大法人合計淨額 / 全體未平倉量 × 100`（%）

**資料來源：**
- 三大法人淨額：`chips_daily.fut_tmf_total_net`（口）
- 全體 OI：`chips_daily.fut_tmf_total_oi`（口）

**前端 endpoint：** `?endpoint=tmf`，從 `chips_daily` 取近 30 筆，計算歷史散戶多空比

**判讀（賣方思維）：**
- 正值 > +10%：散戶偏多 → 賣方警戒
- 負值 < -10%：散戶偏空 → 賣方相對有利
- 今日範例（2026-05-21）：三大法人 -3,556 口 / 全體 57,139 口 = **+6.22%（散戶略偏多）**

**多空訊號面板：** 欄②已從「三大法人現貨」換成「🔬 微型台指 TMF 散戶多空比」，顯示：
- 主數字 %、標籤（散戶偏多/偏空/極端）
- 計算明細（合計淨額 ÷ 全體 OI）
- 法人明細進度條（外資/投信/自營商）
- 近期趨勢 bar chart、公式驗算行

---

## P/C Ratio 判讀邏輯（賣方思維，2026-05-22 修正）

**賣方思維定義（與市場標準相反）：**
- PUT 多（P/C > 1.0）→ 買方在買保險 → **賣方收 PUT 權利金 → 偏多**
- CALL 多（P/C < 1.0）→ 買方在買漲 → **賣方承接 CALL 風險 → 偏空**

| P/C OI | 判斷 | 得分 |
|--------|------|------|
| ≥ 1.7 | 強力偏多 | +2 |
| 1.3–1.7 | 略偏多 | +1 |
| 1.0–1.3 | 中性 | 0 |
| 0.7–1.0 | 略偏空 | -1 |
| < 0.7 | 強力偏空 | -2 |

**顏色：** 偏多 → `var(--up)` 紅；偏空 → `var(--down)` 綠（與其他多空指標統一）

---

## 法人選擇權淨部位計算（2026-05-22 修正）

**舊邏輯（錯誤）：** 把 CALL+PUT 合計當「法人淨部位」，方向解讀模糊

**新邏輯（正確）：** `CALL 淨部位 - PUT 淨部位 = 方向性部位`
- 正值：法人 CALL 多於 PUT → 方向性偏多
- 負值：法人 PUT 多於 CALL → 方向性偏空

**news.js institution 資料結構（已更新）：**
```js
institution['外資'] = {
  call: CALL淨部位（口）,
  put:  PUT淨部位（口）,
  net:  callNet - putNet   // 方向性部位
}
```

**前端顯示：** 主數字顯示 net，下方小字顯示「買權 +2,209 / 賣權 +3,670」

---

## pCloud 備份系統

**架構：** GitHub Actions `backup-to-pcloud` job → rclone → pCloud EU 伺服器  
**備份路徑：** `pCloud:AlphaScope-Backups/YYYY-MM-DD/`  
**保留期：** 最近 8 週，自動清理更早的資料夾  
**備份內容：** 8 張主要資料表  
**格式：** JSON.gz 壓縮  
**Secrets：** `RCLONE_PCLOUD_TOKEN`、`RCLONE_PCLOUD_HOSTNAME`（= `eapi.pcloud.com`）

---

## Vercel API 端點

**Base URL：** `https://alphascope-fin.vercel.app/api/news`

| endpoint | 說明 |
|----------|------|
| `?endpoint=futures` | 全球商品排行榜（30 分鐘 cache）|
| `?endpoint=groq` | Groq AI proxy（POST，需 x-owner-token header）|
| `?endpoint=fgi` | CNN Fear & Greed |
| `?endpoint=vix` | VIX（優先 FinMind ^VIX，fallback Yahoo v8）|
| `?endpoint=ptt` | PTT 股票版 |
| `?endpoint=reddit&sub=...` | Reddit RSS |
| `?endpoint=news_cached` | Supabase 快取新聞 |
| `?endpoint=alpha_report` | Alpha 今日報告讀取 |
| `?endpoint=alpha_analyze` | Alpha 即時分析（Owner 限定，POST）|
| `?endpoint=alpha_positions` | Alpha 持倉 CRUD |
| `?endpoint=chips&limit=N` | chips_daily 籌碼資料 |
| `?endpoint=tmf` | 微台指散戶多空比（✅ 新增 2026-05-22）近 30 日，含 retail_ratio |
| `?endpoint=options` | 台指選擇權（P/C Ratio、Max Pain、法人選擇權部位）|
| `?endpoint=institutional` | 三大法人現貨（含 streak 連買賣天數）|
| `?endpoint=margin` | 融資融券 |

---

## 今日總結橫幅（首頁最上方）

- 頁面載入自動顯示，整合 Alpha 報告 + 加權指數 + VIX
- **加權指數**：從 `stock_daily_twse` 讀 `stock_id='TAIEX'` ✅
- **VIX**：從 `?endpoint=vix` 取

---

## 功能狀態

| 功能 | 狀態 | 備註 |
|------|------|------|
| RSS 新聞 | ✅ | |
| AI（翻譯/分析/摘要）| ✅ | Owner 限定，Groq |
| 個股 AI 快速研究 | ✅ | |
| 全球商品排行榜 | ✅ | |
| K 線圖 | ✅ | TradingView |
| 台股熱圖 | ✅ | 155支 |
| 多空訊號 | ✅ | 含估值/β/VIX |
| Alpha 交易員 | ✅ | |
| 今日總結橫幅 | ✅ | |
| 選股篩選 | ✅ | |
| 自選股 Watchlist | ✅ | 含 5 日迷你走勢圖（2026-05-22）|
| 個股 Modal 基本面/籌碼 | ✅ | |
| Alpha 30天回測 | ✅ | |
| 法人籌碼警示條 | ✅ | |
| 字體大小切換 | ✅ | |
| PWA 安裝 | ✅ | |
| 📡 多空訊號儀表板 | ✅ | 圓形儀表盤（0-100分）+ 4個子分數（2026-05-22）|
| 微台指散戶多空比 | ✅ | 取代三大法人現貨欄位（2026-05-22）|
| P/C Ratio 賣方思維 | ✅ | > 1.0 偏多（2026-05-22 修正）|
| 法人選擇權 CALL-PUT | ✅ | 方向性部位（2026-05-22 修正）|
| Alpha 巨人傑思維框架 | ✅ | 主導者/散戶訊號/空手建議（2026-05-22）|
| pCloud 每週備份 | ✅ | |

---

## 2026-05-22 本次對話改動總覽

### index.html
1. **Alpha 交易室 4 步驟流程條**：收集資料→AI分析→生成報告→自動進場
2. **Alpha 推薦卡片信心度圓圈**：高=9/10紅、中=6/10橙、低=3/10綠
3. **多空訊號圓形儀表盤**：totalScore(-8~+8)映射0-100，3/4圓弧，4個子分數小圓圈（法人籌碼/選擇權/融資券/恐慌指數）
4. **Watchlist 5日迷你走勢**：grid 加欄 52px，inline SVG 折線圖，顏色跟漲跌一致
5. **P/C Ratio 賣方思維修正**：> 1.0 偏多（3處同步：loadMktSignals/loadOptions/fallback）
6. **法人選擇權改為 CALL-PUT 方向性部位**：主數字顯示 net，下方小字顯示買權/賣權明細
7. **多空訊號欄②換成微台指散戶多空比**：含主數字/標籤/計算明細/法人進度條/趨勢bar
8. **Alpha 報告注入巨人傑思維框架**：systemPrompt 全改，新增 dominant_player/retail_signal/suggest_cash/cash_reason/margin_alert/signal_source 欄位，前端顯示主導者標籤列+空手建議橫幅+推薦卡片信心來源標籤

### news.js
1. **getTradeDate 時區修正**：改用 UTC+8 台灣時間，凌晨不再取到前一天
2. **法人選擇權解析重寫**：按 call_put（買權/賣權）分開記錄，計算方向性部位
3. **新增 endpoint=tmf**：從 chips_daily 計算近 30 日散戶多空比

### collect_market_data.js
1. **新增 fut_tmf_total_oi 欄位**：result 初始化 + 雙策略抓取（CSV POST 主線 + HTML fallback）
2. **CSV 標題列自動對位**：用 `findIndex('未沖銷契約量')` 精準定位，防期交所改版
3. **Alpha report 注入籌碼資料**：userPrompt 加入 chips_daily 最新一筆（外資/投信/自營/融資/TMF散戶比）
4. **Alpha systemPrompt 全面改寫**：五大框架（全觀研究/找主導者/供需邏輯/賣方情緒/空手策略）

---

## 籌碼面板（chips_daily）資料流

```
FinMind TaiwanStockTotalInstitutionalInvestors
  → 現貨三大法人買賣超（億元）
  → chips_daily.spot_* / inst_foreign_net / inst_trust_net / inst_dealer_net

TAIFEX OpenAPI MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate
  → 期貨三大法人 OI（ContractCode 中文過濾）
  → chips_daily.fut_tx_* / fut_mtx_* / fut_tmf_*

TAIFEX futDailyMarketCSV POST（TMF 全體 OI）
  → chips_daily.fut_tmf_total_oi
  → 計算散戶多空比 = -1 × fut_tmf_total_net / fut_tmf_total_oi × 100

FinMind TaiwanOptionInstitutionalInvestors (data_id=TXO)
  → 選擇權 CALL(買權)/PUT(賣權) 三大法人 OI，分開記錄
  → chips_daily.opt_call_* / opt_put_*

前端 loadChipsPanel()
  → GET /api/news?endpoint=chips&limit=1
  → 顯示在 📡 多空訊號 tab
```

---

## Alpha 交易員

### 架構
- **每日（台灣時間約 06:05）** `collect-alpha` 在 TWSE job 後自動執行
- 流程：停損停利檢查 → 抓籌碼 → AI 生成報告 → 自動建立買進持倉
- 報告存入 `alpha_daily_report`，持倉存入 `trader_positions`

### Alpha 報告新欄位（2026-05-22）
```json
{
  "market_summary": "市場總結（含主導力量分析）",
  "market_mood": "樂觀/中性/謹慎/悲觀",
  "dominant_player": "今日主導者：外資/自營商/投信/散戶/混沌",
  "retail_signal": "散戶訊號：偏多警戒/偏空機會/中性",
  "suggest_cash": true,
  "cash_reason": "空手理由",
  "margin_alert": "融資警示：正常/偏高注意/危機",
  "recommendations": [{
    "signal_source": "籌碼面/基本面/事件面/供需面",
    ...
  }],
  "alpha_note": "一句話警語"
}
```

### 巨人傑五大思維框架（已植入 systemPrompt）
1. **全觀研究**：籌碼+基本面+事件+供需全看，不迷信單一指標
2. **找主導者**：每筆虧損問「是誰賺走我的錢？」，明確指出今日主導力量
3. **供需邏輯**：用生意人眼光看市場，成交量爆量→找受惠方
4. **賣方情緒判讀**：散戶多空比 >+10% 警戒，<-10% 相對有利
5. **空手也是策略**：方向不明、籌碼混亂時 suggest_cash=true

### 前端新增顯示
- **主導者標籤列**（`alphaMetaBar`）：顯示 dominant_player / retail_signal / margin_alert
- **空手建議橫幅**（`alphaCashBar`）：suggest_cash=true 時顯示橘色警示
- **推薦卡片 signal_source 標籤**：籌碼面/基本面/事件面/供需面

### 防護機制
- **重複建倉防護：** 進場前查 open 持倉，同股跳過
- **當日平倉防護：** 當日已停損/停利的股票，當天不再重新進場

---

## AI 引擎

**全部使用 Groq：** `llama-3.3-70b-versatile`  
**繁體中文：** system message 強制繁體中文  
**佇列：** `GROQ_MIN_GAP_MS = 8000`（8 秒間隔）  
**AI 按鈕：** 全部包在 `requireOwner(callback)` 內

---

## 設計規範

```css
--bg: #f0f0f5  --surface: #ffffff  --border: #e2e2ec  --border-dark: #c4c4d4
--accent: #6366f1  --accent2: #0ea5e9  --text: #16161a  --muted: #6e6e7e
--up: #dc2626（漲=紅）  --down: #16a34a（跌=綠）  --header-bg: #0c0c18
```

**字體：** Noto Sans TC 主字體；IBM Plex Mono 僅用於數字/代碼  
**禁止：** 用 `var(--accent)` 表示漲幅；用裸露 `event` 全域變數

---

## 常見問題

| 問題 | 解法 |
|------|------|
| FinMind 404 | 確認用 `Authorization: Bearer` header |
| Supabase 400 PGRST204 | 欄位不存在；對照本文件；執行 `NOTIFY pgrst, 'reload schema'` |
| TMF 全體 OI 抓取失敗 | 優先用 CSV POST；openapi.taifex.com.tw 被 Actions IP 封鎖 |
| TMF OI 數字錯誤 | CSV 用標題列 findIndex('未沖銷契約量') 定位，不用倒數法 |
| chips_daily 400 | ALTER TABLE 加欄位 + NOTIFY pgrst reload |
| TXO CALL/PUT 無資料 | call_put 值是繁體「買權」/「賣權」|
| Alpha 報告沒有 dominant_player | chips_daily 要有資料才會注入；手動跑 twse mode |
| suggest_cash 橫幅不顯示 | 檢查 alphaCashBar DOM 是否存在 |
| P/C Ratio 判斷反了 | 已修正為賣方思維，> 1.0 = 偏多 |
| Groq 簡體中文 | system message 已強制繁體 |
| TWSE 收集到舊日期 | lastTradingDay() 正確，06:00 執行退一天 |
| getTradeDate 取到前一天 | 已修正用 UTC+8，用 setUTCDate 操作 |
| panel-title 不跟字體縮放 | 已改 Noto Sans TC + html root font-size |

---

## 開發慣例

1. 開新對話上傳 `index.html`、`news.js`、`CLAUDE.md`（視需要加 `collect_market_data.js`）
2. Claude 複製到 `/home/claude/`，修改後輸出到 `/mnt/user-data/outputs/`
3. JS 驗證：`node --check file.js`
4. 漲跌色一律 `var(--up)` / `var(--down)`
5. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
6. Supabase 寫入前先對照本文件確認欄位名稱
7. 新增功能同步更新 CLAUDE.md
8. Python patch 用 unicode escape 避免中文字串斷行問題

---

## 工程原則

### Debug 流程
- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- 找到根源後說明原因，再提出修法

### Security
- API key 只存 Vercel env 或 GitHub Secrets
- Groq endpoint 一律走 `requireOwner()` + `x-owner-token` 雙層保護

### Supabase 查詢原則
- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（舊表）
- 查詢加 `limit` 避免回傳過多資料
