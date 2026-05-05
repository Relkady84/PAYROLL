/**
 * Employee Portal — mobile-first self-service.
 *
 * Sections (accessed via burger menu):
 *   - home:    Submit new absence request + recent requests
 *   - payslip: Live pay-slip calculator with month picker + PDF download
 *   - history: All absences with filters
 *
 * Renders inside #employee-portal-screen.
 */

import {
  loadOwnAbsenceRequests,
  addOwnAbsenceRequest,
  deleteOwnAbsenceRequest,
  getAbsenceRequests,
  getEmployeeRecord,
  getCompanyMetadataFor,
  getSettingsFor
} from '../data/store.js';
import {
  ABSENCE_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
  MAX_BACKDATE_DAYS,
  validateAbsenceRequest,
  createAbsenceRequest,
  todayISO,
  dateNDaysAgo,
  countApprovedAbsencesInMonth
} from '../models/absenceRequest.js';
import { calculateNetSalary } from '../services/payroll.js';
import { signOutUser } from '../auth.js';

// ── State ─────────────────────────────────────────────
let _user        = null;
let _employee    = null;
let _companyId   = null;
let _companyName = '';
let _companyLogo = '';
let _settings    = null;

let _section     = 'home';            // 'home' | 'payslip' | 'history'
let _drawerOpen  = false;

// pay slip month state (YYYY-MM)
let _paySlipMonth = null;

// history filter state
let _histStatus   = 'all';            // 'all' | 'pending' | 'approved' | 'rejected'
let _histCategory = 'all';            // 'all' | 'sick' | ...

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Entry ──────────────────────────────────────────────
export async function renderEmployeePortal({ user, companyId, employeeId }) {
  _user      = user;
  _companyId = companyId;

  const screen = document.getElementById('employee-portal-screen');
  screen.style.display = 'flex';

  // Load employee + metadata + settings + own requests in parallel
  const [emp, meta, settings] = await Promise.all([
    getEmployeeRecord(companyId, employeeId),
    getCompanyMetadataFor(companyId),
    getSettingsFor(companyId)
  ]);

  if (!emp) {
    screen.innerHTML = errorShellHTML('We could not find your employee record. Please contact your administrator.');
    bindSignOut();
    return;
  }

  _employee     = emp;
  _companyName  = meta?.name    || '—';
  _companyLogo  = meta?.logoUrl || '';
  _settings     = settings;
  _paySlipMonth = _paySlipMonth || defaultMonth();

  await loadOwnAbsenceRequests(companyId, employeeId);
  draw();
}

// ── Top-level render ─────────────────────────────────────
function draw() {
  const screen = document.getElementById('employee-portal-screen');
  screen.innerHTML = `
    <div class="ep-shell">
      ${headerHTML()}
      ${drawerHTML()}
      <main class="ep-main" id="ep-main">
        ${renderSection()}
      </main>
    </div>
  `;

  bindGlobalEvents();
  bindSectionEvents();
}

function renderSection() {
  if (_section === 'payslip') return paySlipSectionHTML();
  if (_section === 'history') return historySectionHTML();
  return homeSectionHTML();
}

// ── Header (with burger button) ──────────────────────────
function headerHTML() {
  const logoMarkup = _companyLogo
    ? `<img src="${esc(_companyLogo)}" alt="" class="ep-logo-img">`
    : `<span class="ep-logo">🏫</span>`;

  return `
    <header class="ep-header">
      <button id="ep-burger" class="ep-burger" aria-label="Open menu">☰</button>
      <div class="ep-header-title">
        ${logoMarkup}
        <div>
          <div class="ep-header-name">${esc(_companyName)}</div>
          <div class="ep-header-sub">${esc(sectionTitle(_section))}</div>
        </div>
      </div>
    </header>
  `;
}

function sectionTitle(section) {
  if (section === 'payslip') return 'My Pay Slip';
  if (section === 'history') return 'Absence History';
  return 'Employee Portal';
}

// ── Drawer (slide-out menu) ──────────────────────────────
function drawerHTML() {
  const fullName = `${_employee.firstName || ''} ${_employee.lastName || ''}`.trim();
  const typeLabel = _employee.employeeType === 'Admin' ? 'Administrator' : 'Teacher';

  const item = (id, icon, label) => `
    <button class="ep-drawer-item ${_section === id ? 'active' : ''}" data-section="${id}">
      <span class="ep-drawer-icon">${icon}</span>
      <span>${label}</span>
    </button>
  `;

  return `
    <div class="ep-drawer-overlay ${_drawerOpen ? 'open' : ''}" id="ep-drawer-overlay"></div>
    <aside class="ep-drawer ${_drawerOpen ? 'open' : ''}" id="ep-drawer" aria-hidden="${!_drawerOpen}">
      <div class="ep-drawer-header">
        <div class="ep-drawer-avatar">${initials(fullName)}</div>
        <div class="ep-drawer-user">
          <div class="ep-drawer-name">${esc(fullName)}</div>
          <div class="ep-drawer-meta">${esc(typeLabel)}</div>
        </div>
      </div>

      <nav class="ep-drawer-nav">
        ${item('home',    '🏠', 'Home')}
        ${item('payslip', '💰', 'My Pay Slip')}
        ${item('history', '📋', 'Absence History')}
      </nav>

      <div class="ep-drawer-footer">
        <button id="ep-signout" class="ep-link-btn">Sign out</button>
      </div>
    </aside>
  `;
}

// ── Section: HOME ────────────────────────────────────────
function homeSectionHTML() {
  const requests = [...getAbsenceRequests()]
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0))
    .slice(0, 5); // recent only — full list lives in History

  return `
    ${greetingCardHTML()}
    ${requestFormCardHTML()}
    ${recentRequestsHTML(requests)}
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
        <div class="ep-hint">From ${earliest} to any future date.</div>

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

function recentRequestsHTML(requests) {
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
      <div class="ep-card-title">
        📋 Recent Requests
        <button class="ep-link-btn" data-section="history" style="float:right;font-size:0.78rem;">View all →</button>
      </div>
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

// ── Section: PAY SLIP ────────────────────────────────────
function paySlipSectionHTML() {
  const [y, m] = _paySlipMonth.split('-').map(Number);
  const absences = countApprovedAbsencesInMonth(getAbsenceRequests(), _employee.id, y, m);
  const days = Math.max(0, _settings.workingDaysPerMonth - absences);
  const calc = calculateNetSalary(_employee, _settings, days);

  const monthLabel = new Date(`${_paySlipMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric'
  });

  const fmtLBP = n => Math.round(n).toLocaleString('en-US') + ' ل.ل';
  const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
    <section class="ep-card">
      <div class="ep-card-title">💰 Pay Slip</div>

      <label class="ep-label" for="ep-payslip-month">Month</label>
      <input class="ep-input" type="month" id="ep-payslip-month" value="${_paySlipMonth}" max="${defaultMonth()}">
    </section>

    <section class="ep-card ep-payslip">
      <div class="ep-payslip-period">${esc(monthLabel)}</div>
      <div class="ep-payslip-name">${esc(_employee.firstName)} ${esc(_employee.lastName)}</div>
      <div class="ep-payslip-type">${esc(_employee.employeeType === 'Admin' ? 'Administrator' : 'Teacher')}</div>

      <div class="ep-payslip-section">
        <div class="ep-payslip-row">
          <span>Base Salary</span>
          <strong>${fmtLBP(calc.baseSalaryLBP)}</strong>
        </div>
        <div class="ep-payslip-sub">${fmtUSD(calc.baseSalaryUSD)}</div>
      </div>

      <div class="ep-payslip-section">
        <div class="ep-payslip-row">
          <span>Working days this month</span>
          <strong>${days}</strong>
        </div>
        ${absences > 0 ? `
          <div class="ep-payslip-sub">
            ${_settings.workingDaysPerMonth} − ${absences} approved absence${absences !== 1 ? 's' : ''}
          </div>
        ` : `
          <div class="ep-payslip-sub">No absences this month.</div>
        `}
      </div>

      <div class="ep-payslip-section">
        <div class="ep-payslip-row">
          <span>Transport / day</span>
          <strong>${fmtLBP(calc.transportPerDayLBP)}</strong>
        </div>
        <div class="ep-payslip-row">
          <span>Total Transport (× ${days} days)</span>
          <strong>${fmtLBP(calc.totalTransportLBP)}</strong>
        </div>
        <div class="ep-payslip-sub">${fmtUSD(calc.totalTransportUSD)}</div>
      </div>

      <div class="ep-payslip-section">
        <div class="ep-payslip-row ep-deduction">
          <span>Tax</span>
          <strong>− ${fmtLBP(calc.taxLBP)}</strong>
        </div>
        <div class="ep-payslip-row ep-deduction">
          <span>NFS / NSSF</span>
          <strong>− ${fmtLBP(calc.nfsLBP)}</strong>
        </div>
      </div>

      <div class="ep-payslip-net">
        <div class="ep-payslip-net-label">Net Salary</div>
        <div class="ep-payslip-net-lbp">${fmtLBP(calc.netSalaryLBP)}</div>
        <div class="ep-payslip-net-usd">${fmtUSD(calc.netSalaryUSD)}</div>
      </div>

      <button class="ep-btn ep-btn-primary" id="ep-payslip-pdf">⬇ Download PDF</button>

      <div class="ep-hint" style="text-align:center;margin-top:8px;">
        Calculated from current settings. For official records, contact your administrator.
      </div>
    </section>
  `;
}

// ── Section: HISTORY ─────────────────────────────────────
function historySectionHTML() {
  let rows = [...getAbsenceRequests()];
  if (_histStatus !== 'all')   rows = rows.filter(r => r.status === _histStatus);
  if (_histCategory !== 'all') rows = rows.filter(r => r.category === _histCategory);

  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const counts = {
    total:    getAbsenceRequests().length,
    pending:  getAbsenceRequests().filter(r => r.status === 'pending').length,
    approved: getAbsenceRequests().filter(r => r.status === 'approved').length,
    rejected: getAbsenceRequests().filter(r => r.status === 'rejected').length
  };

  return `
    <section class="ep-card">
      <div class="ep-card-title">📋 Absence History</div>

      <div class="ep-stat-grid">
        <div class="ep-stat"><div class="ep-stat-value">${counts.total}</div><div class="ep-stat-label">Total</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#92400e;">${counts.pending}</div><div class="ep-stat-label">Pending</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#166534;">${counts.approved}</div><div class="ep-stat-label">Approved</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#991b1b;">${counts.rejected}</div><div class="ep-stat-label">Rejected</div></div>
      </div>

      <label class="ep-label">Filter by status</label>
      <select class="ep-input" id="ep-hist-status">
        <option value="all"      ${_histStatus === 'all'      ? 'selected' : ''}>All</option>
        <option value="pending"  ${_histStatus === 'pending'  ? 'selected' : ''}>Pending</option>
        <option value="approved" ${_histStatus === 'approved' ? 'selected' : ''}>Approved</option>
        <option value="rejected" ${_histStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
      </select>

      <label class="ep-label" style="margin-top:10px;">Filter by category</label>
      <select class="ep-input" id="ep-hist-category">
        <option value="all" ${_histCategory === 'all' ? 'selected' : ''}>All</option>
        ${ABSENCE_CATEGORIES.map(c =>
          `<option value="${c}" ${_histCategory === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`
        ).join('')}
      </select>
    </section>

    ${rows.length ? `
      <section class="ep-card">
        <div class="ep-card-title">${rows.length} request${rows.length !== 1 ? 's' : ''}</div>
        <div class="ep-list">
          ${rows.map(r => requestItemHTML(r)).join('')}
        </div>
      </section>
    ` : `
      <section class="ep-card ep-empty">
        <div class="ep-empty-icon">📭</div>
        <div class="ep-empty-text">No requests match.</div>
      </section>
    `}
  `;
}

// ── Events ──────────────────────────────────────────────
function bindGlobalEvents() {
  // Burger
  document.getElementById('ep-burger').addEventListener('click', () => {
    _drawerOpen = true;
    document.getElementById('ep-drawer').classList.add('open');
    document.getElementById('ep-drawer-overlay').classList.add('open');
  });

  // Drawer overlay close
  document.getElementById('ep-drawer-overlay').addEventListener('click', closeDrawer);

  // Drawer items
  document.querySelectorAll('.ep-drawer-item').forEach(btn => {
    btn.addEventListener('click', () => {
      _section = btn.dataset.section;
      closeDrawer();
      draw();
    });
  });

  // Sign out
  bindSignOut();
}

function bindSectionEvents() {
  if (_section === 'home') {
    bindFormEvents();
    bindListEvents();
    // Also handle the "View all →" shortcut button
    document.querySelectorAll('[data-section]').forEach(b => {
      if (!b.classList.contains('ep-drawer-item')) {
        b.addEventListener('click', () => {
          _section = b.dataset.section;
          draw();
        });
      }
    });
  } else if (_section === 'payslip') {
    bindPaySlipEvents();
  } else if (_section === 'history') {
    bindHistoryEvents();
    bindListEvents();
  }
}

function bindFormEvents() {
  const form = document.getElementById('ep-form');
  if (!form) return;
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

function bindPaySlipEvents() {
  document.getElementById('ep-payslip-month').addEventListener('change', e => {
    _paySlipMonth = e.target.value || defaultMonth();
    draw();
  });

  document.getElementById('ep-payslip-pdf').addEventListener('click', () => {
    generatePaySlipPDF();
  });
}

function bindHistoryEvents() {
  document.getElementById('ep-hist-status').addEventListener('change', e => {
    _histStatus = e.target.value;
    draw();
  });
  document.getElementById('ep-hist-category').addEventListener('change', e => {
    _histCategory = e.target.value;
    draw();
  });
}

function closeDrawer() {
  _drawerOpen = false;
  document.getElementById('ep-drawer')?.classList.remove('open');
  document.getElementById('ep-drawer-overlay')?.classList.remove('open');
}

function bindSignOut() {
  const btn = document.getElementById('ep-signout');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await signOutUser();
  });
}

// ── PDF generation ─────────────────────────────────────
function generatePaySlipPDF() {
  if (!window.jspdf) {
    alert('PDF library not loaded. Try refreshing.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const [y, m] = _paySlipMonth.split('-').map(Number);
  const absences = countApprovedAbsencesInMonth(getAbsenceRequests(), _employee.id, y, m);
  const days = Math.max(0, _settings.workingDaysPerMonth - absences);
  const calc = calculateNetSalary(_employee, _settings, days);

  const monthLabel = new Date(`${_paySlipMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric'
  });

  const fmtLBP = n => Math.round(n).toLocaleString('en-US') + ' LBP';
  const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Header
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(_companyName, 14, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Pay Slip', 14, 22);

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(`Period: ${monthLabel}`, 196, 13, { align: 'right' });
  doc.text(`Issued: ${new Date().toLocaleDateString()}`, 196, 22, { align: 'right' });

  // Employee info
  let yPos = 42;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${_employee.firstName} ${_employee.lastName}`, 14, yPos);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${_employee.employeeType === 'Admin' ? 'Administrator' : 'Teacher'}`, 14, yPos + 6);
  if (_employee.email) doc.text(_employee.email, 14, yPos + 11);

  doc.setTextColor(0);
  yPos += 24;

  // Earnings section
  const drawRow = (label, value, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.indent) doc.setTextColor(120);
    else doc.setTextColor(0);
    doc.text(label, 14 + (opts.indent || 0), yPos);
    if (value !== undefined) doc.text(value, 196, yPos, { align: 'right' });
    yPos += opts.gap || 6;
  };

  doc.setDrawColor(220);
  doc.line(14, yPos, 196, yPos);
  yPos += 6;

  drawRow('EARNINGS', '', { bold: true });
  drawRow('Base Salary', fmtLBP(calc.baseSalaryLBP));
  drawRow(fmtUSD(calc.baseSalaryUSD), '', { indent: 4, size: 8 });
  yPos += 2;
  drawRow('Working days this month', String(days));
  if (absences > 0) {
    drawRow(`(${_settings.workingDaysPerMonth} - ${absences} approved absence${absences !== 1 ? 's' : ''})`, '', { indent: 4, size: 8 });
  }
  yPos += 2;
  drawRow('Transport / day', fmtLBP(calc.transportPerDayLBP));
  drawRow(`Total Transport (x ${days} days)`, fmtLBP(calc.totalTransportLBP));
  drawRow(fmtUSD(calc.totalTransportUSD), '', { indent: 4, size: 8 });

  yPos += 4;
  doc.line(14, yPos, 196, yPos);
  yPos += 6;

  drawRow('DEDUCTIONS', '', { bold: true });
  doc.setTextColor(220, 38, 38);
  drawRow('Tax', '- ' + fmtLBP(calc.taxLBP));
  drawRow('NFS / NSSF', '- ' + fmtLBP(calc.nfsLBP));
  doc.setTextColor(0);

  yPos += 4;
  doc.line(14, yPos, 196, yPos);
  yPos += 8;

  // Net salary box
  doc.setFillColor(220, 252, 231);  // #dcfce7
  doc.rect(14, yPos - 6, 182, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NET SALARY', 18, yPos);
  doc.setFontSize(15);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text(fmtLBP(calc.netSalaryLBP), 192, yPos, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtUSD(calc.netSalaryUSD), 192, yPos + 7, { align: 'right' });

  yPos += 28;
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text('Generated by Payroll System. For official records, contact your administrator.', 105, yPos, { align: 'center' });

  const filename = `payslip-${_employee.firstName}-${_employee.lastName}-${_paySlipMonth}.pdf`
    .replace(/\s+/g, '-').toLowerCase();
  doc.save(filename);
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
