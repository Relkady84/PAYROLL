import { init as initRouter, register } from './router.js';
import { initModal }                    from './views/components/modal.js';
import { render as renderDashboard }    from './views/dashboardView.js';
import { render as renderEmployees }    from './views/employeeListView.js';
import { render as renderPayroll }      from './views/payrollView.js';
import { render as renderSettings }     from './views/settingsView.js';
import { render as renderReports }      from './views/reportsView.js';
import { render as renderAbsenceRequests } from './views/absenceRequestsView.js';
import { renderOnboarding }             from './views/onboardingView.js';
import { renderSuperAdmin }             from './views/superAdminView.js';
import { renderEmployeePortal }         from './views/employeePortalView.js';
import { render as renderAnnouncements } from './views/announcementsView.js';
import { _applySidebarLogo, applyDisplayColors } from './views/settingsView.js';
import {
  initStore, setCompanyId,
  getUserRecord, createUserRecord,
  getCompanyMetadata, lookupEmployeeByEmail,
  SUPER_ADMIN_EMAIL,
  startAbsenceRequestsLiveSync, stopAbsenceRequestsLiveSync, onAbsenceRequestsChange,
  getAbsenceRequests,
  startAnnouncementsLiveSync, stopAnnouncementsLiveSync
} from './data/store.js';
import { onAuthChanged, signInWithGoogle, signInWithMicrosoft, signOutUser } from './auth.js';
import { t, getLanguage, setLanguage, SUPPORTED_LANGUAGES, applyTranslationsToDOM } from './i18n.js';
import { APP_MODE, IS_PORTAL_MODE } from './appMode.js';
import './pwa.js';   // self-registers the service worker + install prompt

// Register routes — admin routes are skipped in portal mode so an owner who
// accidentally lands on the portal URL can't navigate into the admin sections.
if (!IS_PORTAL_MODE) {
  register('#dashboard',         () => renderDashboard('#app-content'));
  register('#employees',         () => renderEmployees('#app-content'));
  register('#payroll',           () => renderPayroll('#app-content'));
  register('#settings',          () => renderSettings('#app-content'));
  register('#reports',           () => renderReports('#app-content'));
  register('#absence-requests',  () => renderAbsenceRequests('#app-content'));
  register('#announcements',     () => renderAnnouncements('#app-content'));
}

// ── Sidebar toggle — desktop collapse + mobile overlay ────
function initSidebarToggle() {
  const floatBtn    = document.getElementById('menu-toggle');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const sidebar     = document.getElementById('sidebar');
  const overlay     = document.getElementById('sidebar-overlay');
  if (!floatBtn || !sidebar || !overlay) return;

  // Restore desktop collapsed state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }

  function isMobile() { return window.innerWidth <= 768; }

  collapseBtn?.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    } else {
      document.body.classList.add('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', 'true');
    }
  });

  floatBtn.addEventListener('click', () => {
    if (isMobile()) {
      const opening = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.classList.toggle('sidebar-open-mobile', opening);
    } else {
      document.body.classList.remove('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', 'false');
    }
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open-mobile');
  });

  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile()) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open-mobile');
      }
    });
  });
}

// ── UI helpers ────────────────────────────────────────────
//
// Defensive showApp: ALL non-critical UI updates (avatar, colors, super-admin
// controls) wrapped in try/catch so a single error never prevents the app shell
// from displaying. The very last thing we do is show the app-shell — that's the
// most important step.
//
async function showApp(user, { isSuperAdmin = false, companyName = null } = {}) {
  // 1. Basic info (rarely fails)
  try {
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    if (nameEl)  nameEl.textContent  = user?.displayName || user?.email || '';
    if (emailEl) emailEl.textContent = user?.email || '';
  } catch (e) { console.warn('Name/email setup:', e); }

  // 2. Avatar — set background-image directly (CSS background can't show
  //    a broken-image icon, so this is safe). If the URL fails to load, the
  //    initials text underneath remains visible.
  try {
    const placeholder = document.getElementById('user-avatar-placeholder');
    if (placeholder) {
      placeholder.textContent = initialsFor(user);
      if (user?.photoURL) {
        const safe = user.photoURL.replace(/"/g, '%22');
        placeholder.style.backgroundImage    = `url("${safe}")`;
        placeholder.style.backgroundSize     = 'cover';
        placeholder.style.backgroundPosition = 'center';
        placeholder.style.color              = 'transparent';
      } else {
        placeholder.style.backgroundImage = '';
        placeholder.style.color           = '';
      }
    }
  } catch (e) { console.warn('Avatar setup:', e); }

  // 3. Company metadata (name/logo/colors)
  try {
    let name = companyName;
    let logoUrl = '';
    let displayColors = null;
    if (!name) {
      try {
        const meta = await getCompanyMetadata();
        name          = meta?.name          || '—';
        logoUrl       = meta?.logoUrl       || '';
        displayColors = meta?.displayColors || null;
      } catch {
        name = '—';
      }
    }
    const nameEl = document.getElementById('sidebar-company-name');
    if (nameEl) nameEl.textContent = name;
    _applySidebarLogo(logoUrl);
    applyDisplayColors(displayColors);
  } catch (e) { console.warn('Company metadata setup:', e); }

  // 4. Super-admin controls
  try {
    const saSection = document.getElementById('super-admin-nav-section');
    const saBtn     = document.getElementById('switch-company-btn');
    if (saSection) saSection.style.display = isSuperAdmin ? '' : 'none';
    if (saBtn)     saBtn.style.display     = isSuperAdmin ? '' : 'none';
  } catch (e) { console.warn('Super-admin controls:', e); }

  // 5. CRITICAL — show the app shell. Must run no matter what.
  try {
    document.getElementById('login-screen').style.display       = 'none';
    document.getElementById('onboarding-screen').style.display  = 'none';
    document.getElementById('super-admin-screen').style.display = 'none';
    const ep = document.getElementById('employee-portal-screen');
    if (ep) ep.style.display = 'none';
    document.getElementById('app-shell').style.display          = 'flex';
  } catch (e) {
    console.error('Could not show app shell:', e);
  }

  // 6. Live sync — stream new absence requests from Firestore so the dashboard
  //    + Attendance Requests views update in real time and the sidebar badge
  //    flashes when something pending arrives.
  try {
    startAbsenceRequestsLiveSync();
    startAnnouncementsLiveSync();
    onAbsenceRequestsChange(() => {
      refreshPendingBadge();
      // Re-render the currently-active route if it cares about absence data
      const hash = location.hash || '#dashboard';
      if (hash === '#dashboard' || hash === '#absence-requests') {
        // route() is wired in router.js — easiest path is to re-trigger it
        try {
          const ev = new HashChangeEvent('hashchange', { newURL: location.href, oldURL: location.href });
          window.dispatchEvent(ev);
        } catch {}
      }
    });
    refreshPendingBadge();
  } catch (e) { console.warn('Absence live-sync setup:', e); }
}

/** Refresh the red pending badge on the sidebar's Attendance Requests link. */
function refreshPendingBadge() {
  try {
    const link = document.querySelector('a.nav-link[href="#absence-requests"]');
    if (!link) return;
    const count = getAbsenceRequests().filter(r => (r.status || 'pending') === 'pending').length;
    let badge = link.querySelector('.nav-pending-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-pending-badge';
        link.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.title = `${count} pending request${count === 1 ? '' : 's'}`;
    } else if (badge) {
      badge.remove();
    }
  } catch (e) { console.warn('Refresh pending badge:', e); }
}

function showLogin() {
  document.getElementById('login-screen').style.display      = 'flex';
  document.getElementById('onboarding-screen').style.display = 'none';
  const ep = document.getElementById('employee-portal-screen');
  if (ep) ep.style.display = 'none';
  document.getElementById('app-shell').style.display         = 'none';
}

/** Shown when someone signs in via the wrong front door.
 *  reason='admin'   → an owner/superadmin hit the portal URL
 *  reason='unknown' → an unrecognized account hit the portal URL
 */
function showWrongAppNotice(reason) {
  const adminURL = window.location.protocol + '//payroll-10a48.web.app';
  const isOwner  = reason === 'admin';
  const title    = isOwner ? 'This is the staff portal' : 'Account not recognized';
  const body     = isOwner
    ? 'You signed in with an admin / owner account. The staff portal is for employees only — please use the admin app instead.'
    : 'Your email isn\'t linked to an employee account in this company. Ask your administrator to add you, or sign in with a different account.';
  const cta = isOwner
    ? `<a href="${adminURL}" style="display:inline-block;margin-top:14px;padding:10px 16px;
         background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
         Open the admin app →
       </a>`
    : `<button id="wrong-app-signout" style="margin-top:14px;padding:10px 16px;background:#fff;
         color:#1e293b;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;">
         Sign out
       </button>`;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'none';
  const ep = document.getElementById('employee-portal-screen');
  if (ep) ep.style.display = 'none';

  let host = document.getElementById('wrong-app-notice');
  if (!host) {
    host = document.createElement('div');
    host.id = 'wrong-app-notice';
    host.style.cssText = 'position:fixed;inset:0;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
    document.body.appendChild(host);
  }
  host.innerHTML = `
    <div style="max-width:420px;background:#fff;border-radius:16px;padding:36px 32px;text-align:center;
                box-shadow:0 25px 50px rgba(0,0,0,0.3);">
      <div style="font-size:42px;margin-bottom:10px;">${isOwner ? '🛡️' : '🚫'}</div>
      <div style="font-size:1.3rem;font-weight:700;color:#1e293b;margin-bottom:8px;">${title}</div>
      <div style="font-size:0.92rem;color:#64748b;line-height:1.5;">${body}</div>
      ${cta}
    </div>
  `;
  host.style.display = 'flex';

  const out = document.getElementById('wrong-app-signout');
  if (out) out.addEventListener('click', () => signOutUser());
}

function showLoader(msg = 'Loading payroll data…') {
  document.getElementById('loader-msg').textContent    = msg;
  document.getElementById('app-loader').style.display  = 'flex';
}

function hideLoader() {
  document.getElementById('app-loader').style.display = 'none';
}

// Derive 1-2 letter initials from the user (used as the avatar fallback).
function initialsFor(user) {
  const source = user?.displayName || user?.email || '';
  if (!source) return '👤';
  const parts = source.split(/[\s@.+_-]/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  return (a + b) || '👤';
}

// ── Login screen language picker ──────────────────────────
function initLoginLangPicker() {
  const wrap = document.getElementById('login-lang-picker');
  if (!wrap) return;
  const current = getLanguage();
  wrap.innerHTML = SUPPORTED_LANGUAGES.map(lang => `
    <button type="button" data-lang="${lang.code}"
      style="padding:5px 12px;border:1.5px solid ${current === lang.code ? '#2563eb' : '#e2e8f0'};
             border-radius:6px;background:${current === lang.code ? '#dbeafe' : '#fff'};
             color:${current === lang.code ? '#1e40af' : '#64748b'};
             font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;
             display:inline-flex;align-items:center;gap:5px;">
      <span>${lang.flag}</span><span>${lang.label}</span>
    </button>
  `).join('');
  wrap.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });
}

// ── Auth flow ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initModal();
  initSidebarToggle();

  // Apply translations to all static [data-i18n] elements (login screen, sidebar, etc.)
  applyTranslationsToDOM();
  // Render language picker on login screen
  initLoginLangPicker();

  // Portal mode: hide the Google sign-in (only available in admin mode)
  if (IS_PORTAL_MODE) {
    const wrap = document.getElementById('google-signin-wrapper');
    if (wrap) wrap.style.display = 'none';
    // Also tighten the subtitle so it reads correctly for staff
    const sub = document.querySelector('#login-screen .login-sub');
    if (sub) sub.textContent = 'Sign in with your school Microsoft account';
    const title = document.querySelector('#login-screen .login-title');
    if (title) title.textContent = 'Staff Portal';
    // Swap the app icon to match
    const logo = document.querySelector('#login-screen .login-logo');
    if (logo) logo.textContent = '🏫';
  }

  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    try {
      document.getElementById('login-error').textContent = '';
      await signInWithGoogle();
    } catch (e) {
      console.error('Sign-in failed', e);
      document.getElementById('login-error').textContent = 'Sign-in failed. Please try again.';
    }
  });

  document.getElementById('microsoft-signin-btn').addEventListener('click', async () => {
    try {
      document.getElementById('login-error').textContent = '';
      await signInWithMicrosoft();
    } catch (e) {
      console.error('Sign-in failed', e);
      document.getElementById('login-error').textContent = 'Sign-in failed. Please try again.';
    }
  });

  document.getElementById('signout-btn').addEventListener('click', async () => {
    await signOutUser();
  });

  let appInitialized = false;

  // ── Switch Company (super admin only) ─────────────────
  document.getElementById('switch-company-btn').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('app-shell').style.display = 'none';
    // Re-render the company picker with current user (stored in closure)
    document.dispatchEvent(new CustomEvent('super-admin-pick'));
  });

  let _currentUser = null;

  document.addEventListener('super-admin-pick', () => {
    if (_currentUser) _launchSuperAdminPicker(_currentUser);
  });

  function _launchSuperAdminPicker(user) {
    renderSuperAdmin(user, async companyId => {
      showLoader('Loading company data…');
      setCompanyId(companyId);
      await initStore();
      hideLoader();
      await showApp(user, { isSuperAdmin: true });
      if (!appInitialized) { initRouter(); appInitialized = true; }
      else window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  onAuthChanged(async user => {
    if (!user) {
      stopAbsenceRequestsLiveSync();   // don't leak listeners across sessions
      stopAnnouncementsLiveSync();
      showLogin();
      return;
    }

    _currentUser = user;
    showLoader('Checking your account…');

    try {
      // ── Super Admin ──────────────────────────────────
      // Identified by email in firestore.rules — no need to write role here.
      // Just ensure a basic user record exists for app metadata.
      if (user.email === SUPER_ADMIN_EMAIL) {
        // PORTAL MODE: super admin landed on portal URL. Block and redirect.
        if (IS_PORTAL_MODE) {
          hideLoader();
          showWrongAppNotice('admin');
          return;
        }
        const userRecord = await getUserRecord(user.uid);
        if (!userRecord) {
          await createUserRecord(user.uid, {
            email: user.email,
            name:  user.displayName || user.email
          });
        }

        hideLoader();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-shell').style.display    = 'none';
        _launchSuperAdminPicker(user);
        return;
      }

      // ── Regular user ─────────────────────────────────
      const userRecord = await getUserRecord(user.uid);

      // Returning EMPLOYEE — show employee portal
      if (userRecord?.role === 'employee' && userRecord.employeeOf) {
        hideLoader();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-shell').style.display    = 'none';
        await renderEmployeePortal({
          user,
          companyId:  userRecord.employeeOf,
          employeeId: userRecord.employeeId
        });
        return;
      }

      // Returning OWNER — load their company
      // (treat any existing record with companyId as owner for backward compat)
      if (userRecord?.companyId && userRecord.role !== 'employee') {
        // PORTAL MODE: an owner landed on the portal URL by mistake.
        // Don't load the admin app. Show a polite redirect screen instead.
        if (IS_PORTAL_MODE) {
          hideLoader();
          showWrongAppNotice('admin');
          return;
        }
        setCompanyId(userRecord.companyId);
        showLoader('Loading payroll data…');
        await initStore();
        hideLoader();
        await showApp(user);

        if (!appInitialized) {
          initRouter();
          appInitialized = true;
        } else {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
        return;
      }

      // No record yet — first-time login. Check if email matches an employee.
      const lookup = await lookupEmployeeByEmail(user.email);
      if (lookup?.companyId && lookup?.employeeId) {
        // Create employee user record so subsequent logins recognize them
        await createUserRecord(user.uid, {
          role:       'employee',
          employeeOf: lookup.companyId,
          employeeId: lookup.employeeId,
          email:      user.email,
          name:       user.displayName || user.email
        });
        hideLoader();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-shell').style.display    = 'none';
        await renderEmployeePortal({
          user,
          companyId:  lookup.companyId,
          employeeId: lookup.employeeId
        });
        return;
      }

      // Otherwise — first-time owner: show onboarding to create their company
      // PORTAL MODE: an unknown user landing on the portal isn't an employee.
      // Don't auto-onboard them as an owner — that creates orphan accounts.
      if (IS_PORTAL_MODE) {
        hideLoader();
        showWrongAppNotice('unknown');
        return;
      }
      hideLoader();
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-shell').style.display    = 'none';

      await renderOnboarding(user, async companyId => {
        showLoader('Setting up your workspace…');
        setCompanyId(companyId);
        await initStore();
        hideLoader();
        await showApp(user);
        if (!appInitialized) { initRouter(); appInitialized = true; }
      });

    } catch (e) {
      console.error('Failed to load data', e);
      hideLoader();
      showLogin();
    }
  });
});
