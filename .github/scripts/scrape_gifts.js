'use strict';
// ═══════════════════════════════════════════════════════════════════════
// scrape_gifts.js — 股東紀念品自動爬蟲（進度追蹤版）
// 部署路徑：.github/scripts/scrape_gifts.js
//
// 架構：
//  gift_scrape_log  → 記錄每支股票的查詢狀態（found/not_found/no_pdf/…）
//  shareholder_gifts → 只存有紀念品的股票
//
// 每次執行只處理「本年度尚未查過」的股票，自然分批，全部查完自動停止
// BATCH_SIZE 控制每次最多處理幾支（預設 100）
//
// 所需 Secrets：SUPABASE_URL、SUPABASE_SERVICE_KEY、GROQ_API_KEY
// 所需 npm：pdf-parse
// ═══════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GROQ_KEY     = process.env.GROQ_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
  console.error('❌ 缺少環境變數：SUPABASE_URL / SUPABASE_SERVICE_KEY / GROQ_API_KEY');
  process.exit(1);
}

// ── 常數 ───────────────────────────────────────────────────────────────
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const GROQ_GAP_MS   = 8000;
const MOPS_DELAY_MS = 1200;
const PDF_TIMEOUT   = 20000;
const MIN_TEXT_LEN  = 200;
const BATCH_SIZE    = parseInt(process.env.BATCH_SIZE || '100');

const NOW_TW   = new Date(Date.now() + 8 * 3_600_000);
const ROC_YEAR = NOW_TW.getUTCFullYear() - 1911;
const AD_YEAR  = NOW_TW.getUTCFullYear();

const GIFT_KEYWORDS = /紀念品|禮品|贈品|禮盒|禮物|禮券|購物金|儲值|折抵|股東會紀念/;

// ── 工具 ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(opts.timeout || 15000), ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.slice(0, 80)}`);
  return r.json();
}

// ── Supabase helpers ───────────────────────────────────────────────────
const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function sbGet(table, qs) {
  return fetchJSON(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: SB_HEADERS });
}

async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: `resolution=merge-duplicates,return=minimal` },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`sbUpsert ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// 寫入進度紀錄（無論成功失敗都要寫）
async function logProgress(stockId, stockName, status) {
  await sbUpsert('gift_scrape_log', [{
    stock_id:   stockId,
    stock_name: stockName,
    year:       AD_YEAR,
    status,
    checked_at: new Date().toISOString(),
  }]);
}

// ── Groq ───────────────────────────────────────────────────────────────
async function groqParse(text, stockId, stockName) {
  const prompt = `你是台灣股東會議事手冊解析助手，請從以下文字中提取「股東紀念品」資訊。

規則：
1. 只回傳 JSON，不加任何說明
2. 找不到紀念品時回傳 {"found":false}
3. 日期統一 YYYY-MM-DD（西元年）
4. share_required 單位為「股」（1張=1000股）

欄位：
{
  "found": true,
  "gift_desc": "完整禮品描述",
  "gift_category": "food|goods|voucher|cash|3c|other",
  "gift_value_est": 估值整數（元，無法確定填0）,
  "share_required": 最低持股整數（股）,
  "record_date": "YYYY-MM-DD",
  "meeting_date": "YYYY-MM-DD",
  "note": null
}

類別：food=食品飲料, goods=日用品, voucher=禮券儲值, cash=現金等值, 3c=電子, other=其他

公司：${stockName}（${stockId}）
---
${text.slice(0, 4000)}
---`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL, max_tokens: 512, temperature: 0.1,
      messages: [
        { role: 'system', content: '只回傳 JSON，不附加任何說明文字。' },
        { role: 'user',   content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const data = await r.json();
  const raw  = data.choices?.[0]?.message?.content?.trim() || '{}';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── 日期格式標準化（民國年 → 西元年）────────────────────────────────────
function sanitizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (m1) return `${+m1[1]+1911}-${m1[2].padStart(2,'0')}-${m1[3].padStart(2,'0')}`;
  const m2 = s.match(/^(\d{3})(\d{2})(\d{2})$/);
  if (m2) return `${+m2[1]+1911}-${m2[2]}-${m2[3]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const y = +s.slice(0,4);
    return (y >= 2020 && y <= AD_YEAR + 2) ? s : null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1：MOPS opendata → 本年度所有有股東會的公司
// 優先 mopsfin.twse.com.tw CSV，fallback 舊 mops.twse.com.tw JSON
// ═══════════════════════════════════════════════════════════════════════

// CSV 解析（處理 MOPS quoted CSV 格式）
function parseMopsCsv(txt) {
  const lines = txt.trim().split('\n');
  if (lines.length < 2) return [];
  const hdrs = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/"/g,'').trim());
  return lines.slice(1).map(l => {
    const v = l.split(',').map(c => c.replace(/"/g,'').trim());
    return Object.fromEntries(hdrs.map((h,i) => [h, v[i]||'']));
  });
}

async function fetchAllMeetingCompanies() {
  const map = {};   // { stockId: { name, meetingDate, recordDate } }

  const SOURCES = [
    // ① 新域名 mopsfin（CSV 格式）
    { label: '上市(mopsfin)', url: 'https://mopsfin.twse.com.tw/opendata/t187ap01_L.csv', fmt: 'csv' },
    { label: '上櫃(mopsfin)', url: 'https://mopsfin.twse.com.tw/opendata/t187ap01_O.csv', fmt: 'csv' },
    // ② 舊域名 fallback
    { label: '上市(mops)',    url: 'https://mops.twse.com.tw/opendata/t187ap01_L',         fmt: 'json' },
    { label: '上櫃(mops)',    url: 'https://mops.twse.com.tw/opendata/t187ap01_O',         fmt: 'json' },
  ];

  let gotData = false;
  for (const { label, url, fmt } of SOURCES) {
    if (gotData && url.includes('mops.twse.com.tw/opendata')) continue;
    try {
      console.log(`  → ${label}…`);
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphaScope/1.0)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) { console.warn(`  ⚠️  ${label} HTTP ${r.status}`); continue; }
      const txt = await r.text();
      if (!txt || txt.length < 100) { console.warn(`  ⚠️  ${label} 回應過短`); continue; }

      let rows = [];
      if (fmt === 'csv') {
        rows = parseMopsCsv(txt);
      } else {
        try { rows = JSON.parse(txt); } catch { rows = parseMopsCsv(txt); }
      }

      let added = 0;
      for (const row of rows) {
        const id = row['公司代號'] || row['companyCode'] || '';
        if (!id || !/^\d{4,6}$/.test(id)) continue;
        if (!map[id]) {
          map[id] = {
            name:        row['公司名稱'] || row['company_name'] || '',
            meetingDate: row['股東會日期'] || row['meeting_date'] || '',
            recordDate:  row['停止過戶日期'] || row['record_date'] || '',
          };
          added++;
        }
      }
      console.log(`  ✅ ${label}：新增 ${added} 家，累計 ${Object.keys(map).length} 家`);
      if (added > 0) gotData = true;
    } catch(e) {
      console.warn(`  ⚠️  ${label} 失敗：${e.message}`);
    }
    await sleep(MOPS_DELAY_MS);
  }

  // ③ 最終 fallback：t187ap39 股利表（含股東會日期）
  if (Object.keys(map).length === 0) {
    console.log('  → 主要來源全失敗，嘗試 t187ap39 股利表…');
    for (const [label, url] of [
      ['上市(股利表)', 'https://mopsfin.twse.com.tw/opendata/t187ap39_L.csv'],
      ['上櫃(股利表)', 'https://mopsfin.twse.com.tw/opendata/t187ap39_O.csv'],
    ]) {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphaScope/1.0)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) { console.warn(`  ⚠️  ${label} HTTP ${r.status}`); continue; }
        const rows = parseMopsCsv(await r.text());
        let added = 0;
        for (const row of rows) {
          const id = row['公司代號'] || '';
          if (!id || !/^\d{4,6}$/.test(id)) continue;
          const mdFull = sanitizeDate(row['股東會日期'] || '');
          if (!mdFull || !mdFull.startsWith(String(AD_YEAR))) continue;
          if (!map[id]) { map[id] = { name: row['公司名稱']||'', meetingDate: row['股東會日期']||'', recordDate: '' }; added++; }
        }
        console.log(`  ✅ ${label}：新增 ${added} 家，累計 ${Object.keys(map).length} 家`);
      } catch(e) { console.warn(`  ⚠️  ${label} 失敗：${e.message}`); }
      await sleep(MOPS_DELAY_MS);
    }
  }

  return map;
}
// ═══════════════════════════════════════════════════════════════════════
// Phase 2：查本年度已處理的股票（任何 status 都算）
// ═══════════════════════════════════════════════════════════════════════
async function fetchCheckedIds() {
  try {
    const rows = await sbGet('gift_scrape_log', `year=eq.${AD_YEAR}&select=stock_id,status`);
    const map  = {};
    rows.forEach(r => { map[r.stock_id] = r.status; });
    return map;
  } catch(e) {
    console.warn(`  ⚠️  無法讀取 gift_scrape_log（${e.message}），視為全部未處理`);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 3：查詢議事手冊 PDF 連結
// ═══════════════════════════════════════════════════════════════════════
async function fetchHandbookUrl(stockId) {
  const base = 'https://mops.twse.com.tw/mops/web/t05sr07_1';
  for (const TYPEK of ['sii', 'otc']) {
    try {
      const body = new URLSearchParams({
        encodeURIComponent: 'encodeURIComponent',
        step: '1', TYPEK, year: String(ROC_YEAR), co_id: stockId, ANNOUNCE_TYPE: 'a',
      });
      const r = await fetch(base, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; AlphaScope/1.0)',
          Referer: 'https://mops.twse.com.tw/mops/web/index',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      for (const pat of [
        /pdfForm\('([^']+\.pdf)'/i,
        /FILE_NAME=([^&"'\s]+\.pdf)/i,
      ]) {
        const m = html.match(pat);
        if (m) return `https://doc.twse.com.tw/server-java/t57sb01?id=&key=&FILE_NAME=${encodeURIComponent(decodeURIComponent(m[1]))}&ANNOUNCE_TYPE=A`;
      }
    } catch(e) { /* try next TYPEK */ }
    await sleep(500);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 4：下載 PDF → 抽文字（只解析前 10 頁）
// ═══════════════════════════════════════════════════════════════════════
async function extractPdfText(pdfUrl) {
  const pdfParse = require('pdf-parse');
  const r = await fetch(pdfUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphaScope/1.0)' },
    signal: AbortSignal.timeout(PDF_TIMEOUT),
  });
  if (!r.ok) throw new Error(`PDF HTTP ${r.status}`);
  const buf  = Buffer.from(await r.arrayBuffer());
  const data = await pdfParse(buf, { max: 10 });
  return data.text || '';
}

// ═══════════════════════════════════════════════════════════════════════
// 主程式
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`🎁 股東紀念品爬蟲  ${AD_YEAR}（民國 ${ROC_YEAR}）  BATCH=${BATCH_SIZE}`);
  console.log(`${'═'.repeat(64)}\n`);

  // ── Phase 1：取得 MOPS 今年所有有股東會的公司 ──────────────────────────
  console.log('📋 Phase 1：MOPS opendata 全公司清單…');
  const allCompanies = await fetchAllMeetingCompanies();
  const totalCompanies = Object.keys(allCompanies).length;
  console.log(`  → 今年有股東會：${totalCompanies} 家\n`);

  if (!totalCompanies) {
    console.warn('  ⚠️  MOPS 清單為空，可能 API 格式變更。建議手動確認後重跑。');
    process.exit(0);
  }

  // ── Phase 2：查已處理的股票 ────────────────────────────────────────────
  console.log('🔍 Phase 2：查詢本年度已處理進度…');
  const checkedMap  = await fetchCheckedIds();
  const checkedIds  = Object.keys(checkedMap);
  const foundCount  = checkedIds.filter(id => checkedMap[id] === 'found').length;
  const pendingIds  = Object.keys(allCompanies).filter(id => !checkedMap[id]);

  console.log(`  已處理：${checkedIds.length} 家（其中有紀念品：${foundCount} 家）`);
  console.log(`  待處理：${pendingIds.length} 家`);

  if (!pendingIds.length) {
    console.log('\n🎉 本年度所有公司均已查完！');
    printSummaryStats(checkedMap);
    process.exit(0);
  }

  // ── 取本批次 ─────────────────────────────────────────────────────────
  const batch = pendingIds.slice(0, BATCH_SIZE);
  const remaining = pendingIds.length - batch.length;
  console.log(`\n  本批次：${batch.length} 家  處理後剩餘：${remaining} 家\n`);

  // ── Phase 3-6：逐一處理 ───────────────────────────────────────────────
  const tally = { found: 0, not_found: 0, no_pdf: 0, scanned_pdf: 0, error: 0 };

  for (let i = 0; i < batch.length; i++) {
    const stockId = batch[i];
    const meta    = allCompanies[stockId];
    process.stdout.write(`[${i+1}/${batch.length}] ${stockId} ${meta.name.padEnd(8,' ')} `);

    // Phase 3a：找 PDF 連結
    await sleep(MOPS_DELAY_MS);
    const pdfUrl = await fetchHandbookUrl(stockId);
    if (!pdfUrl) {
      console.log(`→ 無議事手冊 PDF`);
      await logProgress(stockId, meta.name, 'no_pdf');
      tally.no_pdf++;
      continue;
    }

    // Phase 3b：下載解析 PDF
    let text = '';
    try {
      text = await extractPdfText(pdfUrl);
    } catch(e) {
      console.log(`→ PDF 失敗：${e.message.slice(0,40)}`);
      await logProgress(stockId, meta.name, 'error');
      tally.error++;
      continue;
    }
    if (text.length < MIN_TEXT_LEN) {
      console.log(`→ 掃描版 PDF（${text.length}字）`);
      await logProgress(stockId, meta.name, 'scanned_pdf');
      tally.scanned_pdf++;
      continue;
    }

    // Phase 3c：關鍵字快篩（避免無謂的 Groq 呼叫）
    if (!GIFT_KEYWORDS.test(text)) {
      console.log(`→ 無紀念品關鍵字`);
      await logProgress(stockId, meta.name, 'not_found');
      tally.not_found++;
      continue;
    }

    // Phase 4：Groq AI 解析
    process.stdout.write(`→ 🔍 Groq 解析中… `);
    await sleep(GROQ_GAP_MS);
    let parsed;
    try {
      parsed = await groqParse(text, stockId, meta.name);
    } catch(e) {
      console.log(`❌ ${e.message.slice(0,40)}`);
      await logProgress(stockId, meta.name, 'error');
      tally.error++;
      continue;
    }

    if (!parsed?.found) {
      console.log(`→ AI 確認無紀念品`);
      await logProgress(stockId, meta.name, 'not_found');
      tally.not_found++;
      continue;
    }

    // Phase 5：Supabase 寫入
    const rd = sanitizeDate(parsed.record_date  || meta.recordDate);
    const md = sanitizeDate(parsed.meeting_date || meta.meetingDate);
    if (!rd) {
      console.log(`→ ⚠️  日期無效，略過`);
      await logProgress(stockId, meta.name, 'error');
      tally.error++;
      continue;
    }

    const shareReq = parseInt(parsed.share_required) || 1000;
    const valEst   = parseInt(parsed.gift_value_est) || 0;

    try {
      await sbUpsert('shareholder_gifts', [{
        stock_id: stockId, stock_name: meta.name,
        record_date: rd, meeting_date: md,
        gift_desc: parsed.gift_desc || '',
        gift_category: parsed.gift_category || 'other',
        gift_value_est: valEst, share_required: shareReq,
        source_url: pdfUrl, note: parsed.note || null,
        year: AD_YEAR, updated_at: new Date().toISOString(),
      }]);
      await logProgress(stockId, meta.name, 'found');
      console.log(`→ 🎁 ${(parsed.gift_desc||'').slice(0,30)}  NT$${valEst}`);
      tally.found++;
    } catch(e) {
      console.log(`→ DB 寫入失敗：${e.message.slice(0,40)}`);
      await logProgress(stockId, meta.name, 'error');
      tally.error++;
    }
  }

  // ── 最終報告 ──────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`本批結果：🎁 ${tally.found}  ✗ ${tally.not_found}  📄 ${tally.no_pdf}  🖼 ${tally.scanned_pdf}  ❌ ${tally.error}`);
  console.log(`進度：${checkedIds.length + batch.length} / ${totalCompanies}  剩餘：${remaining} 家`);
  if (remaining > 0) console.log(`⏳ 下次執行將繼續處理剩餘 ${remaining} 家`);
  else               console.log(`🎉 全部公司已查完！`);
  console.log(`${'═'.repeat(64)}\n`);

  // 寫入 GitHub Actions Step Summary（若在 CI 中執行）
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const { appendFileSync } = require('fs');
    appendFileSync(summaryFile, [
      `## 🎁 本批次結果`,
      `| 項目 | 數量 |`,
      `|------|------|`,
      `| 🎁 找到紀念品 | ${tally.found} |`,
      `| ✗ 確認無紀念品 | ${tally.not_found} |`,
      `| 📄 找不到 PDF | ${tally.no_pdf} |`,
      `| 🖼 掃描版 PDF | ${tally.scanned_pdf} |`,
      `| ❌ 錯誤 | ${tally.error} |`,
      `| ⏳ 剩餘未處理 | ${remaining} |`,
      `| 📊 總進度 | ${checkedIds.length + batch.length} / ${totalCompanies} |`,
    ].join('\n') + '\n');
  }
}

function printSummaryStats(checkedMap) {
  const statuses = Object.values(checkedMap);
  const count = s => statuses.filter(x => x === s).length;
  console.log(`\n  本年度統計：`);
  console.log(`    🎁 有紀念品：${count('found')}`);
  console.log(`    ✗ 無紀念品：${count('not_found')}`);
  console.log(`    📄 無 PDF：${count('no_pdf')}`);
  console.log(`    🖼 掃描版：${count('scanned_pdf')}`);
  console.log(`    ❌ 錯誤：${count('error')}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
