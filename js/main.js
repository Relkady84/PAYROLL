import { init as initRouter, register } from './router.js';
import { initModal }                    from './views/components/modal.js';
import { render as renderDashboard }    from './views/dashboardView.js';
import { render as renderEmployees }    from './views/employeeListView.js';
import { render as renderPayroll }      from './views/payrollView.js';
import { render as renderSettings }     from './views/settingsView.js';
import { renderOnboarding }             from './views/onboardingView.js';
import { initStore, setCompanyId, getUserRecord, getCompanyMetadata } from './data/store.js';
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
async function showApp(user) {
  document.getElementById('user-name').textContent  = user.displayName || user.email;
  document.getElementById('user-email').textContent = user.email;
  if (user.photoURL) {
    const avatar = document.getElementById('user-avatar');
    avatar.src           = user.photoURL;
    avatar.style.display = 'block';
  }

  // Load and display company name in sidebar
  try {
    const meta = await getCompanyMetadata();
    document.getElementById('sidebar-company-name').textContent = meta?.name || '—';
  } catch {
    document.getElementById('sidebar-company-name').textContent = '—';
  }

  document.getElementById('login-screen').style.display      = 'none';
  document.getElementById('onboarding-screen').style.display = 'none';
  document.getElementById('app-shell').style.display         = 'flex';
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

  onAuthChanged(async user => {
    if (!user) {
      showLogin();
      return;
    }

    showLoader('Checking your account…');

    try {
      // Look up /users/{uid} to get their companyId
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
