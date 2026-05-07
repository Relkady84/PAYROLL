/**
 * Backup Restore — opens a modal-style overlay where the admin can preview
 * a backup JSON file and selectively restore data:
 *   - View any section read-only (look up forgotten values)
 *   - Add only missing records (recover deleted items)
 *   - Replace a whole section (recover modified data)
 *   - Restore a single record (per-employee, per-request)
 */

import {
  getEmployees, getAbsenceRequests, getCalendar, getAcademicYears,
  getRoleRegistry, getSettings,
  saveSettings, saveCalendar, saveRoleRegistry, saveAcademicYear,
  addEmployee, updateEmployee,
  addAbsenceRequest, updateAbsenceRequest
} from '../data/store.js';
import { showToast } from './components/toast.js';

let _backup    = null;       // parsed backup object
let _container = null;       // overlay container

/** Open the restore overlay with a parsed backup object. */
export function openRestoreOverlay(backup) {
  _backup = backup;
  _container = ensureOverlay();
  _container.style.display = 'flex';
  drawSummary();
}

function closeOverlay() {
  if (_container) _container.style.display = 'none';
  _backup = null;
}

function ensureOverlay() {
  let el = document.getElementById('br-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'br-overlay';
  el.style.cssText = `
    position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:9995;
    display:none;align-items:flex-start;justify-content:center;
    padding:20px;overflow-y:auto;
  `;
  document.body.appendChild(el);
  return el;
}

// ── Summary view (entry point) ───────────────────────────
function drawSummary() {
  const b = _backup;
  if (!b) return;

  const sections = [
    {
      id: 'settings',
      icon: '⚙️',
      label: 'Settings',
      count: b.settings ? Object.keys(b.settings).length : 0,
      countLabel: 'fields',
      canAddNew: false,
      canReplaceAll: true
    },
    {
      id: 'calendar',
      icon: '📅',
      label: 'Calendar',
      count: (b.calendar?.holidays || []).length,
      countLabel: 'holidays',
      canAddNew: false,
      canReplaceAll: true
    },
    {
      id: 'academicYears',
      icon: '🎓',
      label: 'Academic Years',
      count: (b.academicYears || []).length,
      countLabel: 'years',
      canAddNew: true,
      canReplaceAll: true
    },
    {
      id: 'roleRegistry',
      icon: '👔',
      label: 'Roles',
      count: (b.roleRegistry?.roles || []).length,
      countLabel: 'roles',
      canAddNew: false,
      canReplaceAll: true
    },
    {
      id: 'employees',
      icon: '👥',
      label: 'Employees',
      count: (b.employees || []).length,
      countLabel: 'employees',
      canAddNew: true,
      canReplaceAll: true,
      perRecord: true
    },
    {
      id: 'absenceRequests',
      icon: '📋',
      label: 'Absence / Permanence Requests',
      count: (b.absenceRequests || []).length,
      countLabel: 'requests',
      canAddNew: true,
      canReplaceAll: false,
      perRecord: true
    }
  ];

  const exportedAt = b.exportedAt
    ? new Date(b.exportedAt).toLocaleString()
    : 'unknown';

  _container.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:760px;width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden;
                margin:auto;display:flex;flex-direction:column;max-height:90vh;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                  color:#fff;padding:18px 24px;display:flex;align-items:center;
                  justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:1.05rem;">📂 Restore from Backup</div>
          <div style="font-size:0.78rem;color:rgba(255,255,255,0.7);margin-top:4px;">
            Exported: ${exportedAt}
          </div>
        </div>
        <button id="br-close"
          style="background:rgba(255,255,255,0.15);color:#fff;border:none;
                 width:36px;height:36px;border-radius:8px;cursor:pointer;
                 font-size:1.2rem;font-family:inherit;">×</button>
      </div>

      <!-- Body (scrollable) -->
      <div style="padding:18px 24px;overflow-y:auto;flex:1;">
        <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;
                    padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:#713f12;">
          ⚠️ <strong>Replace</strong> operations overwrite current data and cannot be undone.
          <strong>Add new</strong> only adds entries that don't already exist (safe).
          <strong>View</strong> is read-only — just look up forgotten values.
        </div>

        <table class="data-table" style="width:100%;font-size:0.88rem;">
          <thead>
            <tr>
              <th>Section</th>
              <th style="width:90px;">Items</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${sections.map(s => `
              <tr>
                <td><strong>${s.icon} ${s.label}</strong></td>
                <td>${s.count} ${s.countLabel}</td>
                <td>
                  <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${s.count > 0 ? `<button class="btn btn-secondary btn-sm" data-act="view"        data-section="${s.id}">👁 View</button>` : ''}
                    ${s.canAddNew     ? `<button class="btn btn-success   btn-sm" data-act="add-new"     data-section="${s.id}">+ Add new</button>` : ''}
                    ${s.canReplaceAll ? `<button class="btn btn-danger    btn-sm" data-act="replace-all" data-section="${s.id}">⚠️ Replace</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:12px 24px;border-top:1px solid #e2e8f0;text-align:right;">
        <button class="btn btn-secondary" id="br-done">Close</button>
      </div>
    </div>
  `;

  // Wire up
  document.getElementById('br-close').addEventListener('click', closeOverlay);
  document.getElementById('br-done').addEventListener('click', closeOverlay);
  _container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.section));
  });
}

// ── Action dispatcher ────────────────────────────────────
async function handleAction(action, section) {
  if (action === 'view') return drawViewer(section);
  if (action === 'add-new') return doAddNew(section);
  if (action === 'replace-all') return doReplaceAll(section);
}

// ── Bulk actions ─────────────────────────────────────────
async function doAddNew(section) {
  const b = _backup;
  if (!b) return;

  let added = 0, total = 0;
  try {
    if (section === 'employees') {
      const existingIds = new Set(getEmployees().map(e => e.id));
      const list = b.employees || [];
      total = list.length;
      for (const emp of list) {
        if (!existingIds.has(emp.id)) {
          addEmployee(emp);
          added++;
        }
      }
    } else if (section === 'absenceRequests') {
      const existingIds = new Set(getAbsenceRequests().map(r => r.id));
      const list = b.absenceRequests || [];
      total = list.length;
      for (const req of list) {
        if (!existingIds.has(req.id)) {
          await addAbsenceRequest(req);
          added++;
        }
      }
    } else if (section === 'academicYears') {
      const existingIds = new Set(getAcademicYears().map(y => y.yearId));
      const list = b.academicYears || [];
      total = list.length;
      for (const year of list) {
        if (!existingIds.has(year.yearId)) {
          await saveAcademicYear(year);
          added++;
        }
      }
    } else {
      showToast('Add-new not supported for this section.', 'warning');
      return;
    }
    showToast(`Added ${added} of ${total} (${total - added} already existed).`, 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to add some entries — see console.', 'error');
  }
}

async function doReplaceAll(section) {
  const b = _backup;
  if (!b) return;

  if (!confirm(`Replace ALL ${section} with the backup version? This OVERWRITES current data.`)) return;

  try {
    if (section === 'settings') {
      saveSettings(b.settings);
      showToast('Settings replaced.', 'success');
    } else if (section === 'calendar') {
      await saveCalendar(b.calendar);
      showToast('Calendar replaced.', 'success');
    } else if (section === 'roleRegistry') {
      await saveRoleRegistry(b.roleRegistry);
      showToast('Roles replaced.', 'success');
    } else if (section === 'academicYears') {
      for (const year of (b.academicYears || [])) {
        await saveAcademicYear(year);
      }
      showToast('Academic years replaced.', 'success');
    } else if (section === 'employees') {
      const list = b.employees || [];
      for (const emp of list) {
        const existing = getEmployees().find(e => e.id === emp.id);
        if (existing) updateEmployee(emp.id, emp);
        else addEmployee(emp);
      }
      showToast(`Restored ${list.length} employees.`, 'success');
    } else {
      showToast('Replace not supported for this section.', 'warning');
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to replace — see console.', 'error');
  }
}

// ── Viewers (per-section detail) ─────────────────────────
function drawViewer(section) {
  const b = _backup;
  if (!b) return;

  let title = '', body = '';
  if (section === 'settings') {
    title = '⚙️ Settings (backup)';
    body = renderObjectTable(b.settings || {});
  } else if (section === 'calendar') {
    title = '📅 Calendar (backup)';
    const cal = b.calendar || {};
    body = `
      <p><strong>Weekend days:</strong> ${(cal.weekendDays || []).join(', ')}</p>
      <p><strong>Holidays (${(cal.holidays || []).length}):</strong></p>
      ${renderTable(['Date', 'Name', 'Type'], (cal.holidays || []).map(h => [h.date, h.name, h.type]))}
    `;
  } else if (section === 'academicYears') {
    title = '🎓 Academic Years (backup)';
    body = (b.academicYears || []).map(y => `
      <div style="margin-bottom:14px;padding:10px;background:#f8fafc;border-radius:8px;">
        <div style="font-weight:700;">${esc(y.yearId)} ${y.isCurrent ? '⭐' : ''}</div>
        <div>Start: ${esc(y.startDate || '—')} · End: ${esc(y.endDate || '—')}</div>
        ${Object.entries(y.rolePeriods || {}).map(([role, periods]) => `
          <div style="margin-top:6px;">
            <strong>${esc(role)}</strong>:
            ${periods.map(p => `${p.from}→${p.to} (${(p.schedule || []).join(',')})`).join('; ')}
          </div>
        `).join('')}
      </div>
    `).join('') || '<p>No academic years.</p>';
  } else if (section === 'roleRegistry') {
    title = '👔 Roles (backup)';
    body = renderTable(['Name', 'Tax category', 'Built-in'],
      (b.roleRegistry?.roles || []).map(r => [r.name, r.taxCategory, r.builtin ? 'Yes' : 'No']));
  } else if (section === 'employees') {
    return drawEmployeesViewer();
  } else if (section === 'absenceRequests') {
    return drawRequestsViewer();
  }

  drawDetailModal(title, body);
}

function drawEmployeesViewer() {
  const list = _backup.employees || [];
  const currentMap = new Map(getEmployees().map(e => [e.id, e]));

  const body = `
    <input type="text" id="br-emp-search" placeholder="Search by name…"
      style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;
             font-size:0.9rem;font-family:inherit;margin-bottom:12px;">
    <div id="br-emp-list">
      ${list.map(emp => renderEmployeeRow(emp, currentMap.get(emp.id))).join('')}
    </div>
  `;
  drawDetailModal(`👥 Employees in backup (${list.length})`, body);

  // Per-record restore handlers
  document.querySelectorAll('[data-restore-emp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.restoreEmp;
      const emp = list.find(e => e.id === id);
      if (!emp) return;
      if (!confirm(`Restore "${emp.firstName} ${emp.lastName}" from backup? This will overwrite their current record.`)) return;
      const existing = getEmployees().find(e => e.id === id);
      if (existing) updateEmployee(id, emp);
      else addEmployee(emp);
      showToast('Employee restored.', 'success');
      drawEmployeesViewer(); // refresh
    });
  });

  // Search
  document.getElementById('br-emp-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#br-emp-list > div[data-emp-card]').forEach(card => {
      const text = (card.dataset.empCard || '').toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

function renderEmployeeRow(emp, current) {
  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const search = `${name} ${emp.email || ''}`;
  const diffs = current ? buildEmployeeDiff(emp, current) : null;
  const status = !current ? '🆕 not in current data'
    : (diffs && diffs.length) ? `⚠️ ${diffs.length} field(s) differ`
    : '✅ matches current';

  return `
    <div data-emp-card="${esc(search)}" style="padding:10px 12px;border:1px solid #e2e8f0;
         border-radius:8px;margin-bottom:8px;background:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:0.95rem;">${esc(name)}</div>
          <div style="font-size:0.72rem;color:#64748b;">${esc(emp.email || '—')} · ${status}</div>
        </div>
        <button class="btn btn-warning btn-sm" data-restore-emp="${esc(emp.id)}"
          style="background:#f59e0b;color:#fff;border:none;">↺ Restore</button>
      </div>
      <details style="margin-top:8px;font-size:0.78rem;">
        <summary style="cursor:pointer;color:#475569;">Show details</summary>
        <table style="width:100%;margin-top:6px;font-size:0.78rem;border-collapse:collapse;">
          ${['firstName','lastName','employeeType','role','baseSalaryLBP','kmDistance','homeLocation','email','age','defaultDaysPerMonth']
            .map(k => {
              const bv = emp[k] ?? '—';
              const cv = current ? (current[k] ?? '—') : null;
              const changed = current && bv !== cv;
              return `
                <tr style="${changed ? 'background:#fef3c7;' : ''}">
                  <td style="padding:3px 6px;color:#64748b;">${k}</td>
                  <td style="padding:3px 6px;font-family:monospace;">${esc(String(bv))}</td>
                  ${current ? `<td style="padding:3px 6px;font-family:monospace;color:#94a3b8;">(now: ${esc(String(cv))})</td>` : ''}
                </tr>
              `;
            }).join('')}
        </table>
      </details>
    </div>
  `;
}

function buildEmployeeDiff(backup, current) {
  const fields = ['firstName','lastName','employeeType','role','baseSalaryLBP','kmDistance','homeLocation','email','age','defaultDaysPerMonth'];
  return fields.filter(f => (backup[f] ?? '') !== (current[f] ?? ''));
}

function drawRequestsViewer() {
  const list = _backup.absenceRequests || [];
  const body = renderTable(
    ['Employee', 'Date', 'Type', 'Status', 'Reason'],
    list.map(r => [
      r.employeeName || '—',
      r.date || '—',
      r.type || 'absence',
      r.status || 'pending',
      r.reason || '—'
    ])
  );
  drawDetailModal(`📋 Requests in backup (${list.length})`, body);
}

// ── Generic UI helpers ───────────────────────────────────
function drawDetailModal(title, bodyHTML) {
  // Replace overlay content
  _container.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:780px;width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden;
                margin:auto;display:flex;flex-direction:column;max-height:90vh;">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                  color:#fff;padding:18px 24px;display:flex;align-items:center;
                  justify-content:space-between;">
        <div style="font-weight:700;font-size:1.05rem;">${title}</div>
        <button id="br-back-btn"
          style="background:rgba(255,255,255,0.15);color:#fff;border:none;
                 padding:6px 12px;border-radius:7px;cursor:pointer;font-family:inherit;font-size:0.85rem;">
          ← Back
        </button>
      </div>
      <div style="padding:18px 24px;overflow-y:auto;flex:1;">
        ${bodyHTML}
      </div>
    </div>
  `;
  document.getElementById('br-back-btn').addEventListener('click', drawSummary);
}

function renderObjectTable(obj) {
  const entries = Object.entries(obj);
  return `
    <table class="data-table" style="width:100%;font-size:0.85rem;">
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        ${entries.map(([k, v]) => `
          <tr>
            <td style="font-family:monospace;font-size:0.78rem;color:#475569;">${esc(k)}</td>
            <td style="font-family:monospace;">${esc(formatValue(v))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderTable(headers, rows) {
  if (!rows.length) return '<p style="color:#94a3b8;">No data.</p>';
  return `
    <table class="data-table" style="width:100%;font-size:0.85rem;">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c ?? '—'))}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
