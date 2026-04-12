import { init as initRouter, register } from './router.js';
import { initModal }                    from './views/components/modal.js';
import { render as renderDashboard }    from './views/dashboardView.js';
import { render as renderEmployees }    from './views/employeeListView.js';
import { render as renderPayroll }      from './views/payrollView.js';
import { render as renderSettings }     from './views/settingsView.js';
import { renderOnboarding }             from './views/onboardingView.js';
import { renderSuperAdmin }             from './views/superAdminView.js';
import { _applySidebarLogo, applyDisplayColors } from './views/settingsView.js';
import { initStore, setCompanyId, getUserRecord, createUserRecord, getCompanyMetadata, SUPER_ADMIN_EMAIL } from './data/store.js';
import { onAuthChanged, signInWithGoogle, signInWithMicrosoft, signOutUser } from './auth.js';

// Register all routes
register('#dashboard', () => renderDashboard('#app-content'));
register('#employees', () => renderEmployees('#app-content'));
register('#payroll',   () => renderPayroll('#app-content'));
register('#settings',  () => renderSettings('#app-content'));

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
  document.getElementById('app-shell').style.display           = 'flex';
}

function showLogin() {
  document.getElementById('login-screen').style.display      = 'flex';
  document.getElementById('onboarding-screen').style.display = 'none';
  document.getElementById('app-shell').style.display         = 'none';
}

function showLoader(msg = 'Loading payroll data…') {
  document.getElementById('loader-msg').textContent    = msg;
  document.getElementById('app-loader').style.display  = 'flex';
}

function hideLoader() {
  document.getElementById('app-loader').style.display = 'none';
}

// ── Auth flow ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initModal();
  initSidebarToggle();

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
      if (user.email === SUPER_ADMIN_EMAIL) {
        // Ensure user record exists with superAdmin role
        let userRecord = await getUserRecord(user.uid);
        if (!userRecord) {
          await createUserRecord(user.uid, {
            role:  'superAdmin',
            email: user.email,
            name:  user.displayName || user.email
          });
        } else if (userRecord.role !== 'superAdmin') {
          await createUserRecord(user.uid, { ...userRecord, role: 'superAdmin' });
        }

        hideLoader();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-shell').style.display    = 'none';
        _launchSuperAdminPicker(user);
        return;
      }

      // ── Regular user ─────────────────────────────────
      const userRecord = await getUserRecord(user.uid);

      if (!userRecord?.companyId) {
        // First-time user — show onboarding to create their company
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
        return;
      }

      // Existing user — load their company
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

    } catch (e) {
      console.error('Failed to load data', e);
      hideLoader();
      showLogin();
    }
  });
});
