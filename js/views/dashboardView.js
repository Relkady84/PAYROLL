import { getEmployees, getSettings, getAbsenceRequests } from '../data/store.js';
import { calculatePayroll, calculateTotals } from '../services/payroll.js';
import { navigate } from '../router.js';

export function render(selector) {
  const container = document.querySelector(selector);
  const settings  = getSettings();
  const employees = getEmployees();
  const rows      = calculatePayroll(employees, settings);
  const totals    = calculateTotals(rows);

  const teacherRows = rows.filter(r => r.employeeType === 'Teacher');
  const adminRows   = rows.filter(r => r.employeeType === 'Admin');
  const tTotals     = calculateTotals(teacherRows);
  const aTotals     = calculateTotals(adminRows);

  const fmtLBP = n => n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ل.ل';
  const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const noConfig = settings.taxRates.Teacher === 0 &&
                   settings.taxRates.Admin === 0 &&
                   settings.nfsRates.Teacher === 0 &&
                   settings.nfsRates.Admin === 0 &&
                   settings.fuelPricePerLitre === 0;

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Dashboard</h1>
        <span class="content-header-subtitle">Payroll overview — rate: 1 USD = ${settings.exchangeRate.toLocaleString()} ل.ل</span>
      </div>
    </div>
    <div class="page-body">

      ${noConfig ? `
        <div class="alert alert-warning" style="margin-bottom:20px;">
          <span>⚠</span>
          <span>Settings have not been configured yet. <a href="#settings" style="color:inherit;font-weight:600;text-decoration:underline;">Go to Settings</a> to set tax rates, NFS rates, and fuel price.</span>
        </div>
      ` : ''}

      ${(() => {
        const pending = getAbsenceRequests().filter(r => r.status === 'pending').length;
        return pending > 0 ? `
          <div class="alert alert-info" style="margin-bottom:20px;">
            <span>📅</span>
            <span><strong>${pending} absence request${pending !== 1 ? 's' : ''}</strong> waiting for review.
              <a href="#absence-requests" style="color:inherit;font-weight:600;text-decoration:underline;">Review now →</a>
            </span>
          </div>
        ` : '';
      })()}

      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-icon blue">👥</div>
          <div class="stat-card-body">
            <div class="stat-card-label">Total Employees</div>
            <div class="stat-card-value">${employees.length}</div>
            <div class="stat-card-sub">${teacherRows.length} teachers · ${adminRows.length} admins</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon green">💰</div>
          <div class="stat-card-body">
            <div class="stat-card-label">Total Net Payroll</div>
            <div class="stat-card-value">${fmtUSD(totals.netSalaryUSD)}</div>
            <div class="stat-card-sub">${fmtLBP(totals.netSalaryLBP)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon orange">📊</div>
          <div class="stat-card-body">
            <div class="stat-card-label">Avg Net Salary</div>
            <div class="stat-card-value">${employees.length ? fmtUSD(totals.netSalaryUSD / employees.length) : '$0.00'}</div>
            <div class="stat-card-sub">per employee / month</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon cyan">🚌</div>
          <div class="stat-card-body">
            <div class="stat-card-label">Total Transport</div>
            <div class="stat-card-value">${fmtUSD(totals.totalTransportUSD)}</div>
            <div class="stat-card-sub">${fmtLBP(totals.totalTransportLBP)}</div>
          </div>
        </div>
      </div>

      ${employees.length === 0 ? `
        <div class="section-card">
          <div class="section-card-body">
            <div class="table-empty">
              <div class="table-empty-icon">📋</div>
              <p>No employees added yet. Add employees to see payroll calculations.</p>
              <button class="btn btn-primary" id="goto-employees">+ Add Employees</button>
            </div>
          </div>
        </div>
      ` : `
        <div class="breakdown-grid">
          ${buildBreakdownCard('Teacher', 'teacher', teacherRows, tTotals, fmtLBP, fmtUSD)}
          ${buildBreakdownCard('Personal Administrator', 'admin', adminRows, aTotals, fmtLBP, fmtUSD)}
        </div>

        <div class="section-card" style="margin-top:20px;">
          <div class="section-card-header">
            <span class="section-card-title">Payroll Summary</span>
            <a href="#payroll" class="btn btn-secondary btn-sm">View Full Report →</a>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Base Salary</th>
                  <th>Transport</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong></td>
                    <td><span class="badge badge-${r.employeeType === 'Teacher' ? 'teacher' : 'admin'}">${r.employeeType === 'Admin' ? 'Admin' : 'Teacher'}</span></td>
                    <td>
                      <span class="num-lbp">${fmtLBP(r.baseSalaryLBP)}</span>
                      <span class="num-usd">${fmtUSD(r.baseSalaryUSD)}</span>
                    </td>
                    <td>
                      <span class="num-lbp">${fmtLBP(r.totalTransportLBP)}</span>
                      <span class="num-usd">${fmtUSD(r.totalTransportUSD)}</span>
                    </td>
                    <td>
                      <span class="num-lbp" style="color:var(--color-danger)">- ${fmtLBP(r.taxLBP + r.nfsLBP)}</span>
                    </td>
                    <td>
                      <span class="num-lbp" style="font-weight:700;">${fmtLBP(r.netSalaryLBP)}</span>
                      <span class="num-usd" style="font-weight:600;">${fmtUSD(r.netSalaryUSD)}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;

  document.getElementById('goto-employees')?.addEventListener('click', () => navigate('#employees'));
}

function buildBreakdownCard(label, cssClass, rows, totals, fmtLBP, fmtUSD) {
  return `
    <div class="breakdown-card">
      <div class="breakdown-card-type ${cssClass}">${label}s (${rows.length})</div>
      <div class="breakdown-row"><span>Total Base Salary</span><strong>${fmtUSD(totals.baseSalaryUSD)}</strong></div>
      <div class="breakdown-row"><span>Transport Allowance</span><strong>${fmtUSD(totals.totalTransportUSD)}</strong></div>
      <div class="breakdown-row"><span>Tax Deductions</span><strong style="color:var(--color-danger)">- ${fmtUSD(totals.taxUSD)}</strong></div>
      <div class="breakdown-row"><span>NFS Deductions</span><strong style="color:var(--color-danger)">- ${fmtUSD(totals.nfsUSD)}</strong></div>
      <div class="breakdown-row"><span>Net Payroll</span><strong style="color:var(--color-success)">${fmtUSD(totals.netSalaryUSD)}</strong></div>
    </div>
  `;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
