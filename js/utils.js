// ── Service Worker 註冊 ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('[SW] 已註冊，scope:', reg.scope))
      .catch(err => console.warn('[SW] 註冊失敗:', err));
  });
}

// ── PWA 安裝提示 ──
(function() {
  if (localStorage.getItem('pwaPromptDismissed')) return;

  // Android Chrome：beforeinstallprompt 事件
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwaAndroidBanner').style.display = 'block';
  });

  document.getElementById('pwaAndroidInstall').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') localStorage.setItem('pwaPromptDismissed', '1');
      document.getElementById('pwaAndroidBanner').style.display = 'none';
      deferredPrompt = null;
    });
  });

  // iOS Safari：不支援 beforeinstallprompt，手動偵測
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.navigator.standalone === true;
  if (isIOS && !isInStandaloneMode) {
    // 延遲 3 秒顯示，避免打擾初始載入
    setTimeout(() => {
      document.getElementById('pwaInstallBanner').style.display = 'block';
    }, 3000);
  }
})();
