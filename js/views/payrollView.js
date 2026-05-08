import {
  getEmployees, getSettings, getAbsenceRequests,
  getCalendar, getCurrentAcademicYear, findAcademicYearForMonth, getRoleRegistry,
  getAcademicYears,
  getIssuedPaySlipMonths, publishPaySlipMonth, unpublishPaySlipMonth
} from '../data/store.js';
import { calculatePayroll, calculateTotals, computeEffectiveDays } from '../services/payroll.js';
import { exportCSV, exportExcel, exportPDF } from '../services/exportService.js';
import { importCSV, importExcel } from '../services/importService.js';
import { showToast } from './components/toast.js';
import { t } from '../i18n.js';

let _filterType    = 'all';
let _sortKey       = 'firstName';
let _sortDir       = 'asc';
let _daysWorked    = {};       // manual overrides (empId -> days)
let _selectedMonth = null;     // 'YYYY-MM' — default current month
let _expandedYear  = null;     // for the date picker dropdown

const PAYROLL_MONTH_OPTIONS = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Apr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' }, { v: '09', l: 'Sep' },
  { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' }
];

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function payrollMonthLabel(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 'Pick month';
  const m = PAYROLL_MONTH_OPTIONS.find(x => x.v === ym.slice(5, 7));
  return `${m ? m.l : ''} ${ym.slice(0, 4)}`.trim();
}

/** Refresh the Publish button label + style based on whether the
 *  currently-selected month is already published. */
async function refreshPublishButton() {
  const btn   = document.getElementById('payroll-publish-btn');
  const lblEl = document.getElementById('payroll-publish-month-label');
  if (!btn || !lblEl) return;
  let issued = [];
  try { issued = await getIssuedPaySlipMonths(); } catch {}
  const isPublished = issued.includes(_selectedMonth);
  lblEl.textContent = payrollMonthLabel(_selectedMonth);
  if (isPublished) {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    btn.innerHTML = `✓ Published — Unpublish <span id="payroll-publish-month-label">${payrollMonthLabel(_selectedMonth)}</span>`;
    btn.title = 'This month is visible to employees. Click to hide it again.';
  } else {
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    btn.innerHTML = `📢 Publish for <span id="payroll-publish-month-label">${payrollMonthLabel(_selectedMonth)}</span>`;
    btn.title = "Publish this month's pay slip — employees can then see it in their portal";
  }
}

/** Years for the payroll picker — pulled from academic years + absence dates,
 *  plus current year ± 1 to ensure it's always usable. */
function getPayrollYears() {
  const set = new Set();
  // Current year ± 1
  const now = new Date().getFullYear();
  set.add(String(now - 1));
  set.add(String(now));
  set.add(String(now + 1));
  // Academic year ranges
  for (const y of getAcademicYears()) {
    if (typeof y.startDate === 'string') set.add(y.startDate.slice(0, 4));
    if (typeof y.endDate   === 'string') set.add(y.endDate.slice(0, 4));
  }
  // Absence request dates
  for (const r of getAbsenceRequests()) {
    if (typeof r.date === 'string') set.add(r.date.slice(0, 4));
  }
  return [...set].sort();
}

/** Compute effective day breakdown for an employee in the selected month. */
function dayBreakdownFor(employee) {
  const [y, m] = _selectedMonth.split('-').map(Number);
  const academicYear = findAcademicYearForMonth(y, m);
  return computeEffectiveDays({
    employee,
    calendar:        getCalendar(),
    absenceRequests: getAbsenceRequests(),
    year:            y,
    month:           m,
    manualOverride:  _daysWorked[employee.id],
    academicYear,
    roleRegistry:    getRoleRegistry()
  });
}

export function render(selector) {
  const container = document.querySelector(selector);
  _filterType = 'all';
  _sortKey    = 'firstName';
  _sortDir    = 'asc';
  // Don't reset _daysWorked — manual overrides should persist across navigation.
  // They're only cleared when the user picks a different month, or clicks "Reset Days".
  _selectedMonth = _selectedMonth || defaultMonth();

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>${t('payroll.title')}</h1>
        <span class="content-header-subtitle" id="payroll-count-label">${t('common.loading')}</span>
      </div>
    </div>
    <div class="page-body">
      <div class="section-card">

        <div class="toolbar">
          <div class="toolbar-left">
            <select class="filter-select" id="payroll-type-filter">
              <option value="all">${t('employees.all_types')}</option>
              <option value="Teacher">${t('employees.teachers')}</option>
              <option value="Admin">${t('employees.administrators')}</option>
            </select>
            <label style="font-size:0.8rem;color:var(--color-text-muted);font-weight:500;margin-left:8px;">${t('payroll.month')}</label>
            <div id="pr-date-wrap" style="position:relative;display:inline-block;">
              <button type="button" id="pr-date-btn"
                style="padding:6px 12px;border:1.5px solid var(--color-border);border-radius:6px;
                       font-size:0.85rem;font-family:inherit;outline:none;background:#fff;
                       cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-width:140px;">
                <span>📅</span>
                <span id="pr-date-label">${payrollMonthLabel(_selectedMonth)}</span>
                <span style="font-size:0.7rem;margin-left:auto;">▼</span>
              </button>
              <div id="pr-date-menu"
                style="display:none;position:absolute;top:100%;left:0;margin-top:4px;
                       background:#fff;border:1.5px solid var(--color-border);border-radius:8px;
                       box-shadow:0 4px 12px rgba(0,0,0,0.1);min-width:240px;z-index:1000;
                       padding:6px;max-height:340px;overflow-y:auto;font-size:0.85rem;">
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="payroll-reset-days" style="margin-left:8px;" title="Reset manual day overrides — recompute from approved absences">↺ Reset Days</button>

            <!-- Publish pay slip for selected month → makes it visible to employees -->
            <button class="btn btn-primary btn-sm" id="payroll-publish-btn"
              style="margin-left:12px;"
              title="Publish this month's pay slip — employees can then see it in their portal">
              📢 Publish for <span id="payroll-publish-month-label">${payrollMonthLabel(_selectedMonth)}</span>
            </button>
          </div>
          <div class="toolbar-right">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-weight:500;">IMPORT:</span>
            <label class="btn btn-secondary btn-sm" title="Import CSV">
              📂 CSV
              <input type="file" class="file-input-hidden" id="import-csv-input" accept=".csv">
            </label>
            <label class="btn btn-secondary btn-sm" title="Import Excel">
              📂 Excel
              <input type="file" class="file-input-hidden" id="import-excel-input" accept=".xlsx,.xls">
            </label>
            <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-weight:500;margin-left:4px;">EXPORT:</span>
            <button class="btn btn-secondary btn-sm" id="export-csv-btn">📄 CSV</button>
            <button class="btn btn-secondary btn-sm" id="export-excel-btn">📊 Excel</button>
            <button class="btn btn-secondary btn-sm" id="export-pdf-btn">📑 PDF</button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table" id="payroll-table">
            <thead>
              <tr>
                <th class="sortable" data-key="firstName">${t('payroll.col.name')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="employeeType">${t('payroll.col.type')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="daysWorked">${t('payroll.col.transport_days')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="baseSalaryLBP">${t('payroll.col.base_salary_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="baseSalaryUSD">${t('payroll.col.base_salary_usd')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="transportPerDayLBP">${t('payroll.col.transport_day_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="transportPerDayUSD">${t('payroll.col.transport_day_usd')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="totalTransportLBP">${t('payroll.col.total_transport_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="totalTransportUSD">${t('payroll.col.total_transport_usd')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="taxLBP">${t('payroll.col.tax_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="nfsLBP">${t('payroll.col.nfs_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="netSalaryLBP">${t('payroll.col.net_salary_lbp')} <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="netSalaryUSD">${t('payroll.col.net_salary_usd')} <span class="sort-icon">↕</span></th>
              </tr>
            </thead>
            <tbody id="payroll-tbody"></tbody>
          </table>
        </div>

      </div>
    </div>
  `;

  renderRows(container);

  document.getElementById('payroll-table').addEventListener('change', e => {
    const input = e.target.closest('.days-input');
    if (!input) return;
    const empId = input.dataset.empId;
    const raw   = input.value.trim();
    if (raw === '') {
      // Empty value → remove the manual override and revert to auto-computed days
      delete _daysWorked[empId];
    } else {
      let val = parseInt(raw, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 31) val = 31;
      _daysWorked[empId] = val;
    }
    renderRows(container);
  });

  // Per-employee reset button (↺ next to days input)
  document.getElementById('payroll-table').addEventListener('click', e => {
    const btn = e.target.closest('.reset-one-day-btn');
    if (!btn) return;
    const empId = btn.dataset.empId;
    delete _daysWorked[empId];
    renderRows(container);
  });

  // Filter
  document.getElementById('payroll-type-filter').addEventListener('change', e => {
    _filterType = e.target.value;
    renderRows(container);
  });

  // Month picker — hierarchical (year → months)
  const dateBtn  = document.getElementById('pr-date-btn');
  const dateMenu = document.getElementById('pr-date-menu');
  if (dateBtn && dateMenu) {
    dateBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (dateMenu.style.display === 'block') {
        dateMenu.style.display = 'none';
      } else {
        // Default expanded year = current selection's year
        if (!_expandedYear && _selectedMonth) _expandedYear = _selectedMonth.slice(0, 4);
        renderPayrollDateMenu(container);
        dateMenu.style.display = 'block';
      }
    });
    dateMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
      if (!dateBtn.contains(e.target) && !dateMenu.contains(e.target)) {
        dateMenu.style.display = 'none';
      }
    });
  }

  // Reset manual overrides
  document.getElementById('payroll-reset-days').addEventListener('click', () => {
    _daysWorked = {};
    renderRows(container);
    showToast('Days reset — recomputed from approved absences.', 'info');
  });

  // Publish / Unpublish pay slip for the selected month
  refreshPublishButton();
  document.getElementById('payroll-publish-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('payroll-publish-btn');
    const month = _selectedMonth;
    const issued = await getIssuedPaySlipMonths();
    const isPublished = issued.includes(month);
    const verb = isPublished ? 'unpublish' : 'publish';
    if (!confirm(`Are you sure you want to ${verb} the pay slip for ${payrollMonthLabel(month)}?\n\n${
      isPublished
        ? 'Employees will no longer see this month in their portal.'
        : 'Employees will be able to view their pay slip for this month.'
    }`)) return;
    btn.disabled = true;
    try {
      if (isPublished) {
        await unpublishPaySlipMonth(month);
        showToast(`Unpublished ${payrollMonthLabel(month)} — hidden from employees.`, 'info');
      } else {
        await publishPaySlipMonth(month);
        showToast(`Published ${payrollMonthLabel(month)} — employees can now view it.`, 'success');
      }
      refreshPublishButton();
    } catch (e) {
      console.error(e);
      showToast('Failed to update pay-slip status. Try again.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Sort headers
  document.getElementById('payroll-table').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.key;
    if (_sortKey === key) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortKey = key;
      _sortDir = 'asc';
    }
    renderRows(container);
  });

  // Export
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    const rows = getFilteredRows();
    if (!rows.length) { showToast('No data to export.', 'warning'); return; }
    exportCSV(rows);
    showToast('CSV exported.', 'success');
  });

  document.getElementById('export-excel-btn').addEventListener('click', () => {
    const rows = getFilteredRows();
    if (!rows.length) { showToast('No data to export.', 'warning'); return; }
    exportExcel(rows);
    showToast('Excel file exported.', 'success');
  });

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    const rows = getFilteredRows();
    if (!rows.length) { showToast('No data to export.', 'warning'); return; }
    exportPDF(rows, getSettings());
    showToast('PDF exported.', 'success');
  });

  // Import
  document.getElementById('import-csv-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importCSV(file,
      count => { showToast(`${count} employee(s) imported from CSV.`, 'success'); renderRows(container); },
      err   => showToast(err, 'error')
    );
    e.target.value = '';
  });

  document.getElementById('import-excel-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importExcel(file,
      count => { showToast(`${count} employee(s) imported from Excel.`, 'success'); renderRows(container); },
      err   => showToast(err, 'error')
    );
    e.target.value = '';
  });
}

function renderPayrollDateMenu(container) {
  const menu = document.getElementById('pr-date-menu');
  if (!menu) return;

  const years = getPayrollYears();

  let html = '';
  for (const year of years) {
    const isExpanded = _expandedYear === year;
    const isMonthInYearSelected = _selectedMonth && _selectedMonth.startsWith(year + '-');
    html += `
      <div style="margin-bottom:2px;">
        <button type="button" data-pr-toggle="${year}"
          style="display:flex;width:100%;align-items:center;justify-content:space-between;
                 padding:7px 10px;border:none;background:transparent;cursor:pointer;
                 font-family:inherit;font-size:0.9rem;border-radius:6px;
                 color:${isMonthInYearSelected ? '#1e40af' : '#1e293b'};
                 font-weight:${isMonthInYearSelected ? '600' : '500'};">
          <span>${year}${isMonthInYearSelected ? ` <small style="color:#64748b;">(${payrollMonthLabel(_selectedMonth)})</small>` : ''}</span>
          <span style="font-size:0.7rem;color:#94a3b8;">${isExpanded ? '▼' : '▶'}</span>
        </button>
        ${isExpanded ? `
          <div style="padding:4px 10px 6px 14px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
            ${PAYROLL_MONTH_OPTIONS.map(m => {
              const code = `${year}-${m.v}`;
              const sel = _selectedMonth === code;
              return `
                <button type="button" data-pr-pick="${code}"
                  style="padding:6px 4px;border:1.5px solid ${sel ? '#2563eb' : '#e2e8f0'};
                         background:${sel ? '#dbeafe' : '#fff'};
                         color:${sel ? '#1e40af' : '#1e293b'};
                         border-radius:5px;font-family:inherit;font-size:0.78rem;
                         font-weight:${sel ? '600' : '500'};cursor:pointer;">
                  ${m.l}
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  menu.innerHTML = html;

  menu.querySelectorAll('[data-pr-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const year = btn.dataset.prToggle;
      _expandedYear = (_expandedYear === year) ? null : year;
      renderPayrollDateMenu(container);
    });
  });
  menu.querySelectorAll('[data-pr-pick]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _selectedMonth = btn.dataset.prPick;
      _daysWorked    = {}; // clear manual overrides when changing month
      const lbl = document.getElementById('pr-date-label');
      if (lbl) lbl.textContent = payrollMonthLabel(_selectedMonth);
      menu.style.display = 'none';
      renderRows(container);
      refreshPublishButton();
    });
  });
}

function getFilteredRows() {
  const settings  = getSettings();
  let employees   = getEmployees();
  if (_filterType !== 'all') employees = employees.filter(e => e.employeeType === _filterType);
  const daysMap = {};
  for (const e of employees) daysMap[e.id] = dayBreakdownFor(e).days;
  return calculatePayroll(employees, settings, daysMap);
}

function renderRows(container) {
  const settings  = getSettings();
  let employees   = getEmployees();

  if (_filterType !== 'all') {
    employees = employees.filter(e => e.employeeType === _filterType);
  }

  // Compute breakdown per employee (used for cell hints) and the days map
  const breakdowns = {};
  const daysMap = {};
  for (const e of employees) {
    breakdowns[e.id] = dayBreakdownFor(e);
    daysMap[e.id]    = breakdowns[e.id].days;
  }
  let rows = calculatePayroll(employees, settings, daysMap);

  // Sort
  rows = [...rows].sort((a, b) => {
    let va = a[_sortKey] ?? '';
    let vb = b[_sortKey] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Count label
  const total = getEmployees().length;
  document.getElementById('payroll-count-label').textContent =
    `${rows.length} employee${rows.length !== 1 ? 's' : ''} shown · ${total} total`;

  // Update sort icons
  document.querySelectorAll('#payroll-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.key === _sortKey) {
      th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = _sortDir === 'asc' ? '↑' : '↓';
    } else {
      if (icon) icon.textContent = '↕';
    }
  });

  const tbody = document.getElementById('payroll-tbody');

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="13">
        <div class="table-empty">
          <div class="table-empty-icon">📋</div>
          <p>${_filterType !== 'all' ? 'No employees match this filter.' : 'No employees found. Add employees first.'}</p>
        </div>
      </td></tr>
    `;
    return;
  }

  const fmt    = n => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dataRows = rows.map(r => {
    const bd = breakdowns[r.id];
    let breakdownHint;
    if (bd.isManualOverride) {
      breakdownHint = `<div style="font-size:0.6rem;color:#ea580c;margin-top:2px;" title="Manual override — type a different number to change, or click Reset Days">manual</div>`;
    } else if (bd.isOutsideActivePeriod && !bd.permanence) {
      breakdownHint = `<div style="font-size:0.6rem;color:#94a3b8;margin-top:2px;" title="This month is outside the role's active period(s) for the academic year">off-period</div>`;
    } else if (bd.hasEmployeeOverride) {
      const parts = [`${bd.calendarDays} fixed`];
      if (bd.absences   > 0) parts.push(`− ${bd.absences} abs`);
      if (bd.permanence > 0) parts.push(`+ ${bd.permanence} perm`);
      breakdownHint = `<div style="font-size:0.62rem;color:#ea580c;margin-top:2px;line-height:1.2;font-weight:600;" title="Days override is set on this employee's profile (replaces calendar). Edit the employee to change or clear it.">${parts.join(' ')}</div>`;
    } else {
      const parts = [`${bd.calendarDays} cal`];
      if (bd.holidays   > 0) parts.push(`− ${bd.holidays} hol`);
      if (bd.absences   > 0) parts.push(`− ${bd.absences} abs`);
      if (bd.permanence > 0) parts.push(`+ ${bd.permanence} perm`);
      breakdownHint = `<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:2px;line-height:1.2;" title="Calendar working days, minus absences, plus permanence days approved by admin">${parts.join(' ')}</div>`;
    }
    return `
    <tr>
      <td><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong></td>
      <td><span class="badge badge-${r.employeeType === 'Teacher' ? 'teacher' : 'admin'}">${r.employeeType === 'Admin' ? 'Admin' : 'Teacher'}</span></td>
      <td>
        <div style="display:inline-flex;align-items:center;gap:4px;">
          <input type="number" class="days-input" min="0" max="31" data-emp-id="${esc(r.id)}" value="${r.daysWorked}" style="width:52px;text-align:center;" oninput="if(this.value.length>2)this.value=this.value.slice(0,2)">
          ${bd.isManualOverride ? `<button class="reset-one-day-btn" data-emp-id="${esc(r.id)}" title="Reset to auto-computed days" style="border:none;background:transparent;cursor:pointer;font-size:0.85rem;color:#ea580c;padding:2px 4px;line-height:1;">↺</button>` : ''}
        </div>
        ${breakdownHint}
      </td>
      <td class="num-lbp">${fmt(r.baseSalaryLBP)} ل.ل</td>
      <td>${fmtUSD(r.baseSalaryUSD)}</td>
      <td class="num-lbp">${fmt(r.transportPerDayLBP)} ل.ل</td>
      <td>${fmtUSD(r.transportPerDayUSD)}</td>
      <td class="num-lbp">${fmt(r.totalTransportLBP)} ل.ل</td>
      <td>${fmtUSD(r.totalTransportUSD)}</td>
      <td style="color:var(--color-danger)">- ${fmt(r.taxLBP)} ل.ل</td>
      <td style="color:var(--color-danger)">- ${fmt(r.nfsLBP)} ل.ل</td>
      <td><strong>${fmt(r.netSalaryLBP)} ل.ل</strong></td>
      <td><strong>${fmtUSD(r.netSalaryUSD)}</strong></td>
    </tr>
  `;
  }).join('');

  // Totals row
  const totals = calculateTotals(rows);
  const totalsRow = `
    <tr class="totals-row">
      <td colspan="3"><strong>TOTALS (${rows.length})</strong></td>
      <td>${fmt(totals.baseSalaryLBP)} ل.ل</td>
      <td>${fmtUSD(totals.baseSalaryUSD)}</td>
      <td>${fmt(totals.transportPerDayLBP)} ل.ل</td>
      <td>${fmtUSD(totals.transportPerDayUSD)}</td>
      <td>${fmt(totals.totalTransportLBP)} ل.ل</td>
      <td>${fmtUSD(totals.totalTransportUSD)}</td>
      <td style="color:var(--color-danger)">- ${fmt(totals.taxLBP)} ل.ل</td>
      <td style="color:var(--color-danger)">- ${fmt(totals.nfsLBP)} ل.ل</td>
      <td>${fmt(totals.netSalaryLBP)} ل.ل</td>
      <td>${fmtUSD(totals.netSalaryUSD)}</td>
    </tr>
  `;

  tbody.innerHTML = dataRows + totalsRow;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
