// ── Supabase ──
const SUPABASE_URL  = 'https://fdxedcwtmlurumfjmlys.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BAaZB86ibYZSvTFkFGkeQA_GspDNdf0';

async function sbFetch(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

// ── API base URL（本地開發自動用相對路徑）──
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api/news'
  : 'https://alphascope-fin.vercel.app/api/news';

// ── 共用全域狀態 ──
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
let allArticles    = [];
let _giftsData     = null;
let _giftCat       = '';
let _giftSort      = 'deadline';
let displayedCount = 0;
const PAGE_SIZE    = 50;
let currentLang    = 'zh';
let currentCat     = 'general';
let futuresData    = [];
let futuresSortKey = 'chgPct';
