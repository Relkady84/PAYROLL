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
  getSettingsFor,
  getCalendarFor,
  getAcademicYearFor,
  getRoleRegistryFor,
  getMyNotes,
  addMyNote,
  updateMyNote,
  deleteMyNote
} from '../data/store.js';
import {
  ABSENCE_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  MAX_BACKDATE_DAYS,
  validateAbsenceRequest,
  createAbsenceRequest,
  todayISO,
  dateNDaysAgo
} from '../models/absenceRequest.js';
import { calculateNetSalary, computeEffectiveDays } from '../services/payroll.js';
import { signOutUser } from '../auth.js';
import { t, getLanguage, setLanguage, SUPPORTED_LANGUAGES } from '../i18n.js';
import { showToast } from './components/toast.js';

// ── State ─────────────────────────────────────────────
let _user        = null;
let _employee    = null;
let _companyId   = null;
let _companyName = '';
let _companyLogo = '';
let _quickLinks  = null;        // [{ label, url, icon }, ...] from company metadata, or defaults
let _settings    = null;
let _calendar    = null;
let _roleRegistry = null;
let _academicYearsCache = {};   // yearId -> year doc, lazy-loaded

// Default quick-launch tools shown on Home if the company hasn't configured custom ones.
// All icons are inline SVG data URLs — guaranteed to load offline, no CSP/CORS/network issues.
function svgDataUrl(svgText) {
  // URL-encode rather than base64 — smaller and works without btoa
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgText);
}

// Brand SVGs (using the simple-icons paths, color-fill the brand color)
const SVG_OUTLOOK = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0078D4"/><path fill="#fff" d="M7 10.5q-.5 0-.85.4t-.35 1.1q0 .7.35 1.1.35.4.85.4t.85-.4q.35-.4.35-1.1 0-.7-.35-1.1Q7.5 10.5 7 10.5zM7 9q1.1 0 1.85.85.75.85.75 2.15 0 1.3-.75 2.15Q8.1 15 7 15q-1.1 0-1.85-.85Q4.4 13.3 4.4 12q0-1.3.75-2.15Q5.9 9 7 9zm6 1.5h-2v-1l3-1V18h-1v-7.5z"/></svg>`);

const SVG_SHAREPOINT = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#036C70"/><path fill="#fff" d="M11.5 7c2.5 0 4 1.4 4 3.5 0 2.4-2 3.6-4.5 3.6h-.5V17H8.5V7h3zm-.5 5.6h.4c1.5 0 2.4-.6 2.4-1.9 0-1.2-.8-1.8-2.3-1.8H11v3.7z"/></svg>`);

// Letter-based icon helper — colored square with a white letter (used for sites without a brand SVG)
function letterIcon(letter, bgColor) {
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${bgColor}"/><text x="12" y="17" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="14" fill="#fff">${letter}</text></svg>`);
}

const SVG_PRONOTE = letterIcon('P', '#16a34a');   // green
const SVG_PADLET  = letterIcon('P', '#ea580c');   // orange
const SVG_SCHOOL  = letterIcon('🏫', '#1e3a8a');  // blue with school emoji

const DEFAULT_QUICK_LINKS = [
  { id: 'pronote',    tKey: 'quicklinks.pronote',    url: 'https://2050048n.index-education.net/pronote/', icon: SVG_PRONOTE },
  { id: 'website',    tKey: 'quicklinks.website',    url: 'https://www.lycee-montaigne.edu.lb/',          icon: SVG_SCHOOL },
  { id: 'outlook',    tKey: 'quicklinks.outlook',    url: 'https://outlook.office365.com/',               icon: SVG_OUTLOOK },
  { id: 'sharepoint', tKey: 'quicklinks.sharepoint', url: 'https://sharepoint-explorer.web.app/',         icon: SVG_SHAREPOINT },
  { id: 'padlet',     tKey: 'quicklinks.padlet',     url: 'https://padlet.com/michelinechaaban/bonne-rentree-2025-ipmmo5sypaxr4pl7', icon: SVG_PADLET }
];

// Resolve a link's display label — uses tKey for translation if present, else literal label
function linkLabel(link) {
  if (link.tKey) return t(link.tKey);
  return link.label || '';
}

// Render the icon for a link — supports image URLs (http(s):), inline SVG (data:), OR emoji
function renderLinkIcon(icon) {
  if (!icon) return '<span style="font-size:1.6rem;">🔗</span>';
  // Detect any image source (http URL or inline data URL)
  if (/^(https?:|data:)/.test(icon)) {
    // If the image fails to load, hide it and show 🔗 fallback emoji
    return `<img src="${esc(icon)}" alt="" referrerpolicy="no-referrer"
              style="width:36px;height:36px;object-fit:contain;forced-color-adjust:none;filter:none;"
              onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=&quot;font-size:1.6rem;&quot;>🔗</span>')">`;
  }
  // Otherwise treat as emoji/text
  return `<span style="font-size:1.6rem;">${esc(icon)}</span>`;
}

// Sub-tab state inside the Attendance section
let _attendanceTab = 'request';   // 'request' | 'history'

let _section     = 'home';            // 'home' | 'payslip' | 'history'
let _drawerOpen  = false;

// pay slip month state (YYYY-MM)
let _paySlipMonth = null;

// history filter state
let _histStatus     = 'all';          // 'all' | 'pending' | 'approved' | 'rejected'
let _histCategory   = 'all';          // 'all' | 'sick' | ...

// Notes state
let _notes          = [];             // array of { id, title, body, updatedAt }
let _editingNoteId  = null;           // null = list view; 'new' = new note; otherwise editing this id
let _histDate       = 'all';          // 'all' | 'YYYY' | 'YYYY-MM'
let _histExpandedY  = null;           // for the date picker: which year is currently expanded
let _histDateOpen   = false;          // is the date picker menu open?

const HIST_MONTH_OPTIONS = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Apr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' }, { v: '09', l: 'Sep' },
  { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' }
];

function histDateLabel(filter) {
  if (filter === 'all' || !filter) return 'All dates';
  if (/^\d{4}$/.test(filter)) return `All ${filter}`;
  if (/^\d{4}-\d{2}$/.test(filter)) {
    const m = HIST_MONTH_OPTIONS.find(x => x.v === filter.slice(5, 7));
    return `${m ? m.l : ''} ${filter.slice(0, 4)}`.trim();
  }
  return 'All dates';
}

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

  // Load employee + metadata + settings + calendar + role registry + own requests in parallel
  const [emp, meta, settings, calendar, roleRegistry] = await Promise.all([
    getEmployeeRecord(companyId, employeeId),
    getCompanyMetadataFor(companyId),
    getSettingsFor(companyId),
    getCalendarFor(companyId),
    getRoleRegistryFor(companyId)
  ]);

  if (!emp) {
    screen.innerHTML = errorShellHTML('We could not find your employee record. Please contact your administrator.');
    bindSignOut();
    return;
  }

  _employee     = emp;
  _companyName  = meta?.name    || '—';
  _companyLogo  = meta?.logoUrl || '';
  _quickLinks   = (Array.isArray(meta?.quickLinks) && meta.quickLinks.length)
    ? meta.quickLinks
    : DEFAULT_QUICK_LINKS;
  _settings     = settings;
  _calendar     = calendar;
  _roleRegistry = roleRegistry;
  _paySlipMonth = _paySlipMonth || defaultMonth();

  await loadOwnAbsenceRequests(companyId, employeeId);
  // Pre-fetch the academic year covering the current pay-slip month so the breakdown is correct on first render
  await findAcademicYearForMonth();
  // Load private notes (only this user can read them)
  try {
    _notes = await getMyNotes(user.uid);
  } catch (e) {
    console.warn('Could not load notes:', e);
    _notes = [];
  }
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
  if (_section === 'payslip')    return paySlipSectionHTML();
  if (_section === 'attendance') return attendanceSectionHTML();
  if (_section === 'notes')      return notesSectionHTML();
  return homeSectionHTML();
}

// ── Header (with burger button) ──────────────────────────
function headerHTML() {
  const logoMarkup = _companyLogo
    ? `<img src="${esc(_companyLogo)}" alt="" class="ep-logo-img">`
    : `<span class="ep-logo">🏫</span>`;

  // Show a home button on the right when user is not already on home
  const homeBtn = _section !== 'home' ? `
    <button id="ep-home-btn" class="ep-burger" aria-label="${esc(t('portal.home.go_home'))}"
      title="${esc(t('portal.home.go_home'))}"
      style="margin-left:auto;">🏠</button>
  ` : '';

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
      ${homeBtn}
    </header>
  `;
}

function sectionTitle(section) {
  if (section === 'payslip')    return t('portal.payslip_title');
  if (section === 'attendance') return t('portal.attendance_title');
  if (section === 'notes')      return t('portal.notes_title');
  return t('portal.title');
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
        <button id="ep-drawer-close" aria-label="Close menu"
          style="background:rgba(255,255,255,0.12);color:#fff;border:none;
                 width:34px;height:34px;border-radius:8px;font-size:1.1rem;
                 cursor:pointer;font-family:inherit;flex-shrink:0;
                 display:flex;align-items:center;justify-content:center;">×</button>
      </div>

      <nav class="ep-drawer-nav">
        ${item('home',       '🏠', t('portal.drawer.home'))}
        ${item('attendance', '📅', t('portal.drawer.attendance'))}
        ${item('payslip',    '💰', t('portal.drawer.payslip'))}
        ${item('notes',      '🔐', t('portal.drawer.notes'))}
      </nav>

      <div class="ep-drawer-footer">
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px;">
          ${SUPPORTED_LANGUAGES.map(lang => `
            <button type="button" data-lang="${lang.code}"
              style="padding:4px 10px;border:1.5px solid ${getLanguage() === lang.code ? '#2563eb' : '#e2e8f0'};
                     border-radius:6px;background:${getLanguage() === lang.code ? '#dbeafe' : '#fff'};
                     color:${getLanguage() === lang.code ? '#1e40af' : '#64748b'};
                     font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;
                     display:inline-flex;align-items:center;gap:4px;">
              <span>${lang.flag}</span><span>${lang.label}</span>
            </button>
          `).join('')}
        </div>
        <button id="ep-signout" class="ep-link-btn">${esc(t('common.signout'))}</button>
      </div>
    </aside>
  `;
}

// ── Section: HOME (dashboard) ────────────────────────────
function homeSectionHTML() {
  const all      = getAbsenceRequests();
  const pending  = all.filter(r => r.status === 'pending').length;
  const approved = all.filter(r => r.status === 'approved').length;

  // Days for current month
  const now      = new Date();
  const monthIdx = now.getMonth() + 1;
  const yr       = now.getFullYear();
  let daysThisMonth = 0;
  let daysTotal     = _settings?.workingDaysPerMonth || 22;
  try {
    const probe   = `${yr}-${String(monthIdx).padStart(2, '0')}-15`;
    const candId  = monthIdx >= 8 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
    const ay      = _academicYearsCache[candId] || null;
    const bd      = computeEffectiveDays({
      employee:        _employee,
      calendar:        _calendar,
      absenceRequests: all,
      year:            yr,
      month:           monthIdx,
      academicYear:    ay,
      roleRegistry:    _roleRegistry
    });
    daysThisMonth = bd.days;
    daysTotal     = bd.calendarDays || daysTotal;
  } catch {}

  const todayLabel = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `
    ${greetingCardHTML(todayLabel)}

    <!-- Quick stats -->
    <section class="ep-card">
      <div class="ep-stat-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="ep-stat">
          <div class="ep-stat-value">${daysThisMonth}<span style="font-size:0.7rem;color:#94a3b8;">/${daysTotal}</span></div>
          <div class="ep-stat-label">${esc(t('portal.home.days_month'))}</div>
        </div>
        <div class="ep-stat">
          <div class="ep-stat-value" style="color:${pending > 0 ? '#92400e' : '#1e293b'};">${pending}</div>
          <div class="ep-stat-label">${esc(t('portal.home.pending'))}</div>
        </div>
        <div class="ep-stat">
          <div class="ep-stat-value" style="color:#166534;">${approved}</div>
          <div class="ep-stat-label">${esc(t('portal.home.approved'))}</div>
        </div>
      </div>
    </section>

    <!-- Quick tools -->
    <section class="ep-card">
      <div class="ep-card-title">🔗 ${esc(t('portal.home.tools'))}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;">
        ${(_quickLinks || []).map(link => `
          <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer"
             style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:14px 8px;border:1.5px solid #e2e8f0;border-radius:12px;
                    background:#f8fafc;text-decoration:none;color:#1e293b;
                    transition:transform 0.1s, box-shadow 0.1s;cursor:pointer;text-align:center;
                    forced-color-adjust:none;"
             onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';"
             onmouseout="this.style.transform='';this.style.boxShadow='';">
            <div style="margin-bottom:6px;height:36px;display:flex;align-items:center;justify-content:center;">
              ${renderLinkIcon(link.icon)}
            </div>
            <div style="font-size:0.72rem;font-weight:600;line-height:1.2;">${esc(linkLabel(link))}</div>
          </a>
        `).join('')}
      </div>
    </section>

    <!-- Quick actions -->
    <section class="ep-card">
      <div class="ep-card-title">⚡ ${esc(t('portal.home.actions'))}</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="ep-btn ep-btn-primary" data-go-section="attendance" data-attendance-tab="request">
          ${esc(t('portal.home.attendance_btn'))}
        </button>
        <button class="ep-btn" data-go-section="payslip"
          style="background:#dbeafe;color:#1e40af;border:1.5px solid #bfdbfe;">
          ${esc(t('portal.home.payslip_btn'))}
        </button>
        <button class="ep-btn" data-go-section="notes"
          style="background:#fef3c7;color:#92400e;border:1.5px solid #fde68a;">
          ${esc(t('portal.home.notes_btn'))}
        </button>
      </div>
    </section>
  `;
}

// ── Section: ATTENDANCE (Request + History tabs) ─────────
function attendanceSectionHTML() {
  const tabBtn = (id, icon, label) => `
    <button class="ep-att-tab ${_attendanceTab === id ? 'active' : ''}" data-att-tab="${id}"
      style="flex:1;padding:10px 14px;border:none;background:${_attendanceTab === id ? '#2563eb' : '#f1f5f9'};
             color:${_attendanceTab === id ? '#fff' : '#475569'};
             font-weight:600;font-size:0.88rem;font-family:inherit;cursor:pointer;
             border-radius:8px;transition:all 0.15s;">
      ${icon} ${esc(label)}
    </button>
  `;

  const tabsHTML = `
    <section class="ep-card">
      <div style="display:flex;gap:6px;background:#e2e8f0;padding:4px;border-radius:10px;">
        ${tabBtn('request', '📝', t('portal.attendance.tab_request'))}
        ${tabBtn('history', '📋', t('portal.attendance.tab_history'))}
      </div>
    </section>
  `;

  if (_attendanceTab === 'history') {
    return tabsHTML + historySectionHTML();
  }

  // Request tab — show both forms (Absence + Permanence)
  return `
    ${tabsHTML}
    ${absenceFormCardHTML()}
    ${permanenceFormCardHTML()}
  `;
}

function greetingCardHTML(todayLabel = '') {
  const fullName  = `${_employee.firstName || ''} ${_employee.lastName || ''}`.trim();
  const typeLabel = _employee.employeeType === 'Admin'
    ? t('portal.role.administrator')
    : t('portal.role.teacher');
  return `
    <section class="ep-card ep-greeting">
      <div class="ep-avatar">${initials(fullName)}</div>
      <div class="ep-greeting-text">
        <div class="ep-greeting-name">${esc(t('portal.greeting', { name: _employee.firstName || '' }))}</div>
        <div class="ep-greeting-meta">${esc(typeLabel)}${_employee.homeLocation ? ' · ' + esc(_employee.homeLocation) : ''}</div>
        ${todayLabel ? `<div style="font-size:0.75rem;color:#64748b;margin-top:6px;">📅 ${esc(todayLabel)}</div>` : ''}
      </div>
    </section>
  `;
}

function absenceFormCardHTML() {
  const today    = todayISO();
  const earliest = dateNDaysAgo(MAX_BACKDATE_DAYS);
  return `
    <section class="ep-card ep-form-card">
      <div class="ep-card-title">${esc(t('portal.absence.title'))}</div>

      <form id="ep-form" novalidate>
        <label class="ep-label" for="ep-date">${esc(t('portal.absence.date'))}</label>
        <input class="ep-input" type="date" id="ep-date"
          min="${earliest}" value="${today}" required>
        <div class="ep-hint">${esc(t('portal.absence.date_hint', { earliest }))}</div>

        <label class="ep-label" for="ep-category">${esc(t('portal.absence.category'))}</label>
        <select class="ep-input" id="ep-category" required>
          ${ABSENCE_CATEGORIES.map(c =>
            `<option value="${c}">${esc(t('category.' + c))}</option>`
          ).join('')}
        </select>

        <label class="ep-label" for="ep-reason">
          ${esc(t('portal.absence.reason'))} <span id="ep-reason-required" class="ep-muted"></span>
        </label>
        <textarea class="ep-input" id="ep-reason" rows="3"
          maxlength="500"
          placeholder="${esc(t('portal.absence.placeholder'))}"></textarea>

        <div id="ep-form-errors" class="ep-errors"></div>

        <button type="submit" class="ep-btn ep-btn-primary">
          ${esc(t('portal.absence.submit'))}
        </button>
      </form>
    </section>
  `;
}

function permanenceFormCardHTML() {
  const today    = todayISO();
  const earliest = dateNDaysAgo(MAX_BACKDATE_DAYS);
  return `
    <section class="ep-card ep-form-card">
      <div class="ep-card-title">${esc(t('portal.permanence.title'))}</div>

      <form id="ep-perm-form" novalidate>
        <label class="ep-label" for="ep-perm-date">${esc(t('portal.permanence.date'))}</label>
        <input class="ep-input" type="date" id="ep-perm-date"
          min="${earliest}" value="${today}" required>
        <div class="ep-hint">${esc(t('portal.absence.date_hint', { earliest }))}</div>

        <label class="ep-label" for="ep-perm-reason">
          ${esc(t('portal.permanence.reason'))} <span class="ep-muted">${esc(t('common.required'))}</span>
        </label>
        <textarea class="ep-input" id="ep-perm-reason" rows="3"
          maxlength="500"
          placeholder="${esc(t('portal.permanence.placeholder'))}"></textarea>

        <div id="ep-perm-form-errors" class="ep-errors"></div>

        <button type="submit" class="ep-btn ep-btn-primary">
          ${esc(t('portal.permanence.submit'))}
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
  const type    = r.type || 'absence';
  const cat     = type === 'permanence' ? '🎯 Permanence (+1 day)' : (CATEGORY_LABELS[r.category] || r.category);
  const status  = r.status || 'pending';
  return `
    <div class="ep-request" data-id="${esc(r.id)}" data-type="${esc(type)}">
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

/** Find the academic year (cached) that contains the given mid-month probe ISO date. */
async function findAcademicYearForMonth(yearId) {
  // We don't know the yearIds — fetch via getAcademicYearFor for likely candidates.
  // Heuristic: try yearId derived from the month's year, e.g. "2026-2027" if month is in 2026 (>=Aug) or 2027 (<=Jul).
  const probe = `${_paySlipMonth}-15`;
  const [y, m] = _paySlipMonth.split('-').map(Number);
  const candidates = m >= 8 ? [`${y}-${y + 1}`] : [`${y - 1}-${y}`];
  for (const id of candidates) {
    if (!_academicYearsCache[id]) {
      _academicYearsCache[id] = await getAcademicYearFor(_companyId, id);
    }
    const yr = _academicYearsCache[id];
    if (yr && yr.startDate && yr.endDate && probe >= yr.startDate && probe <= yr.endDate) {
      return yr;
    }
  }
  return null;
}

// ── Section: PAY SLIP ────────────────────────────────────
function paySlipSectionHTML() {
  const [y, m] = _paySlipMonth.split('-').map(Number);
  // Use synchronously-loaded year if cached; otherwise compute without active periods.
  const probe = `${_paySlipMonth}-15`;
  const candidateId = m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const academicYear = _academicYearsCache[candidateId] || null;

  const bd = computeEffectiveDays({
    employee:        _employee,
    calendar:        _calendar,
    absenceRequests: getAbsenceRequests(),
    year:            y,
    month:           m,
    academicYear,
    roleRegistry:    _roleRegistry
  });
  const days = bd.days;
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
        <div class="ep-payslip-sub">
          ${(() => {
            const parts = [`${bd.calendarDays} from calendar${bd.holidays > 0 ? ` (after ${bd.holidays} holiday${bd.holidays !== 1 ? 's' : ''})` : ''}`];
            if (bd.absences   > 0) parts.push(`− ${bd.absences} absence${bd.absences !== 1 ? 's' : ''}`);
            if (bd.permanence > 0) parts.push(`+ ${bd.permanence} permanence day${bd.permanence !== 1 ? 's' : ''}`);
            if (bd.absences === 0 && bd.holidays === 0 && bd.permanence === 0) parts.push('No holidays, absences, or permanence days this month.');
            return parts.join(bd.absences || bd.permanence ? ' ' : ' · ');
          })()}
        </div>
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
  const all = getAbsenceRequests();

  // Apply status + category + date filters
  function filterRows(rows) {
    if (_histStatus   !== 'all') rows = rows.filter(r => r.status === _histStatus);
    if (_histCategory !== 'all') rows = rows.filter(r => r.category === _histCategory);
    if (_histDate     !== 'all' && typeof _histDate === 'string') {
      rows = rows.filter(r => typeof r.date === 'string' && r.date.startsWith(_histDate));
    }
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // Split by type
  const absences   = filterRows(all.filter(r => (r.type || 'absence') === 'absence'));
  const permanence = filterRows(all.filter(r => (r.type || 'absence') === 'permanence'));

  // Counters (ignore filters for the totals — these reflect the full picture)
  const allAbsences   = all.filter(r => (r.type || 'absence') === 'absence');
  const allPermanence = all.filter(r => (r.type || 'absence') === 'permanence');

  const absStatusCounts = {
    pending:  allAbsences.filter(r => r.status === 'pending').length,
    approved: allAbsences.filter(r => r.status === 'approved').length,
    rejected: allAbsences.filter(r => r.status === 'rejected').length
  };
  const permStatusCounts = {
    pending:  allPermanence.filter(r => r.status === 'pending').length,
    approved: allPermanence.filter(r => r.status === 'approved').length,
    rejected: allPermanence.filter(r => r.status === 'rejected').length
  };

  return `
    <!-- Filters -->
    <section class="ep-card">
      <div class="ep-card-title">📋 ${esc(t('portal.history_title'))}</div>

      <label class="ep-label">${esc(t('portal.history.filter_status'))}</label>
      <select class="ep-input" id="ep-hist-status">
        <option value="all"      ${_histStatus === 'all'      ? 'selected' : ''}>${esc(t('portal.history.all'))}</option>
        <option value="pending"  ${_histStatus === 'pending'  ? 'selected' : ''}>${esc(t('status.pending'))}</option>
        <option value="approved" ${_histStatus === 'approved' ? 'selected' : ''}>${esc(t('status.approved'))}</option>
        <option value="rejected" ${_histStatus === 'rejected' ? 'selected' : ''}>${esc(t('status.rejected'))}</option>
      </select>

      <label class="ep-label" style="margin-top:10px;">${esc(t('portal.history.filter_cat'))}</label>
      <select class="ep-input" id="ep-hist-category">
        <option value="all" ${_histCategory === 'all' ? 'selected' : ''}>${esc(t('portal.history.all'))}</option>
        ${ABSENCE_CATEGORIES.map(c =>
          `<option value="${c}" ${_histCategory === c ? 'selected' : ''}>${esc(t('category.' + c))}</option>`
        ).join('')}
      </select>

      <label class="ep-label" style="margin-top:10px;">Date</label>
      <div style="position:relative;">
        <button type="button" id="ep-hist-date-btn"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;
                 font-size:0.95rem;font-family:inherit;background:#fff;color:#1e293b;
                 text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
          <span>📅 ${esc(histDateLabel(_histDate))}</span>
          <span style="font-size:0.75rem;color:#94a3b8;">▼</span>
        </button>
        <div id="ep-hist-date-menu"
          style="display:${_histDateOpen ? 'block' : 'none'};position:absolute;top:100%;left:0;right:0;margin-top:4px;
                 background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;
                 box-shadow:0 6px 18px rgba(0,0,0,0.12);z-index:50;
                 padding:6px;max-height:340px;overflow-y:auto;font-size:0.85rem;">
        </div>
      </div>

      <span class="ep-hint">Category filter only applies to absences.</span>
    </section>

    <!-- Absences section -->
    <section class="ep-card">
      <div class="ep-card-title" style="display:flex;align-items:center;gap:8px;">
        <span>🚫 ${esc(t('type.absence'))}s</span>
        <span style="font-size:0.7rem;color:var(--color-text-muted);font-weight:500;">(${allAbsences.length})</span>
      </div>
      <div class="ep-stat-grid">
        <div class="ep-stat"><div class="ep-stat-value">${allAbsences.length}</div><div class="ep-stat-label">${esc(t('portal.history.total'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#92400e;">${absStatusCounts.pending}</div><div class="ep-stat-label">${esc(t('status.pending'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#166534;">${absStatusCounts.approved}</div><div class="ep-stat-label">${esc(t('status.approved'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#991b1b;">${absStatusCounts.rejected}</div><div class="ep-stat-label">${esc(t('status.rejected'))}</div></div>
      </div>

      ${absences.length ? `
        <div class="ep-list" style="margin-top:12px;">
          ${absences.map(r => requestItemHTML(r)).join('')}
        </div>
      ` : `
        <div class="ep-empty" style="padding:18px;">
          <div class="ep-empty-icon">📭</div>
          <div class="ep-empty-text">${esc(t('portal.history.empty'))}</div>
        </div>
      `}
    </section>

    <!-- Permanences section -->
    <section class="ep-card">
      <div class="ep-card-title" style="display:flex;align-items:center;gap:8px;">
        <span>🎯 ${esc(t('type.permanence'))}s</span>
        <span style="font-size:0.7rem;color:var(--color-text-muted);font-weight:500;">(${allPermanence.length})</span>
      </div>
      <div class="ep-stat-grid">
        <div class="ep-stat"><div class="ep-stat-value">${allPermanence.length}</div><div class="ep-stat-label">${esc(t('portal.history.total'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#92400e;">${permStatusCounts.pending}</div><div class="ep-stat-label">${esc(t('status.pending'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#166534;">${permStatusCounts.approved}</div><div class="ep-stat-label">${esc(t('status.approved'))}</div></div>
        <div class="ep-stat"><div class="ep-stat-value" style="color:#991b1b;">${permStatusCounts.rejected}</div><div class="ep-stat-label">${esc(t('status.rejected'))}</div></div>
      </div>

      ${permanence.length ? `
        <div class="ep-list" style="margin-top:12px;">
          ${permanence.map(r => requestItemHTML(r)).join('')}
        </div>
      ` : `
        <div class="ep-empty" style="padding:18px;">
          <div class="ep-empty-icon">📭</div>
          <div class="ep-empty-text">${esc(t('portal.history.empty'))}</div>
        </div>
      `}
    </section>
  `;
}

// ── Section: NOTES (private personal notes) ──────────────
function notesSectionHTML() {
  // Edit mode
  if (_editingNoteId !== null) {
    const isNew    = _editingNoteId === 'new';
    const note     = isNew ? { title: '', body: '' } : (_notes.find(n => n.id === _editingNoteId) || { title: '', body: '' });
    return `
      <section class="ep-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="ep-card-title" style="margin:0;">${isNew ? '➕ ' + esc(t('portal.notes.new')) : '✏️ ' + esc(t('portal.notes.edit'))}</div>
          <button id="ep-note-back" class="ep-link-btn" style="padding:4px 10px;">← ${esc(t('common.cancel'))}</button>
        </div>

        <form id="ep-note-form" novalidate>
          <label class="ep-label" for="ep-note-title">${esc(t('portal.notes.title_field'))}</label>
          <input class="ep-input" type="text" id="ep-note-title"
            maxlength="100" placeholder="${esc(t('portal.notes.title_placeholder'))}"
            value="${esc(note.title || '')}" required>

          <label class="ep-label" for="ep-note-body" style="margin-top:10px;">${esc(t('portal.notes.body_field'))}</label>
          <textarea class="ep-input" id="ep-note-body" rows="10"
            maxlength="5000"
            placeholder="${esc(t('portal.notes.body_placeholder'))}">${esc(note.body || '')}</textarea>

          <div id="ep-note-errors" class="ep-errors"></div>

          <div style="display:flex;gap:8px;margin-top:14px;">
            <button type="submit" class="ep-btn ep-btn-primary" style="flex:1;">
              💾 ${esc(t('common.save'))}
            </button>
            ${!isNew ? `
              <button type="button" id="ep-note-delete" class="ep-btn ep-btn-ghost">
                🗑 ${esc(t('common.delete'))}
              </button>
            ` : ''}
          </div>
        </form>
      </section>
    `;
  }

  // List mode
  const sorted = [..._notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return `
    <section class="ep-card">
      <!-- Header: title on one line + small blue + New Note button -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:nowrap;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          <span style="font-size:1.4rem;flex-shrink:0;">🔐</span>
          <span style="font-weight:700;font-size:1.05rem;color:#1e293b;">${esc(t('portal.notes_title'))}</span>
        </div>
        <button id="ep-note-new"
          style="flex-shrink:0;background:#2563eb;color:#fff;border:none;
                 padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:600;
                 cursor:pointer;font-family:inherit;
                 box-shadow:0 1px 3px rgba(37,99,235,0.3);
                 transition:background 0.15s, transform 0.05s;"
          onmouseover="this.style.background='#1d4ed8';"
          onmouseout="this.style.background='#2563eb';">
          + ${esc(t('portal.notes.new'))}
        </button>
      </div>

      <p class="ep-card-sub" style="margin-bottom:10px;">${esc(t('portal.notes.intro'))}</p>
      <div style="font-size:0.72rem;color:#92400e;background:#fef9c3;border:1px solid #fef08a;border-radius:8px;padding:8px 10px;margin-bottom:14px;">
        ⚠️ ${esc(t('portal.notes.warning'))}
      </div>

      ${sorted.length ? `
        <div class="ep-list">
          ${sorted.map(n => noteCardHTML(n)).join('')}
        </div>
      ` : `
        <div class="ep-empty" style="padding:24px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;">
          <div class="ep-empty-icon">📝</div>
          <div class="ep-empty-text">${esc(t('portal.notes.empty'))}</div>
          <div class="ep-empty-sub">${esc(t('portal.notes.empty_sub'))}</div>
        </div>
      `}
    </section>
  `;
}

function noteCardHTML(n) {
  const preview = (n.body || '').slice(0, 100).replace(/\s+/g, ' ');
  const updated = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return `
    <div class="ep-note-card" data-note-id="${esc(n.id)}"
      style="padding:14px 16px;background:linear-gradient(180deg,#fff,#f8fafc);
             border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:10px;
             cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.03);
             transition:transform 0.1s, box-shadow 0.1s, border-left-color 0.15s;"
      onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 3px 8px rgba(0,0,0,0.06)';this.style.borderLeftColor='#1d4ed8';"
      onmouseout="this.style.transform='';this.style.boxShadow='0 1px 2px rgba(0,0,0,0.03)';this.style.borderLeftColor='#2563eb';">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-weight:700;color:#1e293b;font-size:0.95rem;flex:1;min-width:0;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${esc(n.title || t('portal.notes.untitled'))}
        </div>
        <span style="color:#94a3b8;font-size:0.85rem;flex-shrink:0;">›</span>
      </div>
      ${preview ? `<div style="font-size:0.8rem;color:#64748b;margin-top:6px;line-height:1.45;
                           display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                           overflow:hidden;">${esc(preview)}${(n.body || '').length > 100 ? '…' : ''}</div>` : ''}
      ${updated ? `<div style="font-size:0.68rem;color:#94a3b8;margin-top:8px;display:flex;align-items:center;gap:4px;">
        🕐 ${updated}
      </div>` : ''}
    </div>
  `;
}

function bindNotesEvents() {
  // List actions
  const newBtn = document.getElementById('ep-note-new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      _editingNoteId = 'new';
      draw();
    });
  }
  document.querySelectorAll('.ep-note-card[data-note-id]').forEach(card => {
    card.addEventListener('click', () => {
      _editingNoteId = card.dataset.noteId;
      draw();
    });
  });

  // Edit-mode actions
  const backBtn = document.getElementById('ep-note-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      _editingNoteId = null;
      draw();
    });
  }
  const form = document.getElementById('ep-note-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('ep-note-title').value.trim();
      const body  = document.getElementById('ep-note-body').value;
      const errEl = document.getElementById('ep-note-errors');

      if (!title) {
        errEl.innerHTML = `<div>⚠ ${esc(t('portal.notes.title_required'))}</div>`;
        return;
      }
      errEl.innerHTML = '';

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = t('common.loading');

      try {
        const uid = _user?.uid;
        if (!uid) throw new Error('No user uid');
        if (_editingNoteId === 'new') {
          const created = await addMyNote(uid, { title, body });
          _notes.push({ ...created, title, body, createdAt: Date.now(), updatedAt: Date.now() });
        } else {
          await updateMyNote(uid, _editingNoteId, { title, body });
          const idx = _notes.findIndex(n => n.id === _editingNoteId);
          if (idx !== -1) _notes[idx] = { ..._notes[idx], title, body, updatedAt: Date.now() };
        }
        _editingNoteId = null;
        draw();
      } catch (err) {
        console.error(err);
        errEl.innerHTML = `<div>⚠ ${esc(t('portal.error.submit_failed'))}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 ' + t('common.save');
      }
    });
  }
  const deleteBtn = document.getElementById('ep-note-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('portal.notes.delete_confirm'))) return;
      deleteBtn.disabled = true;
      try {
        await deleteMyNote(_user.uid, _editingNoteId);
        _notes = _notes.filter(n => n.id !== _editingNoteId);
        _editingNoteId = null;
        draw();
      } catch (err) {
        console.error(err);
        alert(t('portal.notes.delete_failed'));
        deleteBtn.disabled = false;
      }
    });
  }
}

// ── Events ──────────────────────────────────────────────
function bindGlobalEvents() {
  // Burger
  document.getElementById('ep-burger').addEventListener('click', () => {
    _drawerOpen = true;
    document.getElementById('ep-drawer').classList.add('open');
    document.getElementById('ep-drawer-overlay').classList.add('open');
    document.body.classList.add('ep-drawer-open');   // hides burger via CSS
  });

  // Drawer overlay close
  document.getElementById('ep-drawer-overlay').addEventListener('click', closeDrawer);

  // Home button (top-right of header — visible when not on home)
  const homeBtn = document.getElementById('ep-home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      _section = 'home';
      _editingNoteId = null;
      draw();
    });
  }

  // Close X inside drawer
  const closeBtn = document.getElementById('ep-drawer-close');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  // Drawer items
  document.querySelectorAll('.ep-drawer-item').forEach(btn => {
    btn.addEventListener('click', () => {
      _section = btn.dataset.section;
      closeDrawer();
      draw();
    });
  });

  // Language picker
  document.querySelectorAll('.ep-drawer-footer [data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Sign out
  bindSignOut();
}

function bindSectionEvents() {
  if (_section === 'home') {
    // Quick action buttons that navigate to other sections
    document.querySelectorAll('[data-go-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        _section = btn.dataset.goSection;
        if (btn.dataset.attendanceTab) _attendanceTab = btn.dataset.attendanceTab;
        draw();
      });
    });
  } else if (_section === 'attendance') {
    // Sub-tab switching
    document.querySelectorAll('[data-att-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        _attendanceTab = btn.dataset.attTab;
        draw();
      });
    });
    if (_attendanceTab === 'request') {
      bindFormEvents();
      bindPermanenceEvents();
      bindListEvents();
    } else if (_attendanceTab === 'history') {
      bindHistoryEvents();
      bindListEvents();
    }
  } else if (_section === 'payslip') {
    bindPaySlipEvents();
  } else if (_section === 'notes') {
    bindNotesEvents();
  }
}

function bindFormEvents() {
  const form = document.getElementById('ep-form');
  if (!form) return;
  const catEl = document.getElementById('ep-category');
  const reasonRequired = document.getElementById('ep-reason-required');

  function updateReasonHint() {
    reasonRequired.textContent = catEl.value === 'other' ? t('common.required') : t('common.optional');
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
      showToast(t('portal.absence.submitted'), 'success');
      draw();
    } catch (err) {
      console.error(err);
      errEl.innerHTML = `<div>⚠ ${esc(t('portal.error.submit_failed'))}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ ' + t('portal.absence.submit');
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
  document.getElementById('ep-payslip-month').addEventListener('change', async e => {
    _paySlipMonth = e.target.value || defaultMonth();
    // Pre-fetch the academic year for this month, then redraw
    await findAcademicYearForMonth();
    draw();
  });

  document.getElementById('ep-payslip-pdf').addEventListener('click', () => {
    generatePaySlipPDF();
  });
}

function bindPermanenceEvents() {
  const form = document.getElementById('ep-perm-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      type:   'permanence',
      date:   document.getElementById('ep-perm-date').value,
      reason: document.getElementById('ep-perm-reason').value
    };

    const errors = validateAbsenceRequest(data);
    const errEl  = document.getElementById('ep-perm-form-errors');
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
      showToast(t('portal.permanence.submitted'), 'success');
      draw();
    } catch (err) {
      console.error(err);
      errEl.innerHTML = `<div>⚠ ${esc(t('portal.error.submit_failed'))}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ ' + t('portal.permanence.submit');
    }
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

  // Date picker (hierarchical year → month)
  const dateBtn  = document.getElementById('ep-hist-date-btn');
  const dateMenu = document.getElementById('ep-hist-date-menu');
  if (dateBtn && dateMenu) {
    dateBtn.addEventListener('click', e => {
      e.stopPropagation();
      _histDateOpen = !_histDateOpen;
      dateMenu.style.display = _histDateOpen ? 'block' : 'none';
      if (_histDateOpen) renderHistDatePickerMenu();
    });
    dateMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
      if (!dateBtn.contains(e.target) && !dateMenu.contains(e.target)) {
        if (_histDateOpen) {
          _histDateOpen = false;
          dateMenu.style.display = 'none';
        }
      }
    });
    if (_histDateOpen) renderHistDatePickerMenu();
  }
}

function renderHistDatePickerMenu() {
  const menu = document.getElementById('ep-hist-date-menu');
  if (!menu) return;

  // Build year → set-of-months from current data
  const map = {};
  for (const r of getAbsenceRequests()) {
    if (typeof r.date !== 'string' || r.date.length < 7) continue;
    const y = r.date.slice(0, 4);
    const m = r.date.slice(5, 7);
    if (!map[y]) map[y] = new Set();
    map[y].add(m);
  }
  const years = Object.keys(map).sort();

  if (!years.length) {
    menu.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:0.82rem;">No requests submitted yet.</div>`;
    return;
  }

  let html = `
    <button type="button" data-hpick="all"
      style="display:block;width:100%;text-align:left;padding:8px 10px;border:none;
             background:${_histDate === 'all' ? '#dbeafe' : 'transparent'};
             color:${_histDate === 'all' ? '#1e40af' : '#1e293b'};
             font-weight:${_histDate === 'all' ? '600' : '500'};
             border-radius:6px;cursor:pointer;font-family:inherit;font-size:0.85rem;
             border-bottom:1px solid #e2e8f0;margin-bottom:4px;">
      📅 All dates
    </button>
  `;

  for (const year of years) {
    const isExpanded = _histExpandedY === year;
    const isYearSel  = _histDate === year;
    const isMonthSel = typeof _histDate === 'string' && _histDate.startsWith(year + '-');
    const monthsAvailable = [...map[year]].sort();

    html += `
      <div style="margin-bottom:2px;">
        <button type="button" data-htoggle="${year}"
          style="display:flex;width:100%;align-items:center;justify-content:space-between;
                 padding:7px 10px;border:none;background:transparent;cursor:pointer;
                 font-family:inherit;font-size:0.9rem;border-radius:6px;
                 color:${(isYearSel || isMonthSel) ? '#1e40af' : '#1e293b'};
                 font-weight:${(isYearSel || isMonthSel) ? '600' : '500'};">
          <span>${year}${isMonthSel ? ` <small style="color:#64748b;">(${histDateLabel(_histDate)})</small>` : ''}</span>
          <span style="font-size:0.7rem;color:#94a3b8;">${isExpanded ? '▼' : '▶'}</span>
        </button>
        ${isExpanded ? `
          <div style="padding:4px 10px 6px 14px;display:flex;flex-direction:column;gap:3px;">
            <button type="button" data-hpick="${year}"
              style="display:block;width:100%;text-align:left;padding:5px 8px;border:none;
                     background:${isYearSel ? '#dbeafe' : 'transparent'};
                     color:${isYearSel ? '#1e40af' : '#475569'};
                     font-weight:${isYearSel ? '600' : '500'};
                     border-radius:5px;cursor:pointer;font-family:inherit;font-size:0.8rem;">
              All ${year}
            </button>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:3px;">
              ${HIST_MONTH_OPTIONS.map(m => {
                const code = `${year}-${m.v}`;
                const exists = monthsAvailable.includes(m.v);
                const sel = _histDate === code;
                return `
                  <button type="button" data-hpick="${code}" ${exists ? '' : 'disabled'}
                    style="padding:6px 4px;border:1.5px solid ${sel ? '#2563eb' : '#e2e8f0'};
                           background:${sel ? '#dbeafe' : (exists ? '#fff' : '#f8fafc')};
                           color:${sel ? '#1e40af' : (exists ? '#1e293b' : '#cbd5e1')};
                           border-radius:5px;font-family:inherit;font-size:0.78rem;
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

  menu.querySelectorAll('[data-htoggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const year = btn.dataset.htoggle;
      _histExpandedY = (_histExpandedY === year) ? null : year;
      renderHistDatePickerMenu();
    });
  });
  menu.querySelectorAll('[data-hpick]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _histDate = btn.dataset.hpick;
      _histDateOpen = false;
      draw();
    });
  });
}

function closeDrawer() {
  _drawerOpen = false;
  document.getElementById('ep-drawer')?.classList.remove('open');
  document.getElementById('ep-drawer-overlay')?.classList.remove('open');
  document.body.classList.remove('ep-drawer-open');
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
  const candidateId = m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const academicYear = _academicYearsCache[candidateId] || null;
  const bd = computeEffectiveDays({
    employee:        _employee,
    calendar:        _calendar,
    absenceRequests: getAbsenceRequests(),
    year:            y,
    month:           m,
    academicYear,
    roleRegistry:    _roleRegistry
  });
  const days = bd.days;
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
  {
    const parts = [];
    parts.push(`${bd.calendarDays} from calendar`);
    if (bd.holidays   > 0) parts.push(`-${bd.holidays} holiday${bd.holidays !== 1 ? 's' : ''}`);
    if (bd.absences   > 0) parts.push(`-${bd.absences} absence${bd.absences !== 1 ? 's' : ''}`);
    if (bd.permanence > 0) parts.push(`+${bd.permanence} permanence day${bd.permanence !== 1 ? 's' : ''}`);
    drawRow(`(${parts.join(' ')})`, '', { indent: 4, size: 8 });
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
