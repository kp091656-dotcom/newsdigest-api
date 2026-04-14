// .github/scripts/test_twse_api.js
// 測試 TWSE OpenAPI 從 GitHub Actions 能否打通
// 執行：node .github/scripts/test_twse_api.js

async function testTWSE() {
  console.log('測試 TWSE OpenAPI...');
  console.log(`執行環境 IP 測試中...\n`);

  const endpoints = [
    {
      name: '上市個股每日成交（STOCK_DAY_ALL）',
      url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    },
    {
      name: '各類指數日成交（MI_INDEX）',
      url: 'https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX',
    },
    {
      name: '三大法人買賣超（BFIAMU）',
      url: 'https://openapi.twse.com.tw/v1/fund/BFIAMU',
    },
    {
      name: '融資融券（MARGIN_TRADING_SUMMARY）',
      url: 'https://openapi.twse.com.tw/v1/exchangeReport/MARGIN_TRADING_SUMMARY',
    },
  ];

  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(ep.url, {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
      if (!r.ok) {
        console.log(`❌ ${ep.name}: HTTP ${r.status}`);
        continue;
      }
      const data = await r.json();
      const count = Array.isArray(data) ? data.length : Object.keys(data).length;
      console.log(`✅ ${ep.name}: ${count} 筆資料`);

      // 印出第一筆看欄位
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        console.log(`   欄位: ${Object.keys(first).join(', ')}`);

        // 如果是股價資料，找幾支熱圖股票
        if (first.Code || first.StockID) {
          const key = first.Code ? 'Code' : 'StockID';
          const targets = ['2330', '2454', '2317', '2881', '2412'];
          const found = data.filter(d => targets.includes(d[key]));
          found.forEach(s => console.log(`   ${s[key]} ${s.Name || s.StockName}: 收盤=${s.ClosingPrice || s.Close}`));
        }
      }
    } catch(e) {
      console.log(`❌ ${ep.name}: ${e.message}`);
    }
    console.log();
  }
}

testTWSE();
