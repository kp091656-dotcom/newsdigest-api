# AlphaScope — 專案記憶文件 (CLAUDE.md)

> 更新日期：2026-05-30
> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

-----

## 專案概覽

**名稱：** AlphaScope — AI 驅動財經市場情報網站  
**網址：** <https://alphascope-fin.vercel.app>  
**GitHub：** github.com/kp091656-dotcom/alphascope-api  
**架構：** 單一 Vercel repo（前端 + 後端 API）+ Supabase 歷史資料庫  
**分支：** main → 自動部署到 Vercel

-----

## 本地工作檔案路徑

> ⚠️ **2026-05-29 重大架構變更：index.html 已拆分為獨立 JS/CSS 檔案**

|檔案           |Claude 工作路徑                                |部署位置                                    |
|-------------|-------------------------------------------|----------------------------------------|
|前端主檔         |`/home/claude/alphascope/index.html`       |`index.html`                            |
|共用樣式         |`/home/claude/alphascope/css/style.css`    |`css/style.css`                         |
|Supabase/全域變數|`/home/claude/alphascope/js/api.js`        |`js/api.js`                             |
|新聞渲染         |`/home/claude/alphascope/js/news_feed.js`  |`js/news_feed.js`                       |
|社群情緒         |`/home/claude/alphascope/js/sentiment.js`  |`js/sentiment.js`                       |
|股東紀念品        |`/home/claude/alphascope/js/gifts.js`      |`js/gifts.js`                           |
|台股熱圖         |`/home/claude/alphascope/js/heatmap.js`    |`js/heatmap.js`                         |
|多空訊號         |`/home/claude/alphascope/js/signals.js`    |`js/signals.js`                         |
|個股 Modal     |`/home/claude/alphascope/js/stock_modal.js`|`js/stock_modal.js`                     |
|Alpha 交易室    |`/home/claude/alphascope/js/alpha.js`      |`js/alpha.js`                           |
|估值/回測        |`/home/claude/alphascope/js/valuation.js`  |`js/valuation.js`                       |
|籌碼面板         |`/home/claude/alphascope/js/chips.js`      |`js/chips.js`                           |
|自選股          |`/home/claude/alphascope/js/watchlist.js`  |`js/watchlist.js`                       |
|SW/PWA       |`/home/claude/alphascope/js/utils.js`      |`js/utils.js`                           |
|Vercel API   |`/home/claude/news.js`                     |`api/news.js`                           |
|K 線圖         |`/home/claude/chart.html`                  |`chart.html`                            |
|每日收集腳本       |`/home/claude/collect_market_data.js`      |`.github/scripts/collect_market_data.js`|
|備份腳本         |`/home/claude/backup.js`                   |`.github/scripts/backup.js`             |
|紀念品爬蟲        |`/home/claude/scrape_gifts.js`             |`.github/scripts/scrape_gifts.js`       |
|紀念品排程        |`/home/claude/scrape_gifts.yml`            |`.github/workflows/scrape_gifts.yml`    |
|eGift 爬蟲     |`/home/claude/scrape_egift.js`             |`.github/scripts/scrape_egift.js`       |
|eGift 排程     |`/home/claude/scrape_egift.yml`            |`.github/workflows/scrape_egift.yml`    |
|PWA SW       |`/home/claude/service-worker.js`           |`service-worker.js`                     |
|PWA Manifest |`/home/claude/pwa/manifest.json`           |`manifest.json`                         |
|**紀念品後台**    |`gifts-admin.html`                         |`gifts-admin.html`（Vercel 公開）           |

### JS 載入順序（index.html 底部）

```html
<script src="/js/api.js"></script>        <!-- 必須第一個：Supabase、API_BASE、全域變數 -->
<script src="/js/news_feed.js"></script>
<script src="/js/sentiment.js"></script>
<script src="/js/gifts.js"></script>
<script src="/js/heatmap.js"></script>
<script src="/js/signals.js"></script>
<script src="/js/stock_modal.js"></script>
<script src="/js/alpha.js"></script>
<script src="/js/valuation.js"></script>
<script src="/js/chips.js"></script>
<script src="/js/watchlist.js"></script>
<script src="/js/utils.js"></script>
```

### 全域變數定義位置（全在 api.js）

```js
const SUPABASE_URL, SUPABASE_ANON  // Supabase 連線
const API_BASE                      // Vercel API base URL
const CLAUDE_MODEL                  // claude-sonnet-4-20250514
let allArticles, displayedCount, currentLang, currentCat
let _giftsData, _giftCat, _giftSort
let futuresData, futuresSortKey
```

> ⚠️ 開新對話時上傳需要修改的 **單一 js 檔**，不必上傳整個 index.html。  
> 例如改籌碼面板只需上傳 `js/chips.js`，改新聞只需上傳 `js/news_feed.js`。  
> `api.js` 與 `index.html` 骨架通常不需改動。

-----

## Supabase 資料庫

**Project URL：** `https://fdxedcwtmlurumfjmlys.supabase.co`  
**anon key：** `sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0`（前端讀取）  
**service_role key：** 存在 GitHub Secrets `SUPABASE_SERVICE_KEY`（寫入用，勿公開）

### 資料表（共 16 張）

|表名                     |來源               |內容                            |每日筆數   |
|-----------------------|-----------------|------------------------------|-------|
|`stock_daily_twse`     |TWSE OpenAPI     |全上市股票收盤、成交量；含 stock_id=‘TAIEX’|~1230+1|
|`institutional_daily`  |FinMind          |三大法人現貨買賣超                     |1      |
|`margin_daily`         |FinMind          |融資/融券餘額                       |1      |
|`options_daily`        |FinMind          |P/C Ratio、法人選擇權               |1      |
|`futures_daily`        |FinMind + Yahoo Finance|全球商品/指數（前端走 Vercel proxy）  |~35    |
|`sector_index_daily`   |TWSE OpenAPI     |官方產業指數（76個）                   |76     |
|`stock_valuation_daily`|TWSE OpenAPI     |個股本益比/殖利率/PBR                 |~1071  |
|`news_daily`           |RSS（多來源）         |財經新聞快取（保留 48 小時）              |~150   |
|`alpha_daily_report`   |Groq AI          |Alpha 交易員每日報告                 |1      |
|`trader_positions`     |Alpha 自動         |Alpha 持倉紀錄（open/closed）       |動態     |
|`chips_daily`          |FinMind + TAIFEX |籌碼資料（現貨+期貨+選擇權）               |1      |
|`shareholder_gifts`    |scrape_egift + 手動|股東紀念品資訊（含 eGift）              |年度     |
|`gift_scrape_log`      |scrape_gifts.js  |爬蟲進度追蹤（每股每年一筆狀態紀錄）            |年度     |


> ⚠️ `stock_daily`（舊表）已廢棄，禁止查詢，等待刪除。

### RLS 政策（2026-05-27 全面修正）

**所有 12 張 SELECT 可讀表**的 RLS 已統一改為 `TO anon, authenticated`：

```sql
-- 已修正的表（全部）：
-- alpha_daily_report, chips_daily, futures_daily, institutional_daily,
-- margin_daily, news_daily, options_daily, sector_index_daily,
-- shareholder_gifts, stock_daily_twse, stock_valuation_daily, trader_positions
-- policy name 統一為 "anon read"，roles = {anon,authenticated}
```

> ⚠️ 如果新建資料表，記得加 `CREATE POLICY "anon read" ON {table} FOR SELECT TO anon, authenticated USING (true);`

### 各表實際欄位（已逐一確認，嚴格遵守）

```
stock_daily_twse     : date, stock_id, name, close, prev, chg_pct, volume, source, created_at
                       ⚠️ stock_id='TAIEX' 為加權指數

news_daily           : id, url, title, title_zh, description, source, lang, published_at, collected_at

alpha_daily_report   : id, report_date, market_mood, market_summary,
                       market_context（盤勢背景，含總經分析）,
                       key_risks（jsonb 陣列，2-3項具體風險）,
                       sector_focus（jsonb 陣列，{name,reason,sentiment}）,
                       alpha_note,
                       dominant_player, retail_signal,
                       suggest_cash（boolean）, cash_reason, margin_alert,
                       recommendations(jsonb), data_sources(jsonb),
                       macro_data（jsonb，SOX/DXY/美債2Y+10Y/台幣/聯準會利率/S&P500）,
                       fear_greed（jsonb，{score,rating,prev_week}）,
                       generated_at
                       ⚠️ report_date 用台灣時間（todayTW()），避免 UTC 22:xx 寫入前一天

trader_positions     : id, stock_id, stock_name, entry_price, target_price, stop_loss,
                       shares, style, reason, status, exit_price, pnl, pnl_pct, opened_at, closed_at

stock_valuation_daily: date, stock_id, name, pe_ratio, pb_ratio, dividend_yield

institutional_daily  : date, foreign_net, trust_net, dealer_net, total_net
                       ⚠️ 欄位是 trust_net（不是 invest_net）
                       ⚠️ 單位：元（FinMind 原始值），前端顯示要 ÷ 1e8 轉億
                       ⚠️ 三大法人合計顯示請用 chips_daily.spot_total_net（億元，正確）
                          不要用 institutional_daily.total_net（有重複計算問題）

margin_daily         : date, margin_balance, margin_chg, short_balance, short_chg

options_daily        : date, pc_ratio_vol, pc_ratio_oi, max_pain, call_oi, put_oi, call_vol, put_vol, foreign_opt_net

sector_index_daily   : date, index_name, close, change, chg_pct

chips_daily          : date（UNIQUE）,
                       spot_dealer_buy/sell/net, spot_trust_buy/sell/net, spot_foreign_buy/sell/net, spot_total_net,
                       inst_foreign_net, inst_trust_net, inst_dealer_net（= spot_*_net，前端用別名）,
                       margin_balance, margin_change（融資餘額/變化，張；由 collectChips 從 FinMind 寫入）,
                       fut_tx_dealer_long/short/net, fut_tx_trust_long/short/net, fut_tx_foreign_long/short/net, fut_tx_total_net,
                       fut_mtx_dealer/trust/foreign_net, fut_mtx_total_net,
                       fut_tmf_dealer/trust/foreign_net, fut_tmf_total_net,
                       fut_tmf_total_oi（integer，微台全體未平倉量，正確值約 67,426 口）,
                       opt_call_dealer/trust/foreign_long/short/net,
                       opt_put_dealer/trust/foreign_long/short/net

shareholder_gifts    : id（UUID）, stock_id, stock_name, sector,
                       record_date（停止過戶日，DATE）, meeting_date（DATE）,
                       gift_desc, gift_category（food/goods/voucher/cash/3c/other）,
                       gift_value_est（估值元，integer）,
                       share_required（最低持股股數，integer，1張=1000股）,
                       share_price_ref（參考股價）, cp_ratio（估值/股價%）,
                       source_url, note, year（integer）,
                       is_egift（boolean, default false）,
                       egift_types（text[], 品項陣列）,
                       egift_min_share（integer, 最低持股，預設1000）,
                       egift_date（DATE, eGift 開始領取日）,
                       created_at, updated_at
                       UNIQUE (stock_id, year)

gift_scrape_log      : stock_id, stock_name, year, status, checked_at
                       status: found / not_found / no_pdf / scanned_pdf / error
                       PRIMARY KEY (stock_id, year)
```

⚠️ **重要：**

- `stock_daily_twse.chg_pct` 是小數（0.0122 = +1.22%），前端顯示時 ×100
- `sector_index_daily.chg_pct` 已是百分比（1.54 = +1.54%），直接用
- `margin_daily` FinMind name 值：`MarginPurchase`（融資）、`ShortSale`（融券）
- `stock_valuation_daily` 查詢一定用 `select=*` 避免 400
- `chips_daily.spot_*` 單位億元（FinMind 原始元 ÷ 100,000,000）
- `chips_daily.fut_*` / `opt_*` 單位口數（OI）
- `chips_daily` 查詢時 **不可** 包含 `short_balance`（該欄位在 `margin_daily`，不在 `chips_daily`）
- `shareholder_gifts.share_required` 單位是「股」，1張=1000股，預設1000

-----

## GitHub Actions 每日收集

**Node.js：** 24  
**⚠️ collect.yml 已拆分為 5 個獨立 workflow 檔案**

|workflow 檔案          |cron           |台灣時間        |收集內容                 |
|---------------------|---------------|------------|---------------------|
|`collect-twse.yml`   |`0 22 * * 0-4` |週一~週五 06:00 |TWSE 個股、產業指數、估值、籌碼   |
|`collect-alpha.yml`  |`20 22 * * 0-4`|週一~週五 06:20 |Alpha 停損停利 + 生成每日報告  |
|`collect-finmind.yml`|`30 22 * * 0-4`|週一~週五 06:30 |FinMind 法人、融資券、選擇權   |
|`collect-news.yml`   |`0 */2 * * *`  |全天每 2 小時    |RSS 新聞抓取存 Supabase   |
|`backup.yml`         |`0 1 * * 0`    |週日 09:00    |Supabase 各表備份到 pCloud|
|`scrape_gifts.yml`   |（已停用自動排程）      |僅手動觸發       |MOPS 議事手冊爬蟲，每批 100 家 |
|`scrape_egift.yml`   |`30 1 * * 0`   |**週日** 09:30|集保 eGift 名單同步        |


> ⚠️ **新 workflow 第一次需要手動 Run workflow 一次**，之後 cron 才會自動觸發。  
> ⚠️ `collect-alpha` 用時間差（+20 分鐘）等 TWSE 跑完，不再用 `needs`。

**GitHub Secrets 必要項目：**
`FINMIND_TOKEN`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`GROQ_API_KEY`、`RCLONE_PCLOUD_TOKEN`、`RCLONE_PCLOUD_HOSTNAME`

**Vercel 環境變數：**
`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`ADMIN_KEY`、`GROQ_API_KEY`、`GEMINI_API_KEY`、`OWNER_TOKEN_HASH`、`FINMIND_TOKEN`、`TWELVE_DATA_KEY`

### lastTradingDay() 邏輯

- 台灣時間 16:00 前 → 退一天
- 週末 → 往前找週五
- GitHub Actions 在 UTC 環境執行，`getDate()` = `getUTCDate()`，無時區問題

### getTradeDate() 時區修正

- `news.js` options endpoint 用 UTC+8 台灣時間
- `const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);`
- 用 `setUTCDate / getUTCDay` 操作，避免 local timezone 干擾

-----

## news.js API Endpoints（完整清單）

|endpoint         |方法                   |功能                      |驗證              |
|-----------------|---------------------|------------------------|----------------|
|`news_cached`    |GET                  |Supabase 快取新聞           |無               |
|`alpha_report`   |GET                  |Alpha 每日報告              |無               |
|`chips`          |GET                  |籌碼資料（chips_daily 最新）    |無               |
|`alpha_analyze`  |POST                 |AI 分析持倉                 |x-owner-token   |
|`alpha_positions`|GET/POST/PATCH/DELETE|持倉管理                    |x-owner-token   |
|`fgi`            |GET                  |恐慌貪婪指數                  |無               |
|`vix`            |GET                  |VIX 波動率                 |無               |
|`futures`        |GET                  |全球商品/期貨                 |無               |
|`twvix`          |GET                  |台灣 VIX                  |無               |
|`commodities`    |GET                  |大宗商品                    |無               |
|`finmind`        |GET                  |FinMind proxy           |無               |
|`gemini`         |POST                 |Gemini AI               |x-owner-token   |
|`groq`           |POST                 |Groq AI                 |x-owner-token   |
|`ptt_article`    |GET                  |PTT 文章內容                |無               |
|`ptt`            |GET                  |PTT 看板                  |無               |
|`reddit`         |GET                  |Reddit                  |無               |
|`options`        |GET                  |選擇權資料                   |無               |
|`institutional`  |GET                  |三大法人（chips_daily）       |無               |
|`margin`         |GET                  |融資融券                    |無               |
|`twheatmap`      |GET                  |台股熱圖（FinMind）           |無               |
|`gifts`          |GET                  |股東紀念品（shareholder_gifts）|無（nocache=1 可強制）|
|`gifts_admin`    |GET/POST/DELETE      |紀念品管理後台                 |x-admin-key     |
|`tmf`            |GET                  |微型台指法人部位（chips_daily）   |無               |

-----

## 前端功能模組

### Tab 架構

|Tab            |panel ID       |show 函式         |
|---------------|---------------|----------------|
|全部（新聞）         |`newsFeed`     |—（預設）           |
|科技/經濟/地緣/全球商品/…|`newsFeed`     |分類 filter       |
|🇹🇼 台股熱圖         |`heatmapPanel` |`showHeatmap()` |
|📡 多空訊號         |`signalPanel`  |`showSignal()`  |
|🔍 選股篩選         |`screenerPanel`|`openScreener()`|
|🎁 紀念品          |`giftsPanel`   |`showGifts()`   |


> ⚠️ **頁面預設停在新聞頁**（不自動 showHeatmap）。`loadHeatmap()` 在背景預載，點 tab 時即時顯示。

### 重要變數

```js
let allArticles = [];
let currentCat = 'general';  // 新聞分類
let _giftsData = null;        // 紀念品資料快取
let _giftCat   = '';          // 紀念品類別篩選
let _giftSort  = 'deadline';  // 紀念品排序
```

### loadMktSignals 注意事項

- `opt`、`inst` 變數已提升到函式外層 scope（不在 if block 內）
- 包含 `try/finally`，`_busy` 無論成功失敗都會 reset
- TMF 卡片資料來自 `chips_daily`（`/api/news?endpoint=tmf`），不打 FinMind

-----

## 股東紀念品 + eGift 功能

### 架構

```
集保結算所 eGift 頁面（TDCC）
  ↓ scrape_egift.js（週一三五自動 / 手動觸發）
  ↓ Step 1：從集保頁面動態找最新 PDF 連結
  ↓ Step 2：下載 PDF
  ↓ Step 3：pdf-parse 解析 → 公司清單（代號+名稱+股東會日期）
  ↓ Step 4：Upsert → shareholder_gifts（is_egift=true）
  ↓ Step 5：清理已撤回 eGift 公司（is_egift → false）
```

### 前端紀念品功能

- `showGifts()` → 顯示 `giftsPanel`，隱藏其他所有 panel
- `loadGifts()` → `GET /api/news?endpoint=gifts&show_past=1&nocache=1`
- `reRenderGifts()` → 過濾（類別/eGift/已截止）+ 排序 + 渲染卡片
- 預設過濾掉 `record_date < today`，勾「顯示已截止」才顯示全部

### 管理後台（gifts-admin.html）

- 打 `/api/news?endpoint=gifts_admin`
- 需要 `x-admin-key` header（= Vercel `ADMIN_KEY` 環境變數）
- 支援 GET（讀全部）/ POST（新增/更新）/ DELETE（刪除）
- 每次寫入後自動清除 `_giftsCache`

### TMF 微型台指散戶多空比

- 來源：`chips_daily.fut_tmf_*`
- `retail_ratio = -(total_net) / total_oi × 100`
- `total_oi` = 全體未平倉（約 67,426 口，來自 TAIFEX HTML 小計行）
- HTML 解析：取「小計:」文字之後的數字，合計成交量（最大值）後第一個數字即為 OI

-----

## 籌碼面板（chips_daily）資料流

```
FinMind TaiwanStockTotalInstitutionalInvestors
  → spot_*（億元）
  → 寫完後同步：inst_foreign_net = spot_foreign_net（別名）

FinMind TaiwanStockTotalMarginPurchaseShortSale
  → margin_balance, margin_change（張）

TAIFEX OpenAPI MarketDataOfMajorInstitutionalTraders…
  → fut_tx_* / fut_mtx_* / fut_tmf_*

TAIFEX futDailyMarketCSV POST（TMF 全體 OI）
  → fut_tmf_total_oi（67,426 口）
  → HTML fallback：取小計行「合計成交量」之後第一個數字

FinMind TaiwanOptionInstitutionalInvestors (data_id=TXO)
  → opt_call_* / opt_put_*（CALL/PUT 分開）
```

-----

## AI 引擎

**全部使用 Groq：** `llama-3.3-70b-versatile`  
**繁體中文：** system message 強制繁體中文  
**佇列：** `GROQ_MIN_GAP_MS = 8000`（8 秒間隔）  
**AI 按鈕：** 全部包在 `requireOwner(callback)` 內

-----

## 設計規範

```css
--bg: #f0f0f5  --surface: #ffffff  --border: #e2e2ec  --border-dark: #c4c4d4
--accent: #6366f1  --accent2: #0ea5e9  --text: #16161a  --muted: #6e6e7e
--up: #dc2626（漲=紅）  --down: #16a34a（跌=綠）  --header-bg: #0c0c18
```

**字體：** Noto Sans TC 主字體；IBM Plex Mono 僅用於數字/代碼  
**禁止：** 用 `var(--accent)` 表示漲幅；用裸露 `event` 全域變數

-----

## 常見問題

|問題                                |解法                                                             |
|----------------------------------|---------------------------------------------------------------|
|FinMind 404                       |確認用 `Authorization: Bearer` header                             |
|Supabase 400 PGRST204             |欄位不存在；對照本文件；執行 `NOTIFY pgrst, 'reload schema'`                 |
|Supabase 400（前端查詢）                |確認 RLS 有 anon read policy；新表記得加                                |
|TMF 全體 OI 抓取錯誤                    |HTML 解析：取「小計:」後數字，最大值（合計成交量）後第一個即為 OI                          |
|chips_daily 查詢 400                |確認沒有 `select=short_balance`（那是 margin_daily 的欄位）               |
|三大法人合計數字異常（914億）                  |不要用 institutional_daily.total_net；改用 chips_daily.spot_total_net|
|institutional_daily 欄位 400        |欄位是 trust_net，不是 invest_net                                    |
|TXO CALL/PUT 無資料                  |call_put 值是繁體「買權」/「賣權」                                         |
|Alpha 報告沒有 dominant_player        |chips_daily 要有資料才會注入；手動跑 twse mode                             |
|gifts_admin 登入 401                |ADMIN_KEY 錯誤或 Vercel 環境變數未設/未 Redeploy                         |
|gifts_admin 載入中（卡住）               |endpoint 不存在或 mbnSetActive 等函式未定義導致 showGifts() 中途拋錯           |
|紀念品「目前無符合條件」                      |預設過濾 record_date < today；勾「顯示已截止」查看所有資料                        |
|多空訊號子儀表「待載入」                      |inst 變數 scope 問題；已提升到外層 + try/finally 保護                       |
|財經新聞空白                            |檢查 Vercel API /api/news?endpoint=news_cached 是否有回傳；可能是 cache   |
|台股熱圖一直轉圈                          |loadHeatmap() 背景預載中；點 tab 後若仍空白確認 RLS                          |
|新 workflow cron 未觸發               |需先手動 Run workflow 一次，GitHub 才會啟動 cron 排程                       |
|collect-alpha 跑在 TWSE 之前          |改用時間差（06:20）而非 needs；若 TWSE 跑超過 20 分鐘可調整 cron                  |
|eGift PDF 解析 0 家                  |PDF 換行問題；代號+名稱一行，日期下一行                                         |
|news.js SyntaxError Unexpected ‘}’|檢查新加的 endpoint if 語句有沒有被合併到注釋同一行                               |
|MIS 個股無即時價格                       |上櫃股預設用 tse_ 前綴會失敗；需傳 market:'otc'；盤後 z 欄位為最後成交價非即時            |
|alpha.js macro_data 不顯示           |先確認 Supabase 已執行新增欄位 SQL；舊報告無此欄位屬正常                            |
|InterestRate FED 無資料               |聯準會利率變動少，抓 90 天；若仍無資料確認 FinMind token 有效                       |
|DXY 抓取失敗                          |Yahoo Finance v8 API 偶爾限速；失敗靜默不影響其他指標                          |

-----

## 2026-05-30 本次對話改動總覽

### collect_market_data.js — AI 分析引擎全面升級

**systemPrompt 升級（機構級研究框架）**
- 角色從「台股交易員」升級為「台股專業交易員兼市場分析師」
- 新增總經面分析維度（SOX/DXY/美債/台幣/聯準會利率/Fear&Greed）
- 殖利率曲線倒掛（10Y-2Y < 0）→ 偏保守策略
- `signal_source` 新增「總經面」選項
- `market_context` 強制要求提及聯準會利率與殖利率曲線
- `max_tokens` 從 2000 → 3000

**新增資料注入（userPrompt）**
- 4b：選擇權 P/C Ratio + Max Pain（`options_daily`）
- 4c：大台期貨 TX 三大法人淨口（`chips_daily`）
- 4d：產業指數 Top5 / Bottom5（`sector_index_daily`）
- 4e：總體經濟指標（SOX、台幣、美債2Y+10Y、聯準會利率、S&P500、DXY）
- 4f：CNN Fear & Greed Index

**新增 AI 輸出欄位（全部寫入 Supabase）**
- `market_context`：盤勢背景分析（含總經）
- `key_risks`：具體風險 2-3 項（jsonb）
- `sector_focus`：重點產業 {name, reason, sentiment}（jsonb）
- `macro_data`：總經指標快照（jsonb）
- `fear_greed`：Fear & Greed 分數（jsonb）

**資料來源變更**
- ⚠️ **stooq 完全棄用**（不穩定、限速）
- 改用 FinMind：美股指數、SOX、VIX、商品、台幣匯率、美債2Y+10Y、聯準會利率
- 改用 Yahoo Finance v8 chart API：DXY（FinMind 無此資料）
- 改用 CNN dataviz API：Fear & Greed Index

**FinMind dataset 對照（已驗證）**
```
USStockPrice + ^SOX         → SOX 費城半導體
TaiwanExchangeRate + USD    → 台幣匯率（欄位 spot_buy）
GovernmentBondsYield + United States 2-Year  → 美債2Y（欄位 value）
GovernmentBondsYield + United States 10-Year → 美債10Y（欄位 value）
InterestRate + FED          → 聯準會利率（欄位 interest_rate，抓 90 天）
```

**Supabase 新欄位 SQL**
```sql
ALTER TABLE alpha_daily_report
  ADD COLUMN IF NOT EXISTS market_context  text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS key_risks       jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sector_focus    jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dominant_player text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS retail_signal   text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggest_cash    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_reason     text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS margin_alert    text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS macro_data      jsonb,
  ADD COLUMN IF NOT EXISTS fear_greed      jsonb;
NOTIFY pgrst, 'reload schema';
```

---

### alpha.js — 今日總結卡片升級

- `market_summary` 升級為多層次結構：主要判斷 → 盤勢背景（靛藍左邊線）→ ⚠️ 關鍵風險 → 📡 重點產業
- 新增 `alphaMacroBar`：Fear & Greed 分數 + 總經指標小格（動態建立，不需改 index.html）
- 殖利率倒掛時顯示橙色警示條
- alpha report 資料存進 `sessionStorage('alpha_report_cache')` 供其他模組使用

---

### signals.js — 個股 Modal + 多空訊號升級

**個股 Modal 即時報價（MIS）**
- `openStockModal` 開啟後，盤中非同步 fetch MIS 一次
- 覆蓋「今日統計」四格為即時價 ⚡、漲跌幅、昨收、漲跌
- 漲停橙色、跌停青色標記
- 標題右側顯示成交時間 + 量（e.g. `13:25:03 · 234k張`）
- 失敗靜默降級保留昨收

**多空訊號加總經狀態**
- `signalDesc` 後追加：10Y-2Y 利差（倒掛警示）、Fed 利率、DXY、SOX 漲跌
- 從 `sessionStorage('alpha_report_cache')` 取，不多發 API 請求

---

### watchlist.js — 自選股即時報價（MIS）

- 新增 TWSE MIS helper（`isTradingHours`、`fetchMISPrice`、`parseMISRow`、`startMISPolling`、`stopMISPolling`）
- 自選股每行加 `data-wl-id`、`.wl-price`、`.wl-chg`
- `wlRender` 後盤中啟動輪詢，每 5 秒更新
- 關閉面板自動 `stopMISPolling()`
- 今日總結大盤 `dsbTWSE` 盤中顯示 MIS 即時加權指數 + `⚡時間戳`

---

### TWSE MIS API（新增文件）

- 文件：`TWSE_MIS_SKILL.md`（repo 根目錄）
- 個股：`tse_{stock_id}.tw` / 上櫃：`otc_{stock_id}.tw`
- 指數：`tse_t00.tw`（TAIEX）、`tse_t24.tw`（半導體）等
- 關鍵欄位：`z`=即時價、`y`=昨收、`u`=漲停、`w`=跌停、`v`=量、`t`=時間
- ⚠️ heatmap 產業指數**暫不接 MIS**（TWSE 指數分類無法涵蓋所有細分產業，混用會造成資料不一致）

---

## 2026-05-29 本次對話改動總覽

### 前端架構重構（index.html 拆分）

- 原本 7,624 行的 `index.html` 拆成 1 個 CSS + 12 個 JS 獨立檔案
- `index.html` 瘦身到 ~1,230 行（純 HTML 骨架）
- 好處：跟 AI 對話只需上傳單一 js 檔，省 80%+ token

### 前端檔案命名

- `js/news.js`（舊）→ `js/news_feed.js`（新），避免與 `api/news.js` 混淆
- `api/news.js` = Vercel Serverless Function（後端）
- `js/news_feed.js` = 前端新聞渲染 JS

### Workflow 調整

- `scrape_gifts.yml` 停用自動排程（cron 已注解），只保留手動觸發
- `scrape_egift.yml` 改為**每週日**09:30 執行（原為週一三五）

### 籌碼面板趨勢圖新增

- 多空訊號→籌碼面板底部新增 4 張近 10 日 Canvas 趨勢圖
- 🏢 三大法人現貨買賣超（累積面積圖）
- 📈 台指期 TX 三大法人淨口（折線圖）
- ▲ 選擇權 CALL 三大法人淨口（折線圖）
- ▼ 選擇權 PUT 三大法人淨口（折線圖）
- 支援 hover tooltip 顯示當日數值、Y 軸對稱零軸、X 軸全日期

### Canvas 無限拉長 Bug 修正（chips.js）

- **根因：** `makeCanvasChart()` 在 `appendChild` 前就執行 `setupCanvas()`，掛載後 ResizeObserver 偵測到寬度從 0→實際值，觸發 `canvas.width` 改變，引發無限 layout 迴圈
- **修法：**
1. `cssW` 初始設為 `0`，`draw()` 有 `if (cssW <= 0) return` 守門
1. 先 `appendChild` 再讓 ResizeObserver 給真實寬度，才執行第一次繪圖
1. `wrap` 寫死 `height:185px; overflow:hidden`，卡片高度在 DOM 流裡永遠不變
1. Canvas 外包 `canvasWrap`（`position:relative; height:120px; max-height:120px; overflow:hidden`）
1. Canvas 用 `position:absolute` 脫離文件流，不參與高度計算
1. ResizeObserver 只在寬度變化 ≥ 4px 時才觸發，用 `requestAnimationFrame` 節流

-----

## 2026-05-27 本次對話改動總覽

### RLS 全面修正

- 所有 12 張 SELECT 可讀表的 RLS 從 `{public}` 改為 `{anon,authenticated}`
- 財經新聞、台股熱圖、多空訊號、紀念品等功能全部恢復正常

### Workflow 拆分

- `collect.yml` 拆成 5 個獨立檔案：`collect-twse.yml`、`collect-alpha.yml`、`collect-finmind.yml`、`collect-news.yml`、`backup.yml`
- 不再需要複雜的 `if: contains(...)` 條件判斷

### Bug 修復

1. **頁面預設顯示** — 移除 `showHeatmap()` 自動執行，改為 `loadHeatmap()` 背景預載
1. **多空訊號 `inst is not defined`** — `opt`/`inst` 提升到外層 scope
1. **`loadMktSignals._busy` 鎖死** — 加 `try/finally` 確保 reset
1. **`institutional_daily.invest_net`** — 改為正確欄位名 `trust_net`
1. **三大法人合計數字錯誤** — 改從 `chips_daily.spot_total_net` 讀取
1. **TMF OI 解析錯誤（45458→67426）** — 改取「小計:」後合計成交量之後第一個數字
1. **`showGifts()` 中 `mbnSetActive` 未定義** — 移除該呼叫
1. **`gifts` endpoint nocache** — 加 `nocache=1` 參數強制跳過 cache

### 新增功能

- **`gifts` endpoint** — `news.js` 新增，查 `shareholder_gifts`，6 小時 cache
- **`gifts_admin` endpoint** — `news.js` 新增，支援 GET/POST/DELETE，`x-admin-key` 驗證
- **`tmf` endpoint** — 改從 `chips_daily` 讀取（不再打 FinMind），資料更準確
- **紀念品 tab 移植** — 從舊版 `index.html` 完整移植回現版（CSS + HTML + JS）

-----

## 開發慣例

1. 開新對話上傳需要修改的**單一 js 檔** + `CLAUDE.md`（視需要加 `collect_market_data.js` 或 `news.js`）
1. Claude 複製到 `/home/claude/alphascope/js/`，修改後輸出到 `/mnt/user-data/outputs/`
1. 改籌碼相關只需 `chips.js`；改新聞只需 `news_feed.js`；改樣式只需 `style.css`
1. JS 驗證：`node --check file.js`
1. HTML 驗證：用 Python 統計 `<script>/<style>` 開關標籤數量是否一致
1. 漲跌色一律 `var(--up)` / `var(--down)`
1. 不可用裸露 `event`，改傳 `this` 或 `addEventListener`
1. Supabase 寫入前先對照本文件確認欄位名稱
1. 新功能同步更新 CLAUDE.md
1. `str_replace` 後務必確認相鄰上下文，避免 if 語句被合併到注釋同行
1. 新增 show 函式時，記得在其他所有 `showXxx()` 函式裡加上隱藏新 panel 的邏輯
1. Canvas 圖表禁止在 `appendChild` 前執行 `setupCanvas/draw`（會觸發無限 ResizeObserver 迴圈）

-----

## 工程原則

### Debug 流程

- 遇到 bug **必須先看程式碼找根源**，不可憑推測直接改
- HTTP 500 → 看 Vercel Logs；HTTP 400 → 多半是 Supabase 資料表/欄位問題
- 找到根源後說明原因，再提出修法
- 前端顯示異常優先用瀏覽器 DevTools Console 找錯誤

### Security

- API key 只存 Vercel env 或 GitHub Secrets
- Groq endpoint 一律走 `requireOwner()` + `x-owner-token` 雙層保護
- `gifts_admin` 走 `x-admin-key` header，`ADMIN_KEY` 存 Vercel env

### Supabase 查詢原則

- 新功能一律用 `stock_daily_twse`，禁止用 `stock_daily`（舊表）
- 查詢加 `limit` 避免回傳過多資料
- 多 ID 篩選用 `stock_id=in.(2330,2454,...)` 而非 `or=(...)`
- 155 支股票的 in() 查詢需分兩批（各 ~77 支）避免 URL 過長 → 400
- Upsert 必須指定 `on_conflict` 欄位
- schema cache 更新：`NOTIFY pgrst, 'reload schema';`