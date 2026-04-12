import { getAllCompanies } from '../data/store.js';

/**
 * Renders the Super Admin company picker screen.
 * Lists all registered companies and calls onSelect(companyId) when one is chosen.
 */
export async function renderSuperAdmin(user, onSelect) {
  const screen = document.getElementById('super-admin-screen');
  screen.style.display = 'flex';

  _renderLoading(screen, user);

  let companies = [];
  try {
    companies = await getAllCompanies();
  } catch (e) {
    console.error('Failed to load companies:', e);
    _renderError(screen, user, onSelect);
    return;
  }

  _renderPicker(screen, user, companies, onSelect);
}

function _renderLoading(screen, user) {
  screen.innerHTML = `
    <div class="login-card" style="max-width:480px;">
      <div class="login-logo">🔧</div>
      <div class="login-title">Super Admin</div>
      <div class="login-sub">Signed in as <strong>${esc(user.email)}</strong></div>
      <div style="margin-top:24px;text-align:center;color:#64748b;font-size:0.9rem;">
        Loading companies…
      </div>
    </div>
  `;
}

function _renderError(screen, user, onSelect) {
  screen.innerHTML = `
    <div class="login-card" style="max-width:480px;">
      <div class="login-logo">🔧</div>
      <div class="login-title">Super Admin</div>
      <div class="login-sub">Signed in as <strong>${esc(user.email)}</strong></div>
      <div style="margin-top:16px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;
                  border-radius:8px;font-size:0.85rem;color:#dc2626;text-align:center;">
        Failed to load companies. Check Firestore rules and try again.
      </div>
      <button id="sa-retry-btn"
        style="margin-top:16px;width:100%;padding:12px;background:#2563eb;color:#fff;border:none;
               border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">
        Retry
      </button>
    </div>
  `;
  document.getElementById('sa-retry-btn').addEventListener('click', () => renderSuperAdmin(user, onSelect));
}

function _renderPicker(screen, user, companies, onSelect) {
  const sorted = [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  screen.innerHTML = `
    <div class="login-card" style="max-width:520px;text-align:left;">
      <div style="text-align:center;">
        <div class="login-logo">🔧</div>
        <div class="login-title">Super Admin Panel</div>
        <div class="login-sub">Signed in as <strong>${esc(user.email)}</strong></div>
      </div>

      <div style="margin-top:20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">
          Companies (${sorted.length})
        </div>
        <input id="sa-search" type="text" placeholder="Search…"
          style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:0.8rem;
                 font-family:inherit;outline:none;width:160px;"
          onfocus="this.style.borderColor='#2563eb'"
          onblur="this.style.borderColor='#e2e8f0'">
      </div>

      <div id="sa-company-list"
        style="margin-top:12px;max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
        ${sorted.map(c => _companyCard(c)).join('')}
      </div>

      ${sorted.length === 0 ? `
        <div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85rem;">
          No companies registered yet.
        </div>
      ` : ''}

      <button id="sa-signout"
        style="margin-top:16px;background:none;border:none;color:#64748b;font-size:0.8rem;
               cursor:pointer;font-family:inherit;text-decoration:underline;display:block;width:100%;text-align:center;">
        Sign out
      </button>
    </div>
  `;

  // Search filter
  document.getElementById('sa-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.sa-company-card').forEach(card => {
      const text = card.dataset.search || '';
      card.style.display = q && !text.includes(q) ? 'none' : '';
    });
  });

  // Manage buttons
  document.getElementById('sa-company-list').addEventListener('click', e => {
    const btn = e.target.closest('.sa-manage-btn');
    if (!btn) return;
    const companyId = btn.dataset.companyId;
    screen.style.display = 'none';
    onSelect(companyId);
  });

  // Sign out
  document.getElementById('sa-signout').addEventListener('click', () => {
    screen.style.display = 'none';
    import('../auth.js').then(({ signOutUser }) => signOutUser());
  });
}

function _companyCard(c) {
  const name      = esc(c.name || '—');
  const owner     = esc(c.ownerEmail || '—');
  const created   = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : '—';
  const searchStr = `${(c.name || '')} ${(c.ownerEmail || '')}`.toLowerCase();

  return `
    <div class="sa-company-card" data-search="${esc(searchStr)}"
      style="padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
             display:flex;align-items:center;gap:12px;background:#f8fafc;">
      <div style="width:36px;height:36px;border-radius:8px;background:#dbeafe;
                  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
        🏢
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.9rem;color:#1e293b;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
        <div style="font-size:0.75rem;color:#64748b;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${owner}</div>
        <div style="font-size:0.7rem;color:#94a3b8;margin-top:2px;">Created: ${created}</div>
      </div>
      <button class="sa-manage-btn" data-company-id="${esc(c.id)}"
        style="padding:7px 14px;background:#2563eb;color:#fff;border:none;border-radius:7px;
               font-size:0.8rem;font-weight:600;cursor:pointer;font-family:inherit;
               white-space:nowrap;flex-shrink:0;transition:background 0.15s;"
        onmouseover="this.style.background='#1d4ed8'"
        onmouseout="this.style.background='#2563eb'">
        Manage →
      </button>
    </div>
  `;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
