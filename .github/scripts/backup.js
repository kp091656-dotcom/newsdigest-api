/**
 * AlphaScope — Supabase 每週備份腳本
 * 路徑：.github/scripts/backup.js
 * 執行方式：node .github/scripts/backup.js
 * 依賴：rclone（由 workflow 安裝）
 *
 * 備份邏輯：
 * 1. 從 Supabase 各表匯出 JSON
 * 2. 壓縮成 .gz
 * 3. 上傳到 pCloud /AlphaScope-Backups/YYYY-MM-DD/
 * 4. 保留最近 8 週，刪除更舊的資料夾
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, createWriteStream, existsSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';
import { tmpdir } from 'os';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const TODAY        = new Date().toISOString().slice(0, 10);
const TMP_DIR      = join(tmpdir(), `alphascope-backup-${TODAY}`);
const PCLOUD_DEST  = `pcloud:AlphaScope-Backups/${TODAY}`;

// 備份設定：各表名稱 + 查詢參數
const TABLES = [
  {
    name: 'stock_daily_twse',
    // 只備份最近 365 天（個股數量多，只保留一年）
    params: `select=*&order=date.desc&limit=450000`,
    desc: '個股收盤（365天）',
  },
  {
    name: 'stock_valuation_daily',
    params: `select=*&order=date.desc&limit=390000`,
    desc: '個股估值（365天）',
  },
  {
    name: 'sector_index_daily',
    params: `select=*&order=date.desc&limit=20000`,
    desc: '產業指數（全量）',
  },
  {
    name: 'institutional_daily',
    params: `select=*&order=date.desc`,
    desc: '三大法人（全量）',
  },
  {
    name: 'margin_daily',
    params: `select=*&order=date.desc`,
    desc: '融資融券（全量）',
  },
  {
    name: 'options_daily',
    params: `select=*&order=date.desc`,
    desc: '選擇權（全量）',
  },
  {
    name: 'alpha_daily_report',
    // 只備份最近 180 天的報告
    params: `select=*&order=report_date.desc&limit=180`,
    desc: 'Alpha 報告（180天）',
  },
  {
    name: 'trader_positions',
    params: `select=*&order=opened_at.desc`,
    desc: 'Alpha 持倉（全量）',
  },
];

// ── Supabase 查詢 ──
async function fetchTable(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Range-Unit': 'items',
      'Range': '0-499999', // 最多 50 萬筆
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table} 查詢失敗 HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 主程式 ──
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AlphaScope — 每週 pCloud 備份');
  console.log(`  日期：${TODAY}`);
  console.log(`  目標：${PCLOUD_DEST}`);
  console.log('═══════════════════════════════════════');

  if (!SUPABASE_URL || !SB_KEY) {
    throw new Error('缺少環境變數：SUPABASE_URL 或 SUPABASE_SERVICE_KEY');
  }

  // 建立暫存目錄
  mkdirSync(TMP_DIR, { recursive: true });
  console.log(`\n📁 暫存目錄：${TMP_DIR}`);

  let totalRows = 0;
  let totalSize = 0;
  const results = [];

  // ── 逐表備份 ──
  for (const table of TABLES) {
    process.stdout.write(`\n  📦 ${table.name}（${table.desc}）... `);
    try {
      const data = await fetchTable(table.name, table.params);
      const rows = Array.isArray(data) ? data.length : 0;

      // JSON → gzip 壓縮
      const json    = JSON.stringify(data);
      const gz      = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
      const outPath = join(TMP_DIR, `${table.name}.json.gz`);
      writeFileSync(outPath, gz);

      const kb = (gz.length / 1024).toFixed(1);
      console.log(`${rows} 筆，${kb} KB`);
      totalRows += rows;
      totalSize += gz.length;
      results.push({ table: table.name, rows, kb, ok: true });
    } catch (e) {
      console.log(`❌ 失敗：${e.message}`);
      results.push({ table: table.name, rows: 0, kb: 0, ok: false, error: e.message });
    }
  }

  // ── 寫備份摘要 ──
  const summary = {
    backup_date:  TODAY,
    generated_at: new Date().toISOString(),
    tables:       results,
    total_rows:   totalRows,
    total_size_kb: (totalSize / 1024).toFixed(1),
  };
  writeFileSync(join(TMP_DIR, 'backup_summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\n📊 合計：${totalRows} 筆，${(totalSize / 1024).toFixed(0)} KB`);

  // ── 上傳到 pCloud ──
  console.log(`\n☁️  上傳到 pCloud ${PCLOUD_DEST} ...`);
  try {
    execSync(
      `rclone copy "${TMP_DIR}" "${PCLOUD_DEST}" --progress --transfers 4`,
      { stdio: 'inherit' }
    );
    console.log('  ✅ 上傳完成');
  } catch (e) {
    throw new Error(`rclone 上傳失敗：${e.message}`);
  }

  // ── 清理 8 週以前的備份 ──
  console.log('\n🗑️  清理舊備份（保留最近 8 週）...');
  try {
    // 列出 pCloud 上的備份目錄
    const listOutput = execSync(
      `rclone lsf pcloud:AlphaScope-Backups/ --dirs-only`,
      { encoding: 'utf8' }
    ).trim();

    if (listOutput) {
      const dirs = listOutput.split('\n')
        .map(d => d.replace(/\/$/, '').trim())
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort(); // 舊 → 新

      // 保留最新 8 個（約 8 週）
      const toDelete = dirs.slice(0, Math.max(0, dirs.length - 8));
      for (const dir of toDelete) {
        execSync(`rclone purge "pcloud:AlphaScope-Backups/${dir}"`, { stdio: 'inherit' });
        console.log(`  🗑️  已刪除：${dir}`);
      }
      if (!toDelete.length) console.log('  ✅ 無需清理（備份數 ≤ 8）');
    }
  } catch (e) {
    // 清理失敗不中斷主流程
    console.warn(`  ⚠️  清理舊備份失敗（不影響本次備份）：${e.message}`);
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  ✅ 備份完成！${TODAY}`);
  console.log('  pCloud 路徑：AlphaScope-Backups/' + TODAY);
  console.log('═══════════════════════════════════════');
}

main().catch(e => {
  console.error('\n❌ 備份失敗：', e.message);
  process.exit(1);
});
