# SKILL: TWSE MIS 即時報價 API

> 台灣證券交易所市場資訊系統（Market Information System）  
> 免費、不需 API key、盤中即時更新（約 5 秒延遲）  
> ⚠️ 僅盤中（09:00–13:30）有即時資料，盤後回傳最後成交價

---

## Endpoint

```
https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={代號}
```

### 單一個股
```
https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw
```

### 多檔一次抓（用 `|` 分隔，建議上限 20 檔）
```
https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw|tse_2317.tw|tse_2454.tw
```

### 上市 vs 上櫃
| 市場 | 前綴 | 後綴 | 範例 |
|------|------|------|------|
| 上市（TSE） | `tse_` | `.tw` | `tse_2330.tw` |
| 上櫃（OTC） | `otc_` | `.tw` | `otc_6669.tw` |

---

## 回傳結構

```json
{
  "msgArray": [
    {
      "ex": "tse",
      "ch": "2330.tw",
      "n":  "台積電",
      "z":  "980.00",
      "y":  "975.00",
      "o":  "976.00",
      "h":  "982.00",
      "l":  "974.00",
      "u":  "1072.00",
      "w":  "877.00",
      "v":  "12345",
      "a":  "980.00_981.00_982.00_983.00_984.00",
      "b":  "979.00_978.00_977.00_976.00_975.00",
      "f":  "100_200_300_150_250",
      "g":  "50_80_120_200_300",
      "t":  "13:25:03",
      "d":  "20260530",
      "tv": "234",
      "pz": "980.00"
    }
  ],
  "userDelay": 5,
  "rtmessage": "OK",
  "queryTime": { ... }
}
```

---

## 欄位對照表（完整）

### 價格欄位
| 欄位 | 說明 | 備註 |
|------|------|------|
| `z`  | 最新成交價 | 盤中最後一筆，盤後為收盤價 |
| `y`  | 昨收價 | |
| `o`  | 開盤價 | |
| `h`  | 今日最高價 | |
| `l`  | 今日最低價 | |
| `u`  | **漲停價** | 直接算好，不用自己 ×1.1 |
| `w`  | **跌停價** | 直接算好，不用自己 ×0.9 |
| `pz` | 上次成交價 | 前一筆，可用來判斷方向 |

### 量能欄位
| 欄位 | 說明 | 備註 |
|------|------|------|
| `v`  | 今日累計成交量（張） | |
| `tv` | 最新一筆成交量（張） | |

### 五檔掛單
| 欄位 | 說明 | 格式 |
|------|------|------|
| `a`  | 賣出五檔價格 | `"價1_價2_價3_價4_價5"` 由低到高 |
| `b`  | 買入五檔價格 | `"價1_價2_價3_價4_價5"` 由高到低 |
| `f`  | 賣出五檔量（張） | 對應 `a` 的順序 |
| `g`  | 買入五檔量（張） | 對應 `b` 的順序 |

### 基本資訊
| 欄位 | 說明 |
|------|------|
| `n`  | 股票名稱（中文） |
| `ex` | 市場（`tse` 上市 / `otc` 上櫃） |
| `ch` | 股票代號（含 `.tw`） |
| `d`  | 日期（`YYYYMMDD`） |
| `t`  | 最後成交時間（`HH:MM:SS`） |

---

## JavaScript 使用範例

### 基本抓取
```javascript
async function fetchMISPrice(stockIds) {
  // stockIds: ['2330', '2317', '2454']
  // 自動判斷上市/上櫃需要額外資訊，預設上市用 tse_
  const exCh = stockIds.map(id => `tse_${id}.tw`).join('|');
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}`;
  
  const res = await fetch(url, {
    headers: { 'Referer': 'https://mis.twse.com.tw/' }
  });
  const json = await res.json();
  return json.msgArray || [];
}
```

### 解析單一個股資料
```javascript
function parseMISRow(row) {
  const price  = parseFloat(row.z) || null;   // 最新成交價
  const prev   = parseFloat(row.y) || null;   // 昨收
  const chg    = (price && prev) ? price - prev : null;
  const chgPct = (chg && prev)   ? chg / prev : null;

  return {
    id:       row.ch?.replace('.tw', ''),
    name:     row.n,
    price,
    prev,
    open:     parseFloat(row.o) || null,
    high:     parseFloat(row.h) || null,
    low:      parseFloat(row.l) || null,
    limitUp:  parseFloat(row.u) || null,   // 漲停價
    limitDown:parseFloat(row.w) || null,   // 跌停價
    volume:   parseInt(row.v)   || 0,
    chg,
    chgPct,
    time:     row.t,
    date:     row.d,
    // 五檔
    askPrices: row.a ? row.a.split('_').map(Number) : [],
    bidPrices: row.b ? row.b.split('_').map(Number) : [],
    askVols:   row.f ? row.f.split('_').map(Number) : [],
    bidVols:   row.g ? row.g.split('_').map(Number) : [],
  };
}
```

### 盤中輪詢（每 5 秒）
```javascript
let misTimer = null;

function startMISPolling(stockIds, onUpdate) {
  async function poll() {
    if (!isTradingHours()) return;
    const rows = await fetchMISPrice(stockIds);
    rows.forEach(row => onUpdate(parseMISRow(row)));
  }
  poll(); // 立即執行一次
  misTimer = setInterval(poll, 5000);
}

function stopMISPolling() {
  if (misTimer) clearInterval(misTimer);
  misTimer = null;
}

function isTradingHours() {
  const now = new Date();
  const day = now.getDay(); // 0=日, 6=六
  if (day === 0 || day === 6) return false;
  const h = now.getHours(), m = now.getMinutes();
  const mins = h * 60 + m;
  return mins >= 9 * 60 && mins <= 13 * 60 + 30;
}
```

---

## 注意事項

1. **盤後行為**：收盤後 `z` 欄位仍有值（最後成交價），但 `t` 不再更新
2. **未成交**：若個股尚未成交，`z` 可能為 `-`（字串），解析前要檢查
3. **CORS**：瀏覽器直接 fetch 可能被擋，需在 `headers` 加 `Referer: https://mis.twse.com.tw/`；若仍被擋，走 Vercel proxy
4. **漲跌停判斷**：`z === u` → 漲停鎖死；`z === w` → 跌停鎖死
5. **上櫃股**：前綴改 `otc_`，其他欄位結構相同
6. **同時抓上市+上櫃**：`ex_ch=tse_2330.tw|otc_6669.tw` 可以混合

---

## AlphaScope 使用位置

- `js/watchlist.js`：自選股即時報價輪詢
- `js/stock_modal.js`：個股 Modal 盤中即時價格更新
- 未來可加：盤中熱圖即時更新（`js/heatmap.js`）
