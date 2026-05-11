/**
 * App-mode detection.
 *
 * Same code, two front doors:
 *  - "admin"  → full admin / owner experience (default)
 *  - "portal" → employee-only experience
 *
 * Detection priority (first match wins):
 *  1. Hostname  starts with "portal."   → portal
 *  2. URL path  starts with "/portal"    → portal
 *  3. Query     ?mode=portal             → portal
 *  4. Default                            → admin
 *
 * Anything else (`payroll.*` subdomain, default `*.web.app`, root path) → admin.
 *
 * This lets you test the split TODAY via /?mode=portal, then migrate to a real
 * subdomain (portal.lycee-montaigne.edu.lb) later without any code change —
 * Firebase Hosting will serve the same app, the JS will pick portal mode.
 */

function detectMode() {
  try {
    const host  = (window.location.hostname || '').toLowerCase();
    const path  = (window.location.pathname || '').toLowerCase();
    const qs    = new URLSearchParams(window.location.search || '');

    if (host.startsWith('portal.') || host.startsWith('portal-')) return 'portal';
    if (path === '/portal' || path.startsWith('/portal/'))         return 'portal';
    if ((qs.get('mode') || '').toLowerCase() === 'portal')         return 'portal';
  } catch (e) { /* ignore — fall through to admin */ }
  return 'admin';
}

export const APP_MODE = detectMode();
export const IS_PORTAL_MODE = APP_MODE === 'portal';
export const IS_ADMIN_MODE  = APP_MODE === 'admin';

// Apply a body class so CSS can react if needed
try {
  document.body.classList.add(`app-mode-${APP_MODE}`);
} catch {}

// Console hint so you can confirm in DevTools
try { console.info(`[Payroll] Running in ${APP_MODE} mode`); } catch {}
