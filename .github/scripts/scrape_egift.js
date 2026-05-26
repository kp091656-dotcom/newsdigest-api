'use strict';
// ═══════════════════════════════════════════════════════════════════════
// scrape_egift.js — 集保 eGift 公司名單同步腳本
// 部署路徑：.github/scripts/scrape_egift.js
//
// 功能：
//  1. 從集保官網頁面找最新 eGift 公司名單 PDF 連結
//  2. 解析 PDF → 取得 43+ 家公司的代號、名稱、股東會日期
//  3. 比對 TWSE/TPEx API 補齊停止過戶日（record_date）
//  4. Upsert 進 shareholder_gifts（is_egift=true）
//  5. 同步刪除本年度已不在名單內的 is_egift 記錄（公司撤回）
//
// 所需 Secrets：SUPABASE_URL、SUPABASE_SERVICE_KEY
// 所需 npm：pdf-parse
// ═══════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少環境變數：SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ── 常數 ───────────────────────────────────────────────────────────────
const NOW_TW  = new Date(Date.now() + 8 * 3_600_000);
const AD_YEAR = NOW_TW.getUTCFullYear();
const ROC_YEAR = AD_YEAR - 1911;

// 集保 eGift 專區頁面（用來動態找 PDF 最新連結）
const TDCC_EGIFT_PAGE = 'https://www.tdcc.com.tw/portal/zh/page/show/4028c0b49a3498b0019a9519a4b80137';
// 已知最新 PDF 連結（fallback，若頁面爬失敗直接用此）
const KNOWN_PDF_URL   = 'https://m.tdcc.com.tw/TDCCWEB/upload/4028c0b49dd8fc3b019e06e3abe00012.pdf';

const UA = 'Mozilla/5.0 (compatible; AlphaScope-eGift/1.0)';
const SB = {
  get:    (q) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders() }),
  upsert: (t, body, onConflict='') => fetch(`${SUPABASE_URL}/rest/v1/${t}?${onConflict ? 'on_conflict='+onConflict : ''}`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  }),
  patch: (t, q, body) => fetch(`${SUPABASE_URL}/rest/v1/${t}?${q}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  }),
};

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── ROC 日期轉 AD ───────────────────────────────────────────────────────
// 輸入: "115/05/22" 或 "115年5月22日" → "2026-05-22"
function rocToAd(str = '') {
  const m = str.match(/(\d{2,3})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const adY = parseInt(y) + 1911;
  return `${adY}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ── Step 1：從集保頁面動態找最新 PDF 連結 ─────────────────────────────
async function findLatestPdfUrl() {
  try {
    console.log('  → 掃描集保 eGift 頁面找最新 PDF…');
    const r = await fetch(TDCC_EGIFT_PAGE, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // 找所有 m.tdcc.com.tw/TDCCWEB/upload/*.pdf 的連結
    const matches = [...html.matchAll(/https?:\/\/m\.tdcc\.com\.tw\/TDCCWEB\/upload\/[\w]+\.pdf/g)];
    const pdfUrls = [...new Set(matches.map(m => m[0]))];

    // 找含「eGift公司名單」文字附近的連結
    const egiftIdx = html.indexOf('eGift公司名單');
    if (egiftIdx > -1) {
      const nearby = html.slice(Math.max(0, egiftIdx - 50), egiftIdx + 200);
      const nearMatch = nearby.match(/https?:\/\/m\.tdcc\.com\.tw\/TDCCWEB\/upload\/[\w]+\.pdf/);
      if (nearMatch) {
        console.log(`  ✅ 找到最新 PDF：${nearMatch[0]}`);
        return nearMatch[0];
      }
    }

    // 若找不到 eGift 專屬連結，用頁面上第一個 PDF（通常就是名單）
    if (pdfUrls.length > 0) {
      console.log(`  ✅ 使用頁面首個 PDF：${pdfUrls[0]}`);
      return pdfUrls[0];
    }

    throw new Error('頁面無 PDF 連結');
  } catch(e) {
    console.warn(`  ⚠️  動態找 PDF 失敗（${e.message}），使用已知連結`);
    return KNOWN_PDF_URL;
  }
}

// ── Step 2：下載並解析 PDF ─────────────────────────────────────────────
async function fetchAndParsePdf(pdfUrl) {
  console.log(`  → 下載 PDF：${pdfUrl}`);
  const r = await fetch(pdfUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`PDF 下載失敗 HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());

  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(buf);
  return data.text;
}

// ── Step 3：從文字解析公司清單 ────────────────────────────────────────
// PDF 實際格式：代號與名稱在同一行，日期在下一行
// 例：
//   1 1338 廣華-KY
//   115/05/22
function parseEgiftList(text) {
  const companies = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 匹配：序號(可選) 4-5碼代號 公司名稱（剩餘部分）
    const m = line.match(/^(?:\d+\s+)?(\d{4,5})\s+(.+)$/);
    if (m) {
      const code = m[1];
      const name = m[2].replace(/[\*＊]/g, '').trim();
      // 看下一行是否是 ROC 日期
      let meetingDate = null;
      if (i + 1 < lines.length) {
        const dm = lines[i + 1].match(/^(1\d{2})\/(\d{1,2})\/(\d{1,2})$/);
        if (dm) {
          const [, y, mo, d] = dm;
          meetingDate = `${parseInt(y) + 1911}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
          i++;  // 跳過日期行
        }
      }
      // 若日期在同一行也接受（兼容未來格式）
      if (!meetingDate) {
        const inlineDm = line.match(/(1\d{2})\/(\d{1,2})\/(\d{1,2})/);
        if (inlineDm) {
          const [, y, mo, d] = inlineDm;
          meetingDate = `${parseInt(y) + 1911}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
      }
      if (meetingDate && meetingDate.startsWith(String(AD_YEAR)) && code.length >= 4 && code.length <= 6) {
        companies.push({ stock_id: code, stock_name: name, meeting_date: meetingDate });
      }
    }
    i++;
  }

  // 去重（同代號只保留一筆）
  const seen = new Set();
  return companies.filter(c => {
    if (seen.has(c.stock_id)) return false;
    seen.add(c.stock_id);
    return true;
  });
}

// CSV 解析 helper
function parseMopsCsv(txt) {
  const lines = txt.trim().split('\n');
  if (lines.length < 2) return [];
  const hdrs = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/"/g,'').trim());
  return lines.slice(1).map(l => {
    const v = l.split(',').map(c => c.replace(/"/g,'').trim());
    return Object.fromEntries(hdrs.map((h,i) => [h, v[i]||'']));
  });
}

// ── Step 4：從 TWSE/TPEx API 補齊停止過戶日 ──────────────────────────
async function enrichWithRecordDates(companies) {
  console.log('  → 從 TWSE/TPEx API 補齊停止過戶日…');
  // 建立 map 方便查詢
  const map = {};
  companies.forEach(c => { map[c.stock_id] = c; });

  const SOURCES = [
    // 上市：t187ap39_L = 上市公司除權除息暨停止過戶日期（含股東會日期）
    'https://openapi.twse.com.tw/v1/opendata/t187ap39_L',
    // 上櫃：mopsfin CSV（因 TPEx openapi 不穩定）
    'https://mopsfin.twse.com.tw/opendata/t187ap39_O.csv',
  ];

  for (const url of SOURCES) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const txt = await r.text();
      let rows;
      try { rows = JSON.parse(txt); } catch { rows = parseMopsCsv(txt); }
      let patched = 0;
      for (const row of rows) {
        const id = (row['公司代號'] || '').trim();
        if (!map[id]) continue;
        const rd = row['停止過戶起日'] || row['停止過戶日期'] || row['停止轉讓起日'] || row['RecordDate'] || row['record_date'] || '';
        if (rd && !map[id].record_date) {
          map[id].record_date = rocToAd(rd) || rd;
          patched++;
        }
        // 補產業別
        if (!map[id].sector) {
          map[id].sector = (row['產業類別'] || row['industry'] || '').trim() || null;
        }
      }
      console.log(`  ✅ ${url.includes('twse') ? '上市' : '上櫃'}：補齊 ${patched} 筆停止過戶日`);
    } catch(e) {
      console.warn(`  ⚠️  ${e.message}`);
    }
    await sleep(500);
  }

  return Object.values(map);
}

// ── Step 5：Upsert 進 Supabase ─────────────────────────────────────────
async function upsertToSupabase(companies) {
  console.log(`  → Upsert ${companies.length} 筆 eGift 資料到 shareholder_gifts…`);

  const rows = companies.map(c => ({
    stock_id:        c.stock_id,
    stock_name:      c.stock_name,
    sector:          c.sector || null,
    record_date:     c.record_date || c.meeting_date,  // 若無停戶日，暫用股東會日期
    meeting_date:    c.meeting_date || null,
    gift_desc:       'eGift 電子紀念品',
    gift_category:   'voucher',
    is_egift:        true,
    egift_min_share: 1000,
    year:            AD_YEAR,
    updated_at:      new Date().toISOString(),
  }));

  // 分批 upsert（每批 20 筆避免超時）
  let ok = 0;
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const r = await SB.upsert('shareholder_gifts', batch, 'stock_id,year');
    if (r.ok) {
      ok += batch.length;
    } else {
      const err = await r.text();
      console.warn(`  ⚠️  Upsert batch ${i/20+1} 失敗：${err.slice(0,100)}`);
    }
    await sleep(300);
  }
  console.log(`  ✅ Upsert 完成：${ok} / ${rows.length} 筆`);
  return ok;
}

// ── Step 6：把不在名單的 is_egift 記錄改回 false（公司撤回）──────────
async function clearRemovedEgifts(currentIds) {
  console.log('  → 檢查本年度已撤回 eGift 的公司…');
  // 查目前 DB 中所有 is_egift=true 的本年度記錄
  const r = await SB.get(`shareholder_gifts?year=eq.${AD_YEAR}&is_egift=eq.true&select=stock_id`);
  if (!r.ok) { console.warn('  ⚠️  查詢已有 eGift 記錄失敗'); return; }
  const existing = await r.json();

  const currentSet = new Set(currentIds);
  const toRemove = existing.filter(e => !currentSet.has(e.stock_id)).map(e => e.stock_id);

  if (toRemove.length === 0) {
    console.log('  ✅ 無撤回公司');
    return;
  }

  console.log(`  → 標記 ${toRemove.length} 家撤回 eGift：${toRemove.join(', ')}`);
  for (const id of toRemove) {
    await SB.patch('shareholder_gifts', `stock_id=eq.${id}&year=eq.${AD_YEAR}`, { is_egift: false });
    await sleep(200);
  }
  console.log(`  ✅ 已標記 ${toRemove.length} 家撤回`);
}

// ── 主程式 ─────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log(`🎁 eGift 名單同步 ${AD_YEAR}（民國 ${ROC_YEAR}）`);
  console.log(`   執行時間：${NOW_TW.toISOString()}`);
  console.log('═'.repeat(60));

  // 1. 找最新 PDF 連結
  const pdfUrl = await findLatestPdfUrl();

  // 2. 解析 PDF
  let rawText;
  try {
    rawText = await fetchAndParsePdf(pdfUrl);
  } catch(e) {
    console.error(`❌ PDF 解析失敗：${e.message}`);
    process.exit(1);
  }

  // 3. 解析公司清單
  let companies = parseEgiftList(rawText);
  console.log(`\n📋 PDF 解析結果：${companies.length} 家 eGift 公司`);
  if (companies.length === 0) {
    // Debug：印前 500 字
    console.warn('  ⚠️  解析到 0 家，PDF 原文前 500 字：');
    console.warn(rawText.slice(0, 500));
    process.exit(1);
  }
  companies.forEach((c, i) => console.log(`  [${i+1}] ${c.stock_id} ${c.stock_name} 股東會:${c.meeting_date}`));

  // 4. 補齊停止過戶日
  console.log('');
  companies = await enrichWithRecordDates(companies);

  // 5. Upsert
  console.log('');
  const upserted = await upsertToSupabase(companies);

  // 6. 清理撤回
  console.log('');
  await clearRemovedEgifts(companies.map(c => c.stock_id));

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ 完成！共同步 ${upserted} 筆 eGift 公司資料`);
  console.log('═'.repeat(60));
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
