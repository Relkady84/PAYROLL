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

/**
 * Hostname → Firestore companyId map.
 *
 * Each entry locks a branded URL to a specific tenant. When a super admin
 * visits one of these hostnames, they skip the company picker and land
 * directly in that company's app. When an owner of company A tries to
 * visit company B's branded URL, they see a "wrong app" notice.
 *
 * Add a new line per school as you onboard them.
 */
const HOSTNAME_COMPANY_MAP = {
  // Lycée Montaigne (Lebanon)
  'portal.lycee-montaigne.edu.lb':  'RQBKHGV5_1776006868157',
  'payroll.lycee-montaigne.edu.lb': 'RQBKHGV5_1776006868157',
};

/**
 * Returns the companyId this hostname is locked to, or null if the
 * hostname is the generic (e.g., payroll-10a48.web.app) entry point.
 */
export function getScopedCompanyId() {
  try {
    const host = (window.location.hostname || '').toLowerCase();
    return HOSTNAME_COMPANY_MAP[host] || null;
  } catch { return null; }
}

export const SCOPED_COMPANY_ID = getScopedCompanyId();
export const IS_SCOPED_URL    = !!SCOPED_COMPANY_ID;

/**
 * companyId → preferred admin URL (origin only, no trailing slash).
 *
 * When an owner signs in at the generic URL (payroll-10a48.web.app), the auth
 * flow redirects them to their company's branded admin URL so the URL bar
 * always reflects which company is loaded. One line per school.
 *
 * If a company has no branded URL configured here, no redirect happens — the
 * owner stays on whatever URL they signed in at.
 */
const COMPANY_ADMIN_URL = {
  'RQBKHGV5_1776006868157': 'https://payroll.lycee-montaigne.edu.lb',
};

export function getCompanyAdminURL(companyId) {
  return COMPANY_ADMIN_URL[companyId] || null;
}

// Apply a body class so CSS can react if needed
try {
  document.body.classList.add(`app-mode-${APP_MODE}`);
} catch {}

// Console hint so you can confirm in DevTools
try { console.info(`[Payroll] Running in ${APP_MODE} mode`); } catch {}
