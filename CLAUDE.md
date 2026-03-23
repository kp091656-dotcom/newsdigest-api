# NewsDigest.AI — 專案記憶文件 (CLAUDE.md)

> 給 Claude 看的專案上下文。每次新對話開始請先讀這個檔案。

---

## 專案概覽

**名稱：** NewsDigest.AI — AI 驅動財經新聞網站  
**網址：** https://newsdigest-api.vercel.app  
**GitHub：** github.com/kp091656-dotcom/newsdigest-api  
**架構：** 單一 Vercel repo（前端 + 後端 API）  
**分支：** main → 自動部署到 Vercel

---

## 本地工作檔案路徑

| 檔案 | 路徑 |
|------|------|
| 主要工作檔 | `/mnt/user-data/outputs/newsdigest-gnews.html` |
| 部署用前端 | `/mnt/user-data/outputs/newsdigest-vercel/index.html` |
| Vercel API | `/mnt/user-data/outputs/newsdigest-vercel/api/news.js` |
| K 棒圖 | `/mnt/user-data/outputs/newsdigest-vercel/chart.html` |

> 修改後記得：`cp newsdigest-gnews.html index.html && cp index.html newsdigest-vercel/index.html`

---

## Vercel API 端點

**Base URL：** `https://newsdigest-api.vercel.app/api/news`

| endpoint | 說明 | 來源 |
|----------|------|------|
| `?endpoint=news` | RSS 新聞（預設）| Reuters/CNBC/Bloomberg/MarketWatch/FT |
| `?endpoint=fgi` | CNN Fear & Greed Index | production.dataviz.cnn.io |
| `?endpoint=vix` | VIX 波動率 | Yahoo Finance（server-side）|
| `?endpoint=futures` | 全球商品排行榜 | stooq.com |
| `?endpoint=commodities` | 黃金/原油現貨 | FinMind |
| `?endpoint=finmind` | FinMind 通用端點 | FinMind API |
| `?endpoint=twvix` | 台股 VIX（未完成）| TAIFEX |

### FinMind 端點參數
```
?endpoint=finmind&dataset=TaiwanFuturesDaily&symbol=TX&start=2024-01-01
?endpoint=finmind&dataset=TaiwanStockPrice&symbol=2330&start=2024-01-01
?endpoint=finmind&dataset=TaiwanStockPrice&symbol=TAIEX&start=2024-01-01
?endpoint=finmind&dataset=USStockPrice&symbol=^VIX&start=2024-01-01
?endpoint=finmind&dataset=USStockPrice&symbol=^IXIC&start=2024-01-01
?endpoint=finmind&dataset=CrudeOilPrices&data_id=WTI&start=2024-01-01
?endpoint=finmind&dataset=CrudeOilPrices&data_id=Brent&start=2024-01-01
?endpoint=finmind&dataset=GoldPrice&start=2024-01-01
```

---

## 環境變數（Vercel）

| 變數 | 值 | 用途 |
|------|-----|------|
| `FINMIND_TOKEN` | `eyJ0eXAiOiJKV1QiLCJhbGci...` | FinMind API |
| `THENEWSAPI_TOKEN` | `hbA3Qlx...` | 已棄用 |
| `TWELVE_DATA_KEY` | `44fd4099...` | 已棄用（改用 stooq）|

---

## API 金鑰（前端）

| 金鑰 | 說明 | 儲存位置 |
|------|------|------|
| Groq API Key | `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | localStorage `nd_groq_key` |
| FinMind Token | 見上方 Vercel 環境變數 | Vercel env |

---

## 已確認有效的資料來源符號

### stooq.com（`endpoint=futures` 使用）
**注意：** stooq 需從 Vercel server-side 抓（瀏覽器有 CORS 限制）

| 類別 | stooq 符號 | 名稱 |
|------|-----------|------|
| 美股指數 | `%5Espx` | S&P500 |
| 美股指數 | `%5Endx` | 那斯達克100 |
| 美股指數 | `%5Edji` | 道瓊 |
| 美股指數 | `%5Edax` | 德國DAX |
| 亞股指數 | `%5Ehsi` | 香港恆生 |
| 外匯 | `EURUSD` | 歐元/美元 |
| 外匯 | `GBPUSD` | 英鎊/美元 |
| 外匯 | `USDJPY` | 美元/日圓 |
| 外匯 | `AUDUSD` | 澳幣/美元 |
| 外匯 | `USDCAD` | 美元/加幣 |
| 債券 | `10USY.B` | 10年美債殖利率 |
| 債券 | `30USY.B` | 30年美債殖利率 |
| 加密 | `BTCUSD` | 比特幣 |
| 加密 | `ETHUSD` | 以太幣 |

**注意：** stooq 的 `.F` 期貨符號（CL.F, GC.F 等）CSV 下載**不支援**（需登入）

### FinMind（`TaiwanStockPrice` dataset）
| 符號 | 名稱 |
|------|------|
| `TAIEX` | 台灣加權指數 |
| `2330` | 台積電 |
| `2317` | 鴻海 |
| `2454` | 聯發科 |
| `0050` | 元大台50 |

**欄位：** `date, open, max, min, close, Trading_Volume`

### FinMind（`USStockPrice` dataset）
| 符號 | 名稱 |
|------|------|
| `^VIX` | 美國 VIX 波動率 |
| `^IXIC` | 那斯達克綜合 |
| `^GSPC` | S&P500 |
| `^DJI` | 道瓊 |
| `AAPL` | 蘋果 |
| `NVDA` | 輝達 |
| `TSM` | 台積電ADR |

**欄位：** `date, Open, High, Low, Close, Adj_Close, Volume`

### FinMind（`TaiwanFuturesDaily` dataset）
- 台指期：`TX`（需篩選 `trading_session === 'position'`，取最近月 `contract_date`）
- 小台指：`MTX`
- 電子期：`TE`

**欄位：** `date, futures_id, contract_date, open, max, min, close, volume, trading_session`

### FinMind（`CrudeOilPrices` dataset）
| data_id | 名稱 |
|---------|------|
| `WTI` | WTI 原油（每日） |
| `Brent` | 布倫特原油（每日） |

**欄位：** `date, name, price`

### FinMind（`GoldPrice` dataset）
- 無需 `data_id`
- 5 分鐘即時資料
- **欄位：** `date`（含時間）, `Price`（大寫 P）
- 需自行按日期分組取最後一筆

---

## 前端架構

**字體：** Playfair Display + IBM Plex Mono + Noto Sans TC  
**顏色變數：**
```css
--accent: #c8521a  /* 橘色 */
--accent2: #1a6bc8 /* 藍色 */
--accent3: #2a9d5c /* 綠色 */
--bg: #faf8f3
--surface: #f5f3ee
--border: #e8e4dc
--text: #1a1814
--muted: #8a8278
```

**AI 引擎：** Groq API（`llama-3.3-70b-versatile`）  
**函式名稱（歷史遺留）：**
- `callGemini()` → 實際呼叫 Groq
- `fetchMarketaux()` → 實際抓 RSS 新聞

---

## 主要功能清單

| 功能 | 狀態 | 說明 |
|------|------|------|
| RSS 新聞 | ✅ | Reuters/CNBC/Bloomberg/MarketWatch/FT |
| AI 翻譯 | ✅ | Groq，批次5篇，繁體中文 |
| 今日市場摘要 | ✅ | Groq 生成3-5重點 |
| 美股/台股簡報 | ✅ | Groq 生成 |
| Fear & Greed (CNN) | ✅ | 半圓量表 |
| Fear & Greed (加密) | ✅ | Alternative.me |
| VIX 波動率 | ✅ | Yahoo Finance proxy |
| 全球商品排行榜 | ✅ | stooq + FinMind |
| K 棒圖 | ✅ | chart.html，含MA/BB/RSI/MACD |
| 台股 VIX | ❌ | 找不到免費資料來源 |
| 多語言 | ✅ | 繁中/簡中/EN/日/ESP |
| 自動刷新 | ✅ | 15分鐘，含倒數條 |

---

## chart.html 功能

**URL：** https://newsdigest-api.vercel.app/chart.html

**快捷按鈕：**
- 台股：加權指數(TAIEX)、台指期(TX)、台積電(2330)、聯發科(2454)、元大台50(0050)
- 美股：S&P500(^GSPC)、那斯達克(^IXIC)、道瓊(^DJI)、VIX(^VIX)、蘋果(AAPL)、輝達(NVDA)、台積電ADR(TSM)

**搜尋邏輯：**
- 以 `^` 開頭 → 美股指數
- 純英文字母（非TX/MTX/TAIEX）→ 美股
- 數字 → 台股
- TX/MTX 等 → 台指期

**指標：** MA5/20/60/120/240、布林通道(20日)、RSI(14)、MACD(12,26,9)

**type 參數：**
- `'tw'` → `TaiwanStockPrice`
- `'us'` → `USStockPrice`
- `'futures'` → `TaiwanFuturesDaily`

---

## 已知限制 / 待解決

1. **台股 VIX** — 期交所無公開 API，FinMind 無此資料集
2. **stooq 農產品/能源期貨** — `.F` 符號 CSV 不支援（需登入）
3. **Yahoo Finance** — 完全被 CORS 封鎖（無論 browser 或 Vercel server）
4. **Twelve Data** — 免費版不支援期貨，且符號與美股衝突
5. **FinMind 免費版** — 每次請求資料量限制，避免一次抓太多

---

## 常見問題解法

**Q: 部署後函式 undefined？**  
A: 檔案被截斷，重新檢查 `saveGroqKey`、`fetchMarketaux`、`showFutures` 是否存在

**Q: stooq 回傳空白？**  
A: `.F` 期貨需登入；指數需用 `%5E` 編碼（`^` → `%5E`）

**Q: FinMind 回傳空？**  
A: 檢查 `dataset` 名稱大小寫（如 `TaiwanStockPrice` 不是 `TaiwanStockprice`）

**Q: Vercel 環境變數生效？**  
A: 新增後必須 Redeploy 才能生效

---

## 開發慣例

1. 修改 `newsdigest-gnews.html` 為主要工作檔
2. 完成後 cp 到 `newsdigest-vercel/index.html`
3. 上傳到 GitHub → Vercel 自動部署
4. 測試 API 直接用瀏覽器開 endpoint URL
5. JS 語法驗證：`node -e "new Function(js_string)"`
