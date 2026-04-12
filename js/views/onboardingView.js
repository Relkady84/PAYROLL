import { db } from '../firebase.js';
import { doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { createCompany, createUserRecord, setCompanyId } from '../data/store.js';
import { DEFAULT_SETTINGS } from '../data/defaults.js';

/**
 * Renders the "Create your company" onboarding screen.
 * Calls onComplete(companyId) when the company is created successfully.
 */
export function renderOnboarding(user, onComplete) {
  const screen = document.getElementById('onboarding-screen');
  screen.style.display = 'flex';

  screen.innerHTML = `
    <div class="login-card" style="max-width:420px;">
      <div class="login-logo">🏢</div>
      <div class="login-title">Set Up Your Company</div>
      <div class="login-sub">Signed in as <strong>${esc(user.email)}</strong></div>

      <form id="onboarding-form" style="margin-top:24px;text-align:left;">
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.85rem;font-weight:600;color:#1e293b;margin-bottom:6px;">
            Company Name <span style="color:#dc2626;">*</span>
          </label>
          <input id="company-name-input" type="text" placeholder="e.g. Montaigne School"
            style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:8px;
                   font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;
                   transition:border-color 0.15s;"
            onfocus="this.style.borderColor='#2563eb'"
            onblur="this.style.borderColor='#e2e8f0'">
        </div>

        <button type="submit"
          style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;
                 border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;
                 font-family:inherit;transition:background 0.15s;">
          Create Company &amp; Continue →
        </button>

        <div id="onboarding-error"
          style="margin-top:10px;font-size:0.8rem;color:#dc2626;min-height:18px;text-align:center;">
        </div>
      </form>

      <button id="onboarding-signout"
        style="margin-top:16px;background:none;border:none;color:#64748b;font-size:0.8rem;
               cursor:pointer;font-family:inherit;text-decoration:underline;">
        Sign out and use a different account
      </button>
    </div>
  `;

  document.getElementById('onboarding-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('company-name-input');
    const errEl     = document.getElementById('onboarding-error');
    const btn       = e.target.querySelector('button[type="submit"]');
    const name      = nameInput.value.trim();

    if (!name) {
      errEl.textContent = 'Please enter your company name.';
      nameInput.focus();
      return;
    }

    btn.textContent = 'Creating…';
    btn.disabled    = true;
    errEl.textContent = '';

    try {
      // Generate a unique company ID independent of the user's UID
      // (allows multiple users/team members to be added later)
      const companyId = `${user.uid.slice(0, 8)}_${Date.now()}`;

      // Create company metadata + default settings
      await createCompany(companyId, {
        name,
        ownerUid:   user.uid,
        ownerEmail: user.email,
        createdAt:  serverTimestamp()
      });

      // Write default settings so the company is ready to use immediately
      await setDoc(
        doc(db, 'companies', companyId, 'settings', 'config'),
        DEFAULT_SETTINGS
      );

      // Link user → company
      await createUserRecord(user.uid, {
        companyId,
        role:  'owner',
        email: user.email,
        name:  user.displayName || user.email
      });

      screen.style.display = 'none';
      onComplete(companyId);
    } catch (err) {
      console.error('Onboarding failed:', err);
      errEl.textContent = 'Something went wrong. Please try again.';
      btn.textContent   = 'Create Company & Continue →';
      btn.disabled      = false;
    }
  });

  document.getElementById('onboarding-signout').addEventListener('click', () => {
    screen.style.display = 'none';
    import('../auth.js').then(({ signOutUser }) => signOutUser());
  });
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
