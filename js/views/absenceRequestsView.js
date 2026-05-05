/**
 * Admin Absence Requests dashboard.
 * Lists all absence requests for the company, with tabs for pending / approved / rejected.
 * Admin can approve or reject pending requests with optional notes.
 */

import {
  getAbsenceRequests,
  updateAbsenceRequest
} from '../data/store.js';
import { CATEGORY_LABELS, STATUS_LABELS, TYPE_LABELS } from '../models/absenceRequest.js';
import { showToast } from './components/toast.js';
import { openModal, closeModal } from './components/modal.js';
import { getCurrentUser } from '../auth.js';

let _activeTab = 'pending';

export function render(selector) {
  const container = document.querySelector(selector);
  _activeTab = 'pending';

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Absence Requests</h1>
        <span class="content-header-subtitle" id="ar-summary">Loading…</span>
      </div>
    </div>

    <div class="page-body">
      <div class="section-card">
        <div class="toolbar">
          <div class="toolbar-left" id="ar-tabs"></div>
          <div class="toolbar-right">
            <input type="text" id="ar-search" placeholder="Search by name…"
              style="padding:6px 10px;border:1.5px solid var(--color-border);border-radius:6px;font-size:0.85rem;font-family:inherit;outline:none;">
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Type / Category</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="ar-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  drawTabs();
  drawList();

  document.getElementById('ar-search').addEventListener('input', drawList);
}

function drawTabs() {
  const all = getAbsenceRequests();
  const counts = {
    pending:  all.filter(r => r.status === 'pending').length,
    approved: all.filter(r => r.status === 'approved').length,
    rejected: all.filter(r => r.status === 'rejected').length
  };

  const tabsEl = document.getElementById('ar-tabs');
  tabsEl.innerHTML = `
    <div class="ar-tabs" style="display:flex;gap:6px;">
      ${['pending','approved','rejected'].map(s => `
        <button class="ar-tab" data-tab="${s}"
          style="padding:7px 14px;border:1.5px solid var(--color-border);border-radius:7px;
                 background:${_activeTab === s ? 'var(--color-primary)' : 'transparent'};
                 color:${_activeTab === s ? '#fff' : 'var(--color-text-secondary)'};
                 cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;">
          ${STATUS_LABELS[s]} ${counts[s] ? `<span style="opacity:0.85;">(${counts[s]})</span>` : ''}
        </button>
      `).join('')}
    </div>
  `;

  tabsEl.querySelectorAll('.ar-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      drawTabs();
      drawList();
    });
  });
}

function drawList() {
  const search = (document.getElementById('ar-search')?.value || '').toLowerCase().trim();

  let rows = getAbsenceRequests().filter(r => r.status === _activeTab);

  if (search) {
    rows = rows.filter(r =>
      (r.employeeName || '').toLowerCase().includes(search)
      || (r.employeeEmail || '').toLowerCase().includes(search)
    );
  }

  // Sort: pending oldest first (FIFO), others newest first
  rows.sort((a, b) => {
    if (_activeTab === 'pending') return (a.requestedAt || 0) - (b.requestedAt || 0);
    return (b.reviewedAt || b.requestedAt || 0) - (a.reviewedAt || a.requestedAt || 0);
  });

  const summary = `${rows.length} ${_activeTab} request${rows.length !== 1 ? 's' : ''}`;
  document.getElementById('ar-summary').textContent = summary;

  const tbody = document.getElementById('ar-tbody');
  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="table-empty">
          <div class="table-empty-icon">📭</div>
          <p>No ${_activeTab} requests${search ? ' matching your search' : ''}.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const type = r.type || 'absence';
    const typeBadge = type === 'permanence'
      ? `<span class="badge" style="background:#dcfce7;color:#166534;">🎯 Permanence (+1)</span>`
      : `<span class="badge" style="background:#fee2e2;color:#991b1b;">🚫 Absence (−1)</span>`;
    const categoryDisplay = type === 'permanence'
      ? '—'
      : (CATEGORY_LABELS[r.category] || r.category || '—');
    return `
    <tr>
      <td>
        <strong>${esc(r.employeeName)}</strong>
        ${r.employeeEmail ? `<br><span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">${esc(r.employeeEmail)}</span>` : ''}
      </td>
      <td>${esc(formatHumanDate(r.date))}</td>
      <td>${typeBadge}<br><span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">${esc(categoryDisplay)}</span></td>
      <td style="max-width:240px;">${r.reason ? `<em>${esc(r.reason)}</em>` : '<span style="color:var(--color-text-muted);">—</span>'}</td>
      <td><span class="badge badge-${esc(r.status)}">${esc(STATUS_LABELS[r.status])}</span></td>
      <td>
        ${r.status === 'pending' ? `
          <div class="action-btns">
            <button class="btn btn-success btn-sm" data-action="approve" data-id="${esc(r.id)}">✓ Approve</button>
            <button class="btn btn-danger btn-sm" data-action="reject" data-id="${esc(r.id)}">✕ Reject</button>
          </div>
        ` : `
          <div style="font-size:0.75rem;color:var(--color-text-muted);">
            ${r.reviewedBy ? `by ${esc(r.reviewedBy)}` : ''}<br>
            ${r.reviewedAt ? formatHumanDate(new Date(r.reviewedAt).toISOString().slice(0,10)) : ''}
            ${r.reviewNotes ? `<br><em>"${esc(r.reviewNotes)}"</em>` : ''}
          </div>
        `}
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleReview(btn.dataset.action, btn.dataset.id));
  });
}

function handleReview(action, id) {
  const status = action === 'approve' ? 'approved' : 'rejected';
  const titleVerb = action === 'approve' ? 'Approve' : 'Reject';
  const requests = getAbsenceRequests();
  const req = requests.find(r => r.id === id);
  if (!req) return;

  const reqType = req.type || 'absence';
  const reqTypeLabel = reqType === 'permanence' ? 'Permanence (+1 day)' : 'Absence (−1 day)';

  openModal(
    `${titleVerb} ${reqTypeLabel}`,
    `
      <p style="color:var(--color-text-secondary);margin-bottom:12px;">
        ${titleVerb} <strong>${esc(req.employeeName)}</strong>'s
        <strong>${esc(reqTypeLabel.toLowerCase())}</strong> for
        <strong>${esc(formatHumanDate(req.date))}</strong>?
      </p>
      <label class="form-label">Optional note (visible to employee)</label>
      <textarea class="form-control" id="ar-review-notes" rows="3" maxlength="500"
        placeholder="e.g., Approved — please notify the substitute teacher."></textarea>
    `,
    {
      confirmLabel: titleVerb,
      danger: status === 'rejected',
      onConfirm: async () => {
        const notes = document.getElementById('ar-review-notes')?.value || '';
        try {
          const reviewer = getCurrentUser()?.email || '(admin)';
          await updateAbsenceRequest(id, {
            status,
            reviewedBy:  reviewer,
            reviewedAt:  Date.now(),
            reviewNotes: notes.trim()
          });
          closeModal();
          showToast(`Request ${status}.`, status === 'approved' ? 'success' : 'info');
          drawTabs();
          drawList();
        } catch (e) {
          console.error(e);
          showToast('Failed to update request.', 'error');
        }
      }
    }
  );
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

function formatHumanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}
