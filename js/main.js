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
import { _applySidebarLogo, applyDisplayColors } from './views/settingsView.js';
import {
  initStore, setCompanyId,
  getUserRecord, createUserRecord,
  getCompanyMetadata, lookupEmployeeByEmail,
  SUPER_ADMIN_EMAIL
} from './data/store.js';
import { onAuthChanged, signInWithGoogle, signInWithMicrosoft, signOutUser } from './auth.js';
import { t, getLanguage, setLanguage, SUPPORTED_LANGUAGES, applyTranslationsToDOM } from './i18n.js';
import './pwa.js';   // self-registers the service worker + install prompt

// Register all routes
register('#dashboard',         () => renderDashboard('#app-content'));
register('#employees',         () => renderEmployees('#app-content'));
register('#payroll',           () => renderPayroll('#app-content'));
register('#settings',          () => renderSettings('#app-content'));
register('#reports',           () => renderReports('#app-content'));
register('#absence-requests',  () => renderAbsenceRequests('#app-content'));

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
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    } else {
      document.body.classList.remove('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', 'false');
    }
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile()) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      }
    });
  });
}

// ── UI helpers ────────────────────────────────────────────
async function showApp(user, { isSuperAdmin = false, companyName = null } = {}) {
  document.getElementById('user-name').textContent  = user.displayName || user.email;
  document.getElementById('user-email').textContent = user.email;
  if (user.photoURL) {
    const avatar = document.getElementById('user-avatar');
    avatar.src           = user.photoURL;
    avatar.style.display = 'block';
  }

  // Load and display company name + logo + colors in sidebar
  let name = companyName;
  let logoUrl = '';
  let displayColors = null;
  if (!name) {
    try {
      const meta = await getCompanyMetadata();
      name          = meta?.name         || '—';
      logoUrl       = meta?.logoUrl      || '';
      displayColors = meta?.displayColors || null;
    } catch {
      name = '—';
    }
  }
  document.getElementById('sidebar-company-name').textContent = name;
  _applySidebarLogo(logoUrl);
  applyDisplayColors(displayColors);

  // Show super admin controls
  const saSection = document.getElementById('super-admin-nav-section');
  const saBtn     = document.getElementById('switch-company-btn');
  if (isSuperAdmin) {
    saSection.style.display = '';
    saBtn.style.display     = '';
  } else {
    saSection.style.display = 'none';
    saBtn.style.display     = 'none';
  }

  document.getElementById('login-screen').style.display        = 'none';
  document.getElementById('onboarding-screen').style.display   = 'none';
  document.getElementById('super-admin-screen').style.display  = 'none';
  const ep = document.getElementById('employee-portal-screen');
  if (ep) ep.style.display = 'none';
  document.getElementById('app-shell').style.display           = 'flex';
}

function showLogin() {
  document.getElementById('login-screen').style.display      = 'flex';
  document.getElementById('onboarding-screen').style.display = 'none';
  const ep = document.getElementById('employee-portal-screen');
  if (ep) ep.style.display = 'none';
  document.getElementById('app-shell').style.display         = 'none';
}

function showLoader(msg = 'Loading payroll data…') {
  document.getElementById('loader-msg').textContent    = msg;
  document.getElementById('app-loader').style.display  = 'flex';
}

function hideLoader() {
  document.getElementById('app-loader').style.display = 'none';
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
