// .github/scripts/test_twse_api.js
// 測試 TWSE OpenAPI 從 GitHub Actions 能否打通

async function testEndpoint(name, url) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) {
      console.log(`❌ ${name}: HTTP ${r.status}`);
      return null;
    }
    const text = await r.text();
    if (text.trim().startsWith('<')) {
      console.log(`❌ ${name}: 回傳 HTML，路徑不正確`);
      return null;
    }
    const data = JSON.parse(text);
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`✅ ${name}: ${count} 筆`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   欄位: ${Object.keys(data[0]).join(', ')}`);
      const preview = Object.entries(data[0]).slice(0,3).map(([k,v])=>`${k}=${v}`).join(', ');
      console.log(`   範例: ${preview}`);
    }
    return data;
  } catch(e) {
    console.log(`❌ ${name}: ${e.message}`);
    return null;
  }
}

async function main() {
  const B = 'https://openapi.twse.com.tw/v1';
  console.log('已確認可用:');
  await testEndpoint('個股每日成交 STOCK_DAY_ALL', `${B}/exchangeReport/STOCK_DAY_ALL`);
  await testEndpoint('各類指數 MI_INDEX',          `${B}/exchangeReport/MI_INDEX`);
  console.log('\n三大法人路徑探索:');
  await testEndpoint('fund/BFIAMU',               `${B}/fund/BFIAMU`);
  await testEndpoint('fund/TWT84U',               `${B}/fund/TWT84U`);
  await testEndpoint('opendata/t86',              `${B}/opendata/t86`);
  await testEndpoint('opendata/t187ap09_L',       `${B}/opendata/t187ap09_L`);
  await testEndpoint('exchangeReport/FMTQIK',     `${B}/exchangeReport/FMTQIK`);
  await testEndpoint('exchangeReport/MI_INDEX20', `${B}/exchangeReport/MI_INDEX20`);
  console.log('\n融資融券路徑探索:');
  await testEndpoint('exchangeReport/MI_MARGN',   `${B}/exchangeReport/MI_MARGN`);
  await testEndpoint('opendata/t187ap06_L',       `${B}/opendata/t187ap06_L`);
  await testEndpoint('fund/MI_MARGN',             `${B}/fund/MI_MARGN`);
  console.log('\n額外資料:');
  await testEndpoint('本益比 BWIBBU_ALL',          `${B}/exchangeReport/BWIBBU_ALL`);
  await testEndpoint('成交量 MI_TRADE',            `${B}/exchangeReport/MI_TRADE`);
}

main();
