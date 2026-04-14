// .github/scripts/test_twse_api.js - Round 3: 找三大法人正確路徑

async function testEndpoint(name, url) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) { console.log(`❌ ${name}: HTTP ${r.status}`); return null; }
    const text = await r.text();
    if (text.trim().startsWith('<')) { console.log(`❌ ${name}: HTML response`); return null; }
    const data = JSON.parse(text);
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`✅ ${name}: ${count} 筆`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   欄位: ${Object.keys(data[0]).join(', ')}`);
      const preview = Object.entries(data[0]).slice(0,3).map(([k,v])=>`${k}=${v}`).join(', ');
      console.log(`   範例: ${preview}`);
    }
    return data;
  } catch(e) { console.log(`❌ ${name}: ${e.message}`); return null; }
}

async function main() {
  const B = 'https://openapi.twse.com.tw/v1';

  console.log('【三大法人現貨 - 尋找正確路徑】');
  await testEndpoint('fund/BFIAUU',                   `${B}/fund/BFIAUU`);
  await testEndpoint('fund/BFIAUU2',                  `${B}/fund/BFIAUU2`);
  await testEndpoint('fund/SMFUND',                   `${B}/fund/SMFUND`);
  await testEndpoint('exchangeReport/BHUNT1',         `${B}/exchangeReport/BHUNT1`);
  await testEndpoint('exchangeReport/BFIAUU',         `${B}/exchangeReport/BFIAUU`);
  await testEndpoint('opendata/t187ap05_L',           `${B}/opendata/t187ap05_L`);
  await testEndpoint('opendata/t187ap07_L',           `${B}/opendata/t187ap07_L`);
  await testEndpoint('opendata/t187ap08_L',           `${B}/opendata/t187ap08_L`);
  await testEndpoint('opendata/t187ap12_L',           `${B}/opendata/t187ap12_L`);
  await testEndpoint('opendata/t187ap26_L',           `${B}/opendata/t187ap26_L`);
  console.log();

  console.log('【整體大盤三大法人買賣超】');
  await testEndpoint('fund/TWT84U',                   `${B}/fund/TWT84U`);
  await testEndpoint('fund/TWT44U',                   `${B}/fund/TWT44U`);
  await testEndpoint('exchangeReport/BWIBBU',         `${B}/exchangeReport/BWIBBU`);
  await testEndpoint('exchangeReport/TWTAUU',         `${B}/exchangeReport/TWTAUU`);
  await testEndpoint('opendata/t187ap22_L',           `${B}/opendata/t187ap22_L`);
  await testEndpoint('opendata/t187ap23_L',           `${B}/opendata/t187ap23_L`);
  console.log();

  console.log('【確認好用的 - 看欄位細節】');
  const margn = await testEndpoint('MI_MARGN 完整欄位',  `${B}/exchangeReport/MI_MARGN`);
  if (margn && margn.length > 0) {
    // 算整體融資餘額（加總）
    let totalMarginBal = 0, totalShortBal = 0;
    margn.forEach(r => {
      totalMarginBal += parseInt(r['融資今日餘額']?.replace(/,/g,'') || 0);
      totalShortBal  += parseInt(r['融券今日餘額']?.replace(/,/g,'') || 0);
    });
    console.log(`   → 整體融資今日餘額合計: ${totalMarginBal.toLocaleString()} 張`);
    console.log(`   → 整體融券今日餘額合計: ${totalShortBal.toLocaleString()} 張`);
  }
}

main();
