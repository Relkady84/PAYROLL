import {
  getEmployees, getSettings, getAbsenceRequests,
  getCalendar, getCurrentAcademicYear, findAcademicYearForMonth, getRoleRegistry,
  getAcademicYears
} from '../data/store.js';
import { calculatePayroll, calculateTotals, computeEffectiveDays } from '../services/payroll.js';
import { exportCSV, exportExcel, exportPDF } from '../services/exportService.js';
import { importCSV, importExcel } from '../services/importService.js';
import { showToast } from './components/toast.js';

let _filterType  = 'all';
let _sortKey     = 'firstName';
let _sortDir     = 'asc';
let _daysWorked  = {};       // manual overrides (empId -> days)
let _selectedMonth = null;   // 'YYYY-MM' — default current month

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  _daysWorked = {};
  _selectedMonth = _selectedMonth || defaultMonth();

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Payroll Report</h1>
        <span class="content-header-subtitle" id="payroll-count-label">Loading…</span>
      </div>
    </div>
    <div class="page-body">
      <div class="section-card">

        <div class="toolbar">
          <div class="toolbar-left">
            <select class="filter-select" id="payroll-type-filter">
              <option value="all">All Types</option>
              <option value="Teacher">Teachers</option>
              <option value="Admin">Administrators</option>
            </select>
            <label style="font-size:0.8rem;color:var(--color-text-muted);font-weight:500;margin-left:8px;">Month:</label>
            <input type="month" id="payroll-month" value="${_selectedMonth}"
              style="padding:6px 10px;border:1.5px solid var(--color-border);border-radius:6px;font-size:0.85rem;font-family:inherit;outline:none;">
            <button class="btn btn-secondary btn-sm" id="payroll-reset-days" style="margin-left:8px;" title="Reset manual day overrides — recompute from approved absences">↺ Reset Days</button>
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
                <th class="sortable" data-key="firstName">Name <span class="sort-icon">↕</span></th>
                <th>Type</th>
                <th>Transport Days</th>
                <th class="sortable" data-key="baseSalaryLBP">Base Salary (LBP) <span class="sort-icon">↕</span></th>
                <th>Base Salary (USD)</th>
                <th>Transport/Day (LBP)</th>
                <th>Transport/Day (USD)</th>
                <th>Total Transport (LBP)</th>
                <th>Total Transport (USD)</th>
                <th>Tax (LBP)</th>
                <th>NFS (LBP)</th>
                <th class="sortable" data-key="netSalaryLBP">Net Salary (LBP) <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="netSalaryUSD">Net Salary (USD) <span class="sort-icon">↕</span></th>
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
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 31) val = 31;
    _daysWorked[input.dataset.empId] = val;
    renderRows(container);
  });

  // Filter
  document.getElementById('payroll-type-filter').addEventListener('change', e => {
    _filterType = e.target.value;
    renderRows(container);
  });

  // Month picker — recomputes days worked from approved absences for that month
  document.getElementById('payroll-month').addEventListener('change', e => {
    _selectedMonth = e.target.value || defaultMonth();
    _daysWorked = {}; // clear manual overrides when changing month
    renderRows(container);
  });

  // Reset manual overrides
  document.getElementById('payroll-reset-days').addEventListener('click', () => {
    _daysWorked = {};
    renderRows(container);
    showToast('Days reset — recomputed from approved absences.', 'info');
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
    } else if (bd.isOutsideActivePeriod) {
      breakdownHint = `<div style="font-size:0.6rem;color:#94a3b8;margin-top:2px;" title="This month is outside the role's active period(s) for the academic year">off-period</div>`;
    } else {
      breakdownHint = `<div style="font-size:0.62rem;color:var(--color-text-muted);margin-top:2px;line-height:1.2;" title="${bd.calendarDays} working days from calendar/active period (after weekends + ${bd.holidays} holiday${bd.holidays !== 1 ? 's' : ''}) − ${bd.absences} approved absence${bd.absences !== 1 ? 's' : ''}">${bd.calendarDays} cal${bd.holidays > 0 ? ` − ${bd.holidays} hol` : ''}${bd.absences > 0 ? ` − ${bd.absences} abs` : ''}</div>`;
    }
    return `
    <tr>
      <td><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong></td>
      <td><span class="badge badge-${r.employeeType === 'Teacher' ? 'teacher' : 'admin'}">${r.employeeType === 'Admin' ? 'Admin' : 'Teacher'}</span></td>
      <td>
        <input type="number" class="days-input" min="0" max="31" data-emp-id="${esc(r.id)}" value="${r.daysWorked}" style="width:52px;text-align:center;" oninput="if(this.value.length>2)this.value=this.value.slice(0,2)">
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
