/**
 * AlphaScope PWA Service Worker
 * 策略：靜態資源 Cache First，API 請求 Network First
 */

const CACHE_NAME    = 'alphascope-20260601-111534';
const STATIC_CACHE  = 'alphascope-static-20260601-111534';

// 靜態資源：優先從快取讀取
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/chart.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap',
];

// 安裝：預快取靜態資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 啟動：清除舊版快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 攔截請求
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // TWSE MIS 即時報價：不攔截，讓瀏覽器直接送出（需保留 Referer，SW 會剝除導致 CORS 錯誤）
  if (url.hostname.includes('mis.twse.com.tw')) return;

  // API 請求（Supabase、Vercel API、FinMind）→ Network First，失敗才回傳快取
  const isAPI = url.hostname.includes('supabase.co')
             || url.hostname.includes('alphascope-fin.vercel.app')
             || url.hostname.includes('finmindtrade.com')
             || url.hostname.includes('openapi.twse.com.tw')
             || url.pathname.startsWith('/api/');

  if (isAPI) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 成功時順手存一份到快取（GET only）
          if (e.request.method === 'GET' && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 靜態資源 → Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// 背景同步（未來擴充用）
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
