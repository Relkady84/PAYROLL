/**
 * Service Worker — PWA offline support + update flow.
 *
 * Strategies:
 *   - App shell (/, /index.html, /css/*, /js/*, manifest, icons): network-first
 *     with cache fallback. (Updates take effect on first reload; offline still works.)
 *   - CDN libs (jsdelivr, gstatic): stale-while-revalidate
 *   - Firestore / Auth API calls: NETWORK ONLY (Firestore SDK has its own offline cache)
 *
 * Version bump = bump CACHE_VERSION below.
 */

const CACHE_VERSION = 'v15-2026-05-07-notes';
const CACHE_SHELL   = `payroll-shell-${CACHE_VERSION}`;
const CACHE_RUNTIME = `payroll-runtime-${CACHE_VERSION}`;

// Files we want guaranteed-cached on first install for offline-shell loading.
// Note: list only TOP-LEVEL files here. Sub-imports get cached on first use.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/responsive.css',
  '/css/employeePortal.css',
  '/js/main.js',
  '/js/i18n.js',
  '/js/i18n/en.js',
  '/js/i18n/fr.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// ── Install: pre-cache the app shell ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] App shell pre-cache failed:', err))
  );
  // Activate this SW immediately, replacing the old one
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_SHELL && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategies ────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;            // skip non-GET (POST etc.)

  const url = new URL(req.url);

  // 1. Firebase / Google APIs → ALWAYS network (Firestore SDK manages its own cache)
  if (
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('firebaseio.com') ||
    url.hostname.endsWith('firebase.googleapis.com') ||
    url.hostname.endsWith('identitytoolkit.googleapis.com') ||
    url.hostname.endsWith('securetoken.googleapis.com') ||
    url.hostname.endsWith('apis.google.com') ||
    url.hostname.endsWith('accounts.google.com') ||
    url.hostname.endsWith('login.microsoftonline.com')
  ) {
    return; // browser default: go to network, no SW interception
  }

  // 2. Same-origin app shell → cache-first, with background revalidation
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, CACHE_SHELL));
    return;
  }

  // 3. CDN libs (gstatic, jsdelivr) → stale-while-revalidate
  if (
    url.hostname === 'www.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(staleWhileRevalidate(req, CACHE_RUNTIME));
    return;
  }

  // 4. Anything else → network-first with cache fallback
  event.respondWith(networkFirst(req, CACHE_RUNTIME));
});

// ── Strategy implementations ─────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  // Try network first if online (so updates take effect on next reload).
  // Fall back to cache only if network fails (offline support).
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // For navigation requests, fall back to cached index.html
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || networkPromise || fetch(request);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// ── Listen for "skip waiting" message from the page ───────
// Sent by pwa.js when the user clicks "Update available"
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
