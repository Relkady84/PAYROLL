/**
 * PWA wiring — registers the service worker, captures the install prompt,
 * and shows a friendly "update available" toast when a new version is ready.
 *
 * Self-registers on import. Just `import './pwa.js'` from main.js.
 */

const SW_PATH = '/service-worker.js';

let _deferredPrompt = null;

// Skip SW in dev if ?nosw query param is present (debug escape valve)
function shouldRegister() {
  if (!('serviceWorker' in navigator)) return false;
  const params = new URLSearchParams(location.search);
  if (params.has('nosw')) return false;
  return true;
}

/** Register the service worker after the page loads (don't block initial render). */
function registerSW() {
  if (!shouldRegister()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_PATH)
      .then(reg => {
        // Listen for new versions arriving
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(newWorker);
            }
          });
        });

        // Check for updates AGGRESSIVELY:
        //  - Every time the page becomes visible (user reopens app)
        //  - Every 60 seconds while the app is open
        //  - Right after registration
        const checkForUpdates = () => reg.update().catch(() => {});
        checkForUpdates();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdates();
        });
        setInterval(checkForUpdates, 60_000);
      })
      .catch(err => console.warn('[PWA] SW registration failed:', err));

    // When the new SW takes control, reload to ensure we're running the new code.
    // Triggered after the user clicks "Update" → SKIP_WAITING message → activate.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      // Append a cache-busting query param so the browser HTTP cache is bypassed
      // on the immediate post-update reload (the browser sometimes still serves
      // stale files even after SW activation).
      const url = new URL(window.location.href);
      url.searchParams.set('_t', Date.now().toString());
      window.location.replace(url.href);
    });
  });
}

/** Show a small persistent toast inviting the user to apply the new version. */
function showUpdateToast(worker) {
  // Avoid duplicates
  if (document.getElementById('pwa-update-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'pwa-update-toast';
  toast.style.cssText = `
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    background: #1e293b; color: #fff; padding: 10px 14px; border-radius: 10px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25); z-index: 99999;
    display: flex; align-items: center; gap: 10px; font-size: 0.85rem;
    font-family: inherit; max-width: 92vw;
  `;
  toast.innerHTML = `
    <span>🔄 Update available</span>
    <button id="pwa-update-apply" style="
      background:#2563eb; color:#fff; border:none; padding:6px 12px;
      border-radius:7px; font-size:0.8rem; font-weight:600; cursor:pointer;
      font-family:inherit;">Reload</button>
    <button id="pwa-update-dismiss" style="
      background:transparent; color:#94a3b8; border:none; padding:4px 8px;
      cursor:pointer; font-size:0.8rem; font-family:inherit;">Later</button>
  `;
  document.body.appendChild(toast);

  document.getElementById('pwa-update-apply').addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange listener will reload the page
  });
  document.getElementById('pwa-update-dismiss').addEventListener('click', () => {
    toast.remove();
  });
}

/** Capture install prompt + show our own button when available. */
function setupInstallPrompt() {
  // Hide the install button if we're already running standalone (installed)
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return;
  }
  // iOS Safari uses navigator.standalone
  if (window.navigator.standalone === true) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();          // suppress the default mini-infobar
    _deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallButton();
    _deferredPrompt = null;
  });
}

function showInstallButton() {
  let btn = document.getElementById('pwa-install-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.textContent = '📥 Install app';
    btn.style.cssText = `
      position: fixed; bottom: 16px; right: 16px;
      background: #2563eb; color: #fff; border: none;
      padding: 10px 16px; border-radius: 999px;
      box-shadow: 0 4px 14px rgba(37,99,235,0.4);
      font-size: 0.85rem; font-weight: 600; cursor: pointer;
      font-family: inherit; z-index: 9990;
      display: flex; align-items: center; gap: 6px;
    `;
    document.body.appendChild(btn);
  }
  btn.style.display = 'flex';
  btn.onclick = async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    if (outcome === 'accepted') hideInstallButton();
  };
}

function hideInstallButton() {
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'none';
}

// ── Self-init ─────────────────────────────────────────────
registerSW();
setupInstallPrompt();
