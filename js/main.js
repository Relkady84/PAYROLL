import { init as initRouter, register } from './router.js';
import { initModal }                    from './views/components/modal.js';
import { render as renderDashboard }    from './views/dashboardView.js';
import { render as renderEmployees }    from './views/employeeListView.js';
import { render as renderPayroll }      from './views/payrollView.js';
import { render as renderSettings }     from './views/settingsView.js';
import { initStore }                    from './data/store.js';
import { onAuthChanged, signInWithGoogle, signOutUser } from './auth.js';

// Register all routes
register('#dashboard', () => renderDashboard('#app-content'));
register('#employees', () => renderEmployees('#app-content'));
register('#payroll',   () => renderPayroll('#app-content'));
register('#settings',  () => renderSettings('#app-content'));

// Mobile sidebar toggle
function initMobileSidebar() {
  const toggle  = document.getElementById('menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle || !sidebar || !overlay) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  });
}

function showApp(user) {
  // Update user info in sidebar
  document.getElementById('user-name').textContent  = user.displayName || user.email;
  document.getElementById('user-email').textContent = user.email;
  if (user.photoURL) {
    document.getElementById('user-avatar').src = user.photoURL;
    document.getElementById('user-avatar').style.display = 'block';
  }

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display    = 'none';
}

function showLoader(msg = 'Loading payroll data…') {
  document.getElementById('loader-msg').textContent = msg;
  document.getElementById('app-loader').style.display = 'flex';
}

function hideLoader() {
  document.getElementById('app-loader').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initModal();
  initMobileSidebar();

  // Sign-in button
  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Sign-in failed', e);
      document.getElementById('login-error').textContent = 'Sign-in failed. Please try again.';
    }
  });

  // Sign-out button
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await signOutUser();
  });

  // Auth state listener — drives the whole app
  let appInitialized = false;
  onAuthChanged(async user => {
    if (user) {
      showLoader();
      try {
        await initStore();
      } catch (e) {
        console.error('Failed to load data', e);
      }
      hideLoader();
      showApp(user);

      if (!appInitialized) {
        initRouter();
        appInitialized = true;
      } else {
        // Re-render current view after sign-back-in
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    } else {
      showLogin();
    }
  });
});
