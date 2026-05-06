import {
  getEmployees, getSettings, getCompanyMetadata,
  getCalendar, getAbsenceRequests, getRoleRegistry,
  findAcademicYearForMonth, getAcademicYears
} from '../data/store.js';
import { calculatePayroll, computeEffectiveDays } from '../services/payroll.js';
import { exportPDF, exportExcel, printPaySlips, fmt } from '../services/reportExport.js';
import { t } from '../i18n.js';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Report definitions ───────────────────────────────────
function buildReports(payroll, settings) {
  const taxRates = settings.taxRates || {};
  const nfsRates = settings.nfsRates || {};

  return [

    // 1. Monthly Payroll Summary
    {
      id: 'payroll-summary',
      icon: '📊',
      title: 'Monthly Payroll Summary',
      description: 'Full payroll breakdown for all employees — base salary, transport, deductions and net pay.',
      filename: 'payroll-summary',
      sheetName: 'Payroll Summary',
      headers: ['#', 'Name', 'Type', 'Base Salary (LBP)', 'Base Salary (USD)',
                'Transport Days', 'Transport/Day (LBP)', 'Total Transport (LBP)',
                'Tax (LBP)', 'NFS (LBP)', 'Net Salary (LBP)', 'Net Salary (USD)'],
      getData: () => {
        const rows = payroll.map((e, i) => [
          i + 1,
          `${e.firstName} ${e.lastName}`,
          e.employeeType,
          fmt.lbp(e.baseSalaryLBP),
          fmt.usd(e.baseSalaryUSD),
          e.daysWorked,
          fmt.lbp(e.transportPerDayLBP),
          fmt.lbp(e.totalTransportLBP),
          fmt.lbp(e.taxLBP),
          fmt.lbp(e.nfsLBP),
          fmt.lbp(e.netSalaryLBP),
          fmt.usd(e.netSalaryUSD),
        ]);
        const totals = [
          'TOTAL', '', '',
          fmt.lbp(sum(payroll, 'baseSalaryLBP')),
          fmt.usd(sum(payroll, 'baseSalaryUSD')),
          '',
          '',
          fmt.lbp(sum(payroll, 'totalTransportLBP')),
          fmt.lbp(sum(payroll, 'taxLBP')),
          fmt.lbp(sum(payroll, 'nfsLBP')),
          fmt.lbp(sum(payroll, 'netSalaryLBP')),
          fmt.usd(sum(payroll, 'netSalaryUSD')),
        ];
        return { rows, totals };
      }
    },

    // 2. Transport Allowance Report
    {
      id: 'transport',
      icon: '🚗',
      title: 'Transport Allowance Report',
      description: 'Distance, transport days and daily/monthly transport cost per employee.',
      filename: 'transport-report',
      sheetName: 'Transport',
      headers: ['#', 'Name', 'Type', 'Distance (km)', 'Transport Days',
                'Transport/Day (LBP)', 'Transport/Day (USD)',
                'Total Transport (LBP)', 'Total Transport (USD)'],
      getData: () => {
        const rows = payroll.map((e, i) => [
          i + 1,
          `${e.firstName} ${e.lastName}`,
          e.employeeType,
          e.kmDistance,
          e.daysWorked,
          fmt.lbp(e.transportPerDayLBP),
          fmt.usd(e.transportPerDayUSD),
          fmt.lbp(e.totalTransportLBP),
          fmt.usd(e.totalTransportUSD),
        ]);
        const totals = [
          'TOTAL', '', '', '', '',
          '',
          '',
          fmt.lbp(sum(payroll, 'totalTransportLBP')),
          fmt.usd(sum(payroll, 'totalTransportUSD')),
        ];
        return { rows, totals };
      }
    },

    // 3. Deductions Report
    {
      id: 'deductions',
      icon: '📉',
      title: 'Deductions Report',
      description: 'Income tax and NFS/NSSF deductions per employee with applicable rates.',
      filename: 'deductions-report',
      sheetName: 'Deductions',
      headers: ['#', 'Name', 'Type', 'Base Salary (LBP)',
                'Tax Rate', 'Tax (LBP)',
                'NFS Rate', 'NFS (LBP)',
                'Total Deductions (LBP)', 'Total Deductions (USD)'],
      getData: () => {
        const rows = payroll.map((e, i) => [
          i + 1,
          `${e.firstName} ${e.lastName}`,
          e.employeeType,
          fmt.lbp(e.baseSalaryLBP),
          fmt.pct(taxRates[e.employeeType] || 0),
          fmt.lbp(e.taxLBP),
          fmt.pct(nfsRates[e.employeeType] || 0),
          fmt.lbp(e.nfsLBP),
          fmt.lbp(e.taxLBP + e.nfsLBP),
          fmt.usd(e.taxUSD + e.nfsUSD),
        ]);
        const totals = [
          'TOTAL', '', '',
          fmt.lbp(sum(payroll, 'baseSalaryLBP')),
          '', fmt.lbp(sum(payroll, 'taxLBP')),
          '', fmt.lbp(sum(payroll, 'nfsLBP')),
          fmt.lbp(sum(payroll, 'taxLBP') + sum(payroll, 'nfsLBP')),
          fmt.usd(sum(payroll, 'taxUSD') + sum(payroll, 'nfsUSD')),
        ];
        return { rows, totals };
      }
    },

    // 4. Net Payment Sheet
    {
      id: 'payment-sheet',
      icon: '💰',
      title: 'Net Payment Sheet',
      description: 'Clean payment list with employee names and final net salaries — for bank transfers or cash payouts.',
      filename: 'payment-sheet',
      sheetName: 'Payments',
      headers: ['#', 'Name', 'Type', 'Net Salary (LBP)', 'Net Salary (USD)'],
      getData: () => {
        const rows = payroll.map((e, i) => [
          i + 1,
          `${e.firstName} ${e.lastName}`,
          e.employeeType,
          fmt.lbp(e.netSalaryLBP),
          fmt.usd(e.netSalaryUSD),
        ]);
        const totals = [
          'TOTAL', '', '',
          fmt.lbp(sum(payroll, 'netSalaryLBP')),
          fmt.usd(sum(payroll, 'netSalaryUSD')),
        ];
        return { rows, totals };
      }
    },

    // 5. Employee Directory
    {
      id: 'directory',
      icon: '👥',
      title: 'Employee Directory',
      description: 'Full staff list with contact details, role and salary information.',
      filename: 'employee-directory',
      sheetName: 'Directory',
      headers: ['#', 'First Name', 'Last Name', 'Type', 'Age', 'Home Location',
                'Email', 'Base Salary (USD)', 'Base Salary (LBP)', 'Distance (km)'],
      getData: () => {
        const rows = payroll.map((e, i) => [
          i + 1,
          e.firstName,
          e.lastName,
          e.employeeType,
          e.age || '—',
          e.homeLocation || '—',
          e.email || '—',
          fmt.usd(e.baseSalaryUSD),
          fmt.lbp(e.baseSalaryLBP),
          e.kmDistance,
        ]);
        return { rows, totals: null };
      }
    },

    // 6. Department Summary
    {
      id: 'dept-summary',
      icon: '📈',
      title: 'Department Summary',
      description: 'Aggregated totals grouped by department — Teachers vs Administration.',
      filename: 'department-summary',
      sheetName: 'By Department',
      headers: ['Department', 'Headcount', 'Total Base (LBP)', 'Total Transport (LBP)',
                'Total Tax (LBP)', 'Total NFS (LBP)', 'Total Deductions (LBP)', 'Total Net (LBP)', 'Total Net (USD)'],
      getData: () => {
        const types = [...new Set(payroll.map(e => e.employeeType))].sort();
        const rows = types.map(type => {
          const group = payroll.filter(e => e.employeeType === type);
          return [
            type,
            group.length,
            fmt.lbp(sum(group, 'baseSalaryLBP')),
            fmt.lbp(sum(group, 'totalTransportLBP')),
            fmt.lbp(sum(group, 'taxLBP')),
            fmt.lbp(sum(group, 'nfsLBP')),
            fmt.lbp(sum(group, 'taxLBP') + sum(group, 'nfsLBP')),
            fmt.lbp(sum(group, 'netSalaryLBP')),
            fmt.usd(sum(group, 'netSalaryUSD')),
          ];
        });
        const totals = [
          'GRAND TOTAL',
          payroll.length,
          fmt.lbp(sum(payroll, 'baseSalaryLBP')),
          fmt.lbp(sum(payroll, 'totalTransportLBP')),
          fmt.lbp(sum(payroll, 'taxLBP')),
          fmt.lbp(sum(payroll, 'nfsLBP')),
          fmt.lbp(sum(payroll, 'taxLBP') + sum(payroll, 'nfsLBP')),
          fmt.lbp(sum(payroll, 'netSalaryLBP')),
          fmt.usd(sum(payroll, 'netSalaryUSD')),
        ];
        return { rows, totals };
      }
    },

    // 7. Salary Cost Analysis
    {
      id: 'cost-analysis',
      icon: '🔍',
      title: 'Salary Cost Analysis',
      description: 'Breakdown of total payroll cost components — base, transport and deductions as amounts and percentages.',
      filename: 'cost-analysis',
      sheetName: 'Cost Analysis',
      headers: ['#', 'Name', 'Type', 'Base (LBP)', '% of Net', 'Transport (LBP)', '% of Net',
                'Deductions (LBP)', '% of Net', 'Net (LBP)'],
      getData: () => {
        const rows = payroll.map((e, i) => {
          const net = e.netSalaryLBP || 1;
          const gross = e.baseSalaryLBP + e.totalTransportLBP;
          return [
            i + 1,
            `${e.firstName} ${e.lastName}`,
            e.employeeType,
            fmt.lbp(e.baseSalaryLBP),
            `${((e.baseSalaryLBP / gross) * 100).toFixed(1)}%`,
            fmt.lbp(e.totalTransportLBP),
            `${((e.totalTransportLBP / gross) * 100).toFixed(1)}%`,
            fmt.lbp(e.taxLBP + e.nfsLBP),
            `${(((e.taxLBP + e.nfsLBP) / gross) * 100).toFixed(1)}%`,
            fmt.lbp(e.netSalaryLBP),
          ];
        });
        const totals = [
          'TOTAL', '', '',
          fmt.lbp(sum(payroll, 'baseSalaryLBP')), '',
          fmt.lbp(sum(payroll, 'totalTransportLBP')), '',
          fmt.lbp(sum(payroll, 'taxLBP') + sum(payroll, 'nfsLBP')), '',
          fmt.lbp(sum(payroll, 'netSalaryLBP')),
        ];
        return { rows, totals };
      }
    },

  ];
}

// ── Main render ──────────────────────────────────────────
export async function render(selector) {
  const container = document.querySelector(selector);
  const employees = getEmployees();
  const settings  = getSettings();
  const meta      = await getCompanyMetadata() || {};

  const now     = new Date();
  let selMonth  = now.getMonth();     // 0-indexed
  let selYear   = now.getFullYear();

  function getPayroll() {
    // Compute effective days per employee for the SELECTED month.
    // Uses calendar (weekends + holidays), academic year + role active periods,
    // approved absences (-1) and permanences (+1), and per-employee override
    // if set on the employee's profile.
    const calendar       = getCalendar();
    const absenceRequests = getAbsenceRequests();
    const roleRegistry   = getRoleRegistry();
    // selMonth is 0-based (JS Date), but findAcademicYearForMonth + computeEffectiveDays
    // expect 1-based month numbers
    const month1based    = selMonth + 1;
    const academicYear   = findAcademicYearForMonth(selYear, month1based);
    const hasAnyYears    = getAcademicYears().length > 0;

    const daysMap = {};
    for (const emp of employees) {
      // If academic years are defined but none covers this month → off-period (0 days)
      const forceOffPeriod = !academicYear && hasAnyYears;
      const bd = computeEffectiveDays({
        employee:        emp,
        calendar,
        absenceRequests,
        year:            selYear,
        month:           month1based,
        academicYear,
        roleRegistry,
        forceOffPeriod
      });
      daysMap[emp.id] = bd.days;
    }

    return calculatePayroll(employees, settings, daysMap);
  }

  function getContext() {
    return {
      month:        MONTHS[selMonth],
      year:         selYear,
      companyName:  meta.name || 'Company',
      exchangeRate: settings.exchangeRate,
    };
  }

  function renderPage() {
    const payroll = getPayroll();
    const reports = buildReports(payroll, settings);
    const ctx     = getContext();

    container.innerHTML = `
      <div class="content-header">
        <div class="content-header-left">
          <h1>${t('reports.title')}</h1>
          <span class="content-header-subtitle">${t('reports.title')}</span>
        </div>
        <div class="content-header-actions">
          <select id="report-month" class="form-control" style="width:130px;">
            ${MONTHS.map((m, i) => `<option value="${i}" ${i === selMonth ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <input id="report-year" type="number" class="form-control" style="width:90px;"
            value="${selYear}" min="2020" max="2099">
        </div>
      </div>

      <div class="page-body">
        <!-- Pay Slips card — special -->
        <div class="section-card" style="margin-bottom:20px;">
          <div class="section-card-header" style="background:#0f172a;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">💳</span>
              <div>
                <div style="font-weight:700;font-size:1rem;color:#fff;">Individual Pay Slips</div>
                <div style="font-size:0.78rem;color:#94a3b8;margin-top:2px;">
                  Beautiful formatted pay slip for each employee — print or save as PDF.
                </div>
              </div>
            </div>
          </div>
          <div class="section-card-body" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div class="form-group" style="margin:0;min-width:200px;flex:1;">
              <label class="form-label" style="margin-bottom:4px;">Employee</label>
              <select id="slip-employee-select" class="form-control">
                <option value="all">All Employees (${payroll.length})</option>
                ${payroll.map(e => `<option value="${e.id}">${e.firstName} ${e.lastName} (${e.employeeType})</option>`).join('')}
              </select>
            </div>
            <div style="padding-top:20px;">
              <button class="btn btn-primary" id="print-slips-btn" style="gap:6px;">
                🖨️ Print / Save PDF
              </button>
            </div>
          </div>
        </div>

        <!-- Report cards grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;">
          ${reports.map(r => _reportCard(r)).join('')}
        </div>

        ${payroll.length === 0 ? `
          <div style="text-align:center;padding:48px;color:#94a3b8;">
            <div style="font-size:48px;margin-bottom:12px;">📭</div>
            <div style="font-size:1rem;font-weight:600;margin-bottom:4px;">No employees found</div>
            <div style="font-size:0.85rem;">Add employees first to generate reports.</div>
          </div>
        ` : ''}
      </div>
    `;

    // Period picker
    document.getElementById('report-month').addEventListener('change', e => {
      selMonth = parseInt(e.target.value);
    });
    document.getElementById('report-year').addEventListener('change', e => {
      selYear = parseInt(e.target.value) || now.getFullYear();
    });

    // Pay slips button
    document.getElementById('print-slips-btn').addEventListener('click', () => {
      const val = document.getElementById('slip-employee-select').value;
      const slips = val === 'all'
        ? payroll
        : payroll.filter(e => e.id === val);
      if (!slips.length) return;
      printPaySlips(slips, meta, { month: MONTHS[selMonth], year: selYear });
    });

    // Report card buttons
    reports.forEach(report => {
      const { rows, totals } = report.getData();
      const ctx = getContext();

      document.getElementById(`pdf-${report.id}`)?.addEventListener('click', () => {
        exportPDF({ ...ctx, headers: report.headers, rows, totals, filename: report.filename, title: report.title });
      });

      document.getElementById(`excel-${report.id}`)?.addEventListener('click', () => {
        exportExcel({ ...ctx, headers: report.headers, rows, totals, filename: report.filename, title: report.title, sheetName: report.sheetName });
      });
    });
  }

  renderPage();
}

// ── Report card template ─────────────────────────────────
function _reportCard(r) {
  return `
    <div class="section-card" style="display:flex;flex-direction:column;">
      <div class="section-card-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">${r.icon}</span>
          <span class="section-card-title">${r.title}</span>
        </div>
      </div>
      <div class="section-card-body" style="flex:1;display:flex;flex-direction:column;gap:14px;">
        <p style="font-size:0.82rem;color:#64748b;margin:0;">${r.description}</p>
        <div style="display:flex;gap:8px;margin-top:auto;">
          <button id="pdf-${r.id}" class="btn btn-primary" style="flex:1;justify-content:center;">
            📄 PDF
          </button>
          <button id="excel-${r.id}" class="btn btn-secondary" style="flex:1;justify-content:center;">
            📊 Excel
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Helpers ──────────────────────────────────────────────
function sum(arr, key) {
  return arr.reduce((acc, e) => acc + (e[key] || 0), 0);
}
