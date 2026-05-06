/**
 * Admin Absence Requests dashboard.
 * Lists all absence requests for the company, with tabs for pending / approved / rejected.
 * Admin can approve or reject pending requests with optional notes.
 */

import {
  getAbsenceRequests,
  updateAbsenceRequest
} from '../data/store.js';
import { CATEGORY_LABELS, STATUS_LABELS, TYPE_LABELS, ABSENCE_CATEGORIES } from '../models/absenceRequest.js';
import { showToast } from './components/toast.js';
import { openModal, closeModal } from './components/modal.js';
import { getCurrentUser } from '../auth.js';

let _activeTab      = 'pending';
let _filterType     = 'all';       // 'all' | 'absence' | 'permanence'
let _filterCategory = 'all';       // 'all' | 'sick' | 'personal' | 'training' | 'other'
let _filterDate     = 'all';       // 'all' | 'YYYY' | 'YYYY-MM'
let _expandedYear   = null;        // for the dropdown: which year is currently expanded
let _sortKey        = null;        // null = default (pending oldest first, others newest first)
let _sortDir        = 'asc';       // 'asc' | 'desc'

const MONTH_OPTIONS = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Apr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' }, { v: '09', l: 'Sep' },
  { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' }
];

function dateFilterLabel(filter) {
  if (filter === 'all' || !filter) return 'All dates';
  if (/^\d{4}$/.test(filter)) return `All ${filter}`;
  if (/^\d{4}-\d{2}$/.test(filter)) {
    const m = MONTH_OPTIONS.find(x => x.v === filter.slice(5, 7));
    return `${m ? m.l : ''} ${filter.slice(0, 4)}`.trim();
  }
  return 'All dates';
}

export function render(selector) {
  const container = document.querySelector(selector);
  _activeTab      = 'pending';
  _filterType     = 'all';
  _filterCategory = 'all';
  _filterDate     = 'all';
  _expandedYear   = null;
  _sortKey        = null;       // start with default ordering
  _sortDir        = 'asc';

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Attendance Requests</h1>
        <span class="content-header-subtitle" id="ar-summary">Loading…</span>
      </div>
    </div>

    <div class="page-body">
      <div class="section-card">
        <div class="toolbar">
          <div class="toolbar-left" id="ar-tabs"></div>
          <div class="toolbar-right" style="gap:6px;flex-wrap:wrap;">
            <select class="filter-select" id="ar-type-filter"
              style="padding:6px 10px;border:1.5px solid var(--color-border);border-radius:6px;font-size:0.85rem;font-family:inherit;outline:none;">
              <option value="all">All types</option>
              <option value="absence">🚫 Absence</option>
              <option value="permanence">🎯 Permanence</option>
            </select>
            <select class="filter-select" id="ar-cat-filter"
              style="padding:6px 10px;border:1.5px solid var(--color-border);border-radius:6px;font-size:0.85rem;font-family:inherit;outline:none;">
              <option value="all">All categories</option>
              ${ABSENCE_CATEGORIES.map(c =>
                `<option value="${c}">${CATEGORY_LABELS[c]}</option>`
              ).join('')}
            </select>
            <div id="ar-date-filter-wrap" style="position:relative;display:inline-block;">
              <button type="button" id="ar-date-filter-btn"
                style="padding:6px 12px;border:1.5px solid var(--color-border);border-radius:6px;
                       font-size:0.85rem;font-family:inherit;outline:none;background:#fff;
                       cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                <span>📅</span>
                <span id="ar-date-filter-label">All dates</span>
                <span style="font-size:0.7rem;">▼</span>
              </button>
              <div id="ar-date-filter-menu"
                style="display:none;position:absolute;top:100%;right:0;margin-top:4px;
                       background:#fff;border:1.5px solid var(--color-border);border-radius:8px;
                       box-shadow:0 4px 12px rgba(0,0,0,0.1);min-width:220px;z-index:1000;
                       padding:6px;max-height:320px;overflow-y:auto;font-size:0.85rem;">
              </div>
            </div>
            <input type="text" id="ar-search" placeholder="Search by name…"
              style="padding:6px 10px;border:1.5px solid var(--color-border);border-radius:6px;font-size:0.85rem;font-family:inherit;outline:none;">
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table" id="ar-table">
            <thead>
              <tr>
                <th class="sortable" data-key="employeeName">Employee <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="date">Date <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="typeCategory">Type / Category <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="reason">Reason <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="status">Status <span class="sort-icon">↕</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="ar-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  updateDateFilterButtonLabel();
  drawTabs();
  drawList();

  document.getElementById('ar-search').addEventListener('input', drawList);
  document.getElementById('ar-type-filter').addEventListener('change', e => {
    _filterType = e.target.value;
    // When type=permanence is chosen, category filter is meaningless
    // (permanences have no category) — reset it and disable the dropdown.
    const catSelect = document.getElementById('ar-cat-filter');
    if (_filterType === 'permanence') {
      _filterCategory = 'all';
      catSelect.value = 'all';
      catSelect.disabled = true;
      catSelect.title = 'Permanences have no category';
    } else {
      catSelect.disabled = false;
      catSelect.title = '';
    }
    drawList();
  });
  document.getElementById('ar-cat-filter').addEventListener('change', e => {
    _filterCategory = e.target.value;
    drawList();
  });
  // Date picker open/close
  const dateBtn  = document.getElementById('ar-date-filter-btn');
  const dateMenu = document.getElementById('ar-date-filter-menu');
  dateBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (dateMenu.style.display === 'block') {
      dateMenu.style.display = 'none';
    } else {
      renderDatePickerMenu();
      dateMenu.style.display = 'block';
    }
  });
  dateMenu.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => {
    if (dateBtn && dateMenu &&
        !dateBtn.contains(e.target) && !dateMenu.contains(e.target)) {
      dateMenu.style.display = 'none';
    }
  });

  // Sortable column headers
  document.getElementById('ar-table').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.key;
    if (_sortKey === key) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortKey = key;
      _sortDir = 'asc';
    }
    drawList();
  });
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

function getAvailableYearMonths() {
  // Returns { '2026': new Set(['01','02',...]), '2025': new Set([...]) }
  const map = {};
  for (const r of getAbsenceRequests()) {
    if (typeof r.date !== 'string' || r.date.length < 7) continue;
    const y = r.date.slice(0, 4);
    const m = r.date.slice(5, 7);
    if (!map[y]) map[y] = new Set();
    map[y].add(m);
  }
  return map;
}

function updateDateFilterButtonLabel() {
  const lbl = document.getElementById('ar-date-filter-label');
  if (lbl) lbl.textContent = dateFilterLabel(_filterDate);
}

function renderDatePickerMenu() {
  const menu = document.getElementById('ar-date-filter-menu');
  if (!menu) return;

  const yearMonthMap = getAvailableYearMonths();
  const years = Object.keys(yearMonthMap).sort();

  if (!years.length) {
    menu.innerHTML = `<div style="padding:10px;color:var(--color-text-muted);">No dates yet — no requests submitted.</div>`;
    return;
  }

  // Top: "All dates" option
  let html = `
    <button type="button" data-pick="all"
      style="display:block;width:100%;text-align:left;padding:8px 10px;border:none;
             background:${_filterDate === 'all' ? '#dbeafe' : 'transparent'};
             color:${_filterDate === 'all' ? '#1e40af' : '#1e293b'};
             font-weight:${_filterDate === 'all' ? '600' : '500'};
             border-radius:6px;cursor:pointer;font-family:inherit;font-size:0.85rem;
             border-bottom:1px solid var(--color-border);margin-bottom:4px;">
      📅 All dates
    </button>
  `;

  for (const year of years) {
    const isExpanded = _expandedYear === year;
    const isYearSelected = _filterDate === year;
    const isMonthInYearSelected = typeof _filterDate === 'string' && _filterDate.startsWith(year + '-');
    const monthsAvailable = [...yearMonthMap[year]].sort();

    html += `
      <div data-year-row="${year}" style="margin-bottom:2px;">
        <button type="button" data-toggle-year="${year}"
          style="display:flex;width:100%;align-items:center;justify-content:space-between;
                 padding:7px 10px;border:none;background:transparent;cursor:pointer;
                 font-family:inherit;font-size:0.85rem;border-radius:6px;
                 color:${(isYearSelected || isMonthInYearSelected) ? '#1e40af' : '#1e293b'};
                 font-weight:${(isYearSelected || isMonthInYearSelected) ? '600' : '500'};">
          <span>${year}${isMonthInYearSelected ? ` <small style="color:#64748b;">(${dateFilterLabel(_filterDate)})</small>` : ''}</span>
          <span style="font-size:0.7rem;color:#94a3b8;">${isExpanded ? '▼' : '▶'}</span>
        </button>
        ${isExpanded ? `
          <div style="padding:4px 10px 6px 14px;display:flex;flex-direction:column;gap:2px;">
            <button type="button" data-pick="${year}"
              style="display:block;width:100%;text-align:left;padding:5px 8px;border:none;
                     background:${isYearSelected ? '#dbeafe' : 'transparent'};
                     color:${isYearSelected ? '#1e40af' : '#475569'};
                     font-weight:${isYearSelected ? '600' : '500'};
                     border-radius:5px;cursor:pointer;font-family:inherit;font-size:0.8rem;">
              All ${year}
            </button>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:3px;">
              ${MONTH_OPTIONS.map(m => {
                const code = `${year}-${m.v}`;
                const exists = monthsAvailable.includes(m.v);
                const sel = _filterDate === code;
                return `
                  <button type="button" data-pick="${code}"
                    ${exists ? '' : 'disabled'}
                    style="padding:5px 4px;border:1.5px solid ${sel ? '#2563eb' : '#e2e8f0'};
                           background:${sel ? '#dbeafe' : (exists ? '#fff' : '#f8fafc')};
                           color:${sel ? '#1e40af' : (exists ? '#1e293b' : '#cbd5e1')};
                           border-radius:5px;font-family:inherit;font-size:0.75rem;
                           font-weight:${sel ? '600' : '500'};
                           cursor:${exists ? 'pointer' : 'not-allowed'};">
                    ${m.l}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  menu.innerHTML = html;

  // Year toggle (expand/collapse)
  menu.querySelectorAll('[data-toggle-year]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const year = btn.dataset.toggleYear;
      _expandedYear = (_expandedYear === year) ? null : year;
      renderDatePickerMenu();
    });
  });

  // Pick a value (all / year / year-month)
  menu.querySelectorAll('[data-pick]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _filterDate = btn.dataset.pick;
      updateDateFilterButtonLabel();
      menu.style.display = 'none';
      drawList();
    });
  });
}

function drawList() {
  const search = (document.getElementById('ar-search')?.value || '').toLowerCase().trim();

  let rows = getAbsenceRequests().filter(r => r.status === _activeTab);

  // Type filter
  if (_filterType !== 'all') {
    rows = rows.filter(r => (r.type || 'absence') === _filterType);
  }

  // Category filter (only meaningful for absences)
  if (_filterCategory !== 'all') {
    rows = rows.filter(r => r.category === _filterCategory);
  }

  // Date filter ('all' | 'YYYY' | 'YYYY-MM')
  if (_filterDate !== 'all' && typeof _filterDate === 'string') {
    rows = rows.filter(r => typeof r.date === 'string' && r.date.startsWith(_filterDate));
  }

  if (search) {
    rows = rows.filter(r =>
      (r.employeeName || '').toLowerCase().includes(search)
      || (r.employeeEmail || '').toLowerCase().includes(search)
    );
  }

  if (_sortKey) {
    // User-selected sort
    rows.sort((a, b) => {
      let va, vb;
      if (_sortKey === 'employeeName') {
        va = (a.employeeName || '').toLowerCase();
        vb = (b.employeeName || '').toLowerCase();
      } else if (_sortKey === 'date') {
        va = a.date || '';
        vb = b.date || '';
      } else if (_sortKey === 'typeCategory') {
        // Sort by type first ('absence' < 'permanence'), then category within absences
        va = `${a.type || 'absence'}::${a.category || ''}`;
        vb = `${b.type || 'absence'}::${b.category || ''}`;
      } else if (_sortKey === 'reason') {
        va = (a.reason || '').toLowerCase();
        vb = (b.reason || '').toLowerCase();
      } else if (_sortKey === 'status') {
        va = a.status || '';
        vb = b.status || '';
      } else {
        va = ''; vb = '';
      }
      if (va < vb) return _sortDir === 'asc' ? -1 : 1;
      if (va > vb) return _sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  } else {
    // Default: pending oldest first (FIFO), others newest first
    rows.sort((a, b) => {
      if (_activeTab === 'pending') return (a.requestedAt || 0) - (b.requestedAt || 0);
      return (b.reviewedAt || b.requestedAt || 0) - (a.reviewedAt || a.requestedAt || 0);
    });
  }

  // Update sort icons on the headers
  document.querySelectorAll('#ar-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.key === _sortKey) {
      th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = _sortDir === 'asc' ? '↑' : '↓';
    } else {
      if (icon) icon.textContent = '↕';
    }
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
