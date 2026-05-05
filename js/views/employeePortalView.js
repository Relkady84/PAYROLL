/**
 * Employee Portal — mobile-first self-service for absence requests.
 *
 * Renders inside #employee-portal-screen (a fullscreen overlay, like login).
 * The employee can:
 *   - View their info (name, type)
 *   - Submit new absence requests (today or up to 7 days back, or future)
 *   - See their request history with status badges
 *   - Cancel their own pending requests
 */

import {
  loadOwnAbsenceRequests,
  addOwnAbsenceRequest,
  deleteOwnAbsenceRequest,
  getAbsenceRequests,
  getEmployeeRecord,
  getCompanyMetadataFor
} from '../data/store.js';
import {
  ABSENCE_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
  MAX_BACKDATE_DAYS,
  validateAbsenceRequest,
  createAbsenceRequest,
  todayISO,
  dateNDaysAgo
} from '../models/absenceRequest.js';
import { signOutUser } from '../auth.js';

let _user      = null;
let _employee  = null;
let _companyId = null;
let _companyName = '';

export async function renderEmployeePortal({ user, companyId, employeeId }) {
  _user      = user;
  _companyId = companyId;

  const screen = document.getElementById('employee-portal-screen');
  screen.style.display = 'flex';

  // Load employee + company metadata + requests in parallel
  const [emp, meta] = await Promise.all([
    getEmployeeRecord(companyId, employeeId),
    getCompanyMetadataFor(companyId)
  ]);

  if (!emp) {
    screen.innerHTML = errorShellHTML('We could not find your employee record. Please contact your administrator.');
    bindSignOut();
    return;
  }

  _employee    = emp;
  _companyName = meta?.name || '—';

  await loadOwnAbsenceRequests(companyId, employeeId);
  draw();
}

// ── Drawing ─────────────────────────────────────────────
function draw() {
  const screen = document.getElementById('employee-portal-screen');
  const requests = [...getAbsenceRequests()].sort((a, b) =>
    (b.requestedAt || 0) - (a.requestedAt || 0)
  );

  screen.innerHTML = `
    <div class="ep-shell">
      ${headerHTML()}
      <main class="ep-main">
        ${greetingCardHTML()}
        ${requestFormCardHTML()}
        ${requestsListHTML(requests)}
      </main>
      <footer class="ep-footer">
        <button id="ep-signout" class="ep-link-btn">Sign out</button>
      </footer>
    </div>
  `;

  bindFormEvents();
  bindListEvents();
  bindSignOut();
}

function headerHTML() {
  return `
    <header class="ep-header">
      <div class="ep-header-title">
        <span class="ep-logo">📅</span>
        <div>
          <div class="ep-header-name">${esc(_companyName)}</div>
          <div class="ep-header-sub">Employee Portal</div>
        </div>
      </div>
    </header>
  `;
}

function greetingCardHTML() {
  const fullName = `${_employee.firstName || ''} ${_employee.lastName || ''}`.trim();
  const typeLabel = _employee.employeeType === 'Admin' ? 'Administrator' : 'Teacher';
  return `
    <section class="ep-card ep-greeting">
      <div class="ep-avatar">${initials(fullName)}</div>
      <div class="ep-greeting-text">
        <div class="ep-greeting-name">Hi, ${esc(_employee.firstName || 'there')} 👋</div>
        <div class="ep-greeting-meta">${esc(typeLabel)} · ${esc(_employee.homeLocation || '')}</div>
      </div>
    </section>
  `;
}

function requestFormCardHTML() {
  const today    = todayISO();
  const earliest = dateNDaysAgo(MAX_BACKDATE_DAYS);
  return `
    <section class="ep-card">
      <div class="ep-card-title">📝 Request an Absence</div>

      <form id="ep-form" novalidate>
        <label class="ep-label" for="ep-date">Date</label>
        <input class="ep-input" type="date" id="ep-date"
          min="${earliest}" value="${today}" required>
        <div class="ep-hint">You can request from ${earliest} to any future date.</div>

        <label class="ep-label" for="ep-category">Category</label>
        <select class="ep-input" id="ep-category" required>
          ${ABSENCE_CATEGORIES.map(c =>
            `<option value="${c}">${CATEGORY_LABELS[c]}</option>`
          ).join('')}
        </select>

        <label class="ep-label" for="ep-reason">
          Reason / Note <span id="ep-reason-required" class="ep-muted"></span>
        </label>
        <textarea class="ep-input" id="ep-reason" rows="3"
          maxlength="500"
          placeholder="Optional — e.g., medical appointment"></textarea>

        <div id="ep-form-errors" class="ep-errors"></div>

        <button type="submit" class="ep-btn ep-btn-primary">
          ✓ Submit Request
        </button>
      </form>
    </section>
  `;
}

function requestsListHTML(requests) {
  if (!requests.length) {
    return `
      <section class="ep-card ep-empty">
        <div class="ep-empty-icon">📭</div>
        <div class="ep-empty-text">No requests yet.</div>
        <div class="ep-empty-sub">Your submitted requests will appear here.</div>
      </section>
    `;
  }

  return `
    <section class="ep-card">
      <div class="ep-card-title">📋 My Requests</div>
      <div class="ep-list">
        ${requests.map(r => requestItemHTML(r)).join('')}
      </div>
    </section>
  `;
}

function requestItemHTML(r) {
  const dateStr = formatHumanDate(r.date);
  const cat     = CATEGORY_LABELS[r.category] || r.category;
  const status  = r.status || 'pending';
  return `
    <div class="ep-request" data-id="${esc(r.id)}">
      <div class="ep-request-row">
        <div class="ep-request-date">${esc(dateStr)}</div>
        <span class="ep-status ep-status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>
      </div>
      <div class="ep-request-cat">${esc(cat)}</div>
      ${r.reason ? `<div class="ep-request-reason">"${esc(r.reason)}"</div>` : ''}
      ${r.reviewNotes ? `<div class="ep-request-review"><strong>Admin note:</strong> ${esc(r.reviewNotes)}</div>` : ''}
      ${status === 'pending' ? `
        <button class="ep-btn ep-btn-ghost ep-btn-sm" data-action="cancel">Cancel</button>
      ` : ''}
    </div>
  `;
}

// ── Events ──────────────────────────────────────────────
function bindFormEvents() {
  const form = document.getElementById('ep-form');
  const catEl = document.getElementById('ep-category');
  const reasonRequired = document.getElementById('ep-reason-required');

  function updateReasonHint() {
    reasonRequired.textContent = catEl.value === 'other' ? '(required)' : '(optional)';
  }
  catEl.addEventListener('change', updateReasonHint);
  updateReasonHint();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      date:     document.getElementById('ep-date').value,
      category: document.getElementById('ep-category').value,
      reason:   document.getElementById('ep-reason').value
    };

    const errors = validateAbsenceRequest(data);
    const errEl  = document.getElementById('ep-form-errors');
    if (errors.length) {
      errEl.innerHTML = errors.map(e => `<div>⚠ ${esc(e)}</div>`).join('');
      return;
    }
    errEl.innerHTML = '';

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const req = createAbsenceRequest(data, _employee);
      await addOwnAbsenceRequest(_companyId, req);
      draw();
    } catch (err) {
      console.error(err);
      errEl.innerHTML = `<div>⚠ Failed to submit. Try again.</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ Submit Request';
    }
  });
}

function bindListEvents() {
  document.querySelectorAll('[data-action="cancel"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const item = e.target.closest('[data-id]');
      const id   = item?.dataset.id;
      if (!id) return;
      if (!confirm('Cancel this pending request?')) return;
      btn.disabled = true;
      try {
        await deleteOwnAbsenceRequest(_companyId, id);
        draw();
      } catch (err) {
        console.error(err);
        alert('Could not cancel. Try again.');
        btn.disabled = false;
      }
    });
  });
}

function bindSignOut() {
  const btn = document.getElementById('ep-signout');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await signOutUser();
  });
}

// ── Helpers ─────────────────────────────────────────────
function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name) {
  if (!name) return '👤';
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '👤';
}

function formatHumanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

function errorShellHTML(message) {
  return `
    <div class="ep-shell">
      <header class="ep-header"><div class="ep-header-title"><span class="ep-logo">⚠️</span><div><div class="ep-header-name">Access issue</div></div></div></header>
      <main class="ep-main">
        <section class="ep-card">
          <div class="ep-card-title">${esc(message)}</div>
          <button id="ep-signout" class="ep-btn ep-btn-ghost" style="margin-top:12px;">Sign out</button>
        </section>
      </main>
    </div>
  `;
}
