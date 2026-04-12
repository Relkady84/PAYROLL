/**
 * Report export helpers — PDF (jsPDF + AutoTable), Excel (SheetJS), Print
 * All libraries loaded via CDN in index.html
 */

const BLUE  = [37, 99, 235];
const LIGHT = [248, 250, 252];
const FOOT  = [241, 245, 249];
const DARK  = [30, 41, 59];

// ── Format helpers ───────────────────────────────────────
export const fmt = {
  lbp: n => `${Math.round(n || 0).toLocaleString('en-US')} LBP`,
  usd: n => `$${(n || 0).toFixed(2)}`,
  num: n => (n || 0).toLocaleString('en-US'),
  pct: n => `${((n || 0) * 100).toFixed(1)}%`,
  plain_lbp: n => Math.round(n || 0).toLocaleString('en-US'),
};

function escHtml(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── PDF header block ─────────────────────────────────────
function _pdfHeader(doc, { title, month, year, companyName, exchangeRate }) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.setTextColor(...DARK);
  doc.text(companyName || 'Payroll System', 14, 16);
  doc.setFontSize(10); doc.setFont(undefined, 'normal');
  doc.text(title, 14, 23);
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(
    `Period: ${month} ${year}   |   Rate: 1 USD = ${Number(exchangeRate || 89600).toLocaleString()} LBP`,
    14, 29
  );
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    W - 14, 29, { align: 'right' }
  );
  doc.setTextColor(0, 0, 0);
}

// ── Export PDF ───────────────────────────────────────────
export function exportPDF({ title, month, year, companyName, exchangeRate, headers, rows, totals, filename }) {
  if (!window.jspdf) { alert('PDF library not loaded. Please refresh the page.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: headers.length > 7 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  _pdfHeader(doc, { title, month, year, companyName, exchangeRate });

  doc.autoTable({
    startY: 34,
    head: [headers],
    body: rows,
    foot: totals ? [totals] : undefined,
    styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: FOOT, textColor: DARK, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT },
    margin: { left: 14, right: 14 },
    didDrawPage: ({ doc }) => {
      const pn = doc.internal.getCurrentPageInfo().pageNumber;
      const ph = doc.internal.pageSize.getHeight();
      const pw = doc.internal.pageSize.getWidth();
      doc.setFontSize(7); doc.setTextColor(160, 160, 160);
      doc.text(`Page ${pn}`, pw / 2, ph - 7, { align: 'center' });
      doc.setTextColor(0);
    }
  });

  doc.save(`${filename || 'report'}-${month}-${year}.pdf`);
}

// ── Export Excel ─────────────────────────────────────────
export function exportExcel({ title, month, year, companyName, headers, rows, totals, filename, sheetName }) {
  if (!window.XLSX) { alert('Excel library not loaded. Please refresh the page.'); return; }

  const data = [
    [companyName || 'Payroll System', '', '', `Period: ${month} ${year}`],
    [title],
    [],
    headers,
    ...rows,
  ];
  if (totals) data.push(totals);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto column widths
  const colWidths = data.reduce((acc, row) => {
    (row || []).forEach((cell, i) => {
      acc[i] = Math.max(acc[i] || 6, String(cell || '').length + 2);
    });
    return acc;
  }, []);
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 38) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');
  XLSX.writeFile(wb, `${filename || 'report'}-${month}-${year}.xlsx`);
}

// ── Print Pay Slips ──────────────────────────────────────
export function printPaySlips(slips, companyMeta, { month, year }) {
  const logoHtml = companyMeta?.logoUrl
    ? `<img src="${escHtml(companyMeta.logoUrl)}" style="height:44px;object-fit:contain;border-radius:6px;">`
    : `<div style="width:44px;height:44px;background:#2563eb;border-radius:8px;
         display:flex;align-items:center;justify-content:center;font-size:22px;">💼</div>`;

  const slipHtml = slips.map((s, i) => `
    <div class="slip">
      <div class="slip-top">
        <div class="slip-logo">${logoHtml}</div>
        <div class="slip-company">
          <div class="company-name">${escHtml(companyMeta?.name || 'Company')}</div>
          <div class="report-label">Salary Pay Slip — ${escHtml(month)} ${year}</div>
        </div>
        <div class="slip-num">Slip #${String(i + 1).padStart(3, '0')}</div>
      </div>

      <div class="employee-info">
        <div class="info-cell"><span>Employee Name</span><strong>${escHtml(s.firstName + ' ' + s.lastName)}</strong></div>
        <div class="info-cell"><span>Type</span><strong>${escHtml(s.employeeType)}</strong></div>
        <div class="info-cell"><span>Distance</span><strong>${s.kmDistance} km</strong></div>
        <div class="info-cell"><span>Transport Days</span><strong>${s.daysWorked} days</strong></div>
      </div>

      <table class="breakdown">
        <thead>
          <tr><th>Description</th><th>Amount (LBP)</th><th>Amount (USD)</th></tr>
        </thead>
        <tbody>
          <tr class="section-head"><td colspan="3">EARNINGS</td></tr>
          <tr>
            <td>Base Salary</td>
            <td class="num">${fmt.lbp(s.baseSalaryLBP)}</td>
            <td class="num alt">${fmt.usd(s.baseSalaryUSD)}</td>
          </tr>
          <tr>
            <td>Transport (${s.daysWorked} days × ${fmt.lbp(s.transportPerDayLBP)}/day)</td>
            <td class="num">${fmt.lbp(s.totalTransportLBP)}</td>
            <td class="num alt">${fmt.usd(s.totalTransportUSD)}</td>
          </tr>
          <tr class="sub-row">
            <td>Gross Total</td>
            <td class="num">${fmt.lbp(s.baseSalaryLBP + s.totalTransportLBP)}</td>
            <td class="num alt">${fmt.usd(s.baseSalaryUSD + s.totalTransportUSD)}</td>
          </tr>
          <tr class="section-head"><td colspan="3">DEDUCTIONS</td></tr>
          <tr>
            <td>Income Tax</td>
            <td class="num red">(${fmt.lbp(s.taxLBP)})</td>
            <td class="num alt">(${fmt.usd(s.taxUSD)})</td>
          </tr>
          <tr>
            <td>NFS / NSSF</td>
            <td class="num red">(${fmt.lbp(s.nfsLBP)})</td>
            <td class="num alt">(${fmt.usd(s.nfsUSD)})</td>
          </tr>
          <tr class="sub-row">
            <td>Total Deductions</td>
            <td class="num red">(${fmt.lbp(s.taxLBP + s.nfsLBP)})</td>
            <td class="num alt">(${fmt.usd(s.taxUSD + s.nfsUSD)})</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="net-row">
            <td>NET SALARY</td>
            <td class="num">${fmt.lbp(s.netSalaryLBP)}</td>
            <td class="num">${fmt.usd(s.netSalaryUSD)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="slip-footer">
        <div class="sig"><div class="sig-line"></div><span>Employee Signature</span></div>
        <div class="sig"><div class="sig-line"></div><span>Finance Officer</span></div>
        <div class="sig"><div class="sig-line"></div><span>Director / Principal</span></div>
      </div>
    </div>
  `).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Pay Slips — ${escHtml(month)} ${year}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; background: #f1f5f9; padding: 24px; color: #1e293b; }
  .slip { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px 32px; max-width: 700px; margin: 0 auto 36px; }
  .slip-top { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 3px solid #2563eb; margin-bottom: 16px; }
  .slip-company { flex: 1; }
  .company-name { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
  .report-label { font-size: 0.78rem; color: #64748b; margin-top: 2px; }
  .slip-num { font-size: 0.75rem; color: #94a3b8; font-weight: 600; }
  .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; }
  .info-cell { display: flex; flex-direction: column; gap: 2px; }
  .info-cell span { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
  .info-cell strong { font-size: 0.88rem; }
  .breakdown { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .breakdown thead tr { background: #1e40af; }
  .breakdown thead th { padding: 8px 10px; color: #fff; font-weight: 600; font-size: 0.78rem; text-align: left; font-family: Arial, sans-serif; }
  .breakdown thead th:not(:first-child) { text-align: right; }
  .breakdown td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  .breakdown td.num { text-align: right; font-family: 'Courier New', monospace; font-size: 0.82rem; }
  .breakdown td.alt { color: #64748b; }
  .breakdown td.red { color: #dc2626; }
  .section-head td { background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 10px; }
  .sub-row td { font-weight: 600; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  .net-row td { background: #0f172a; color: #fff; font-weight: 700; font-size: 1rem; padding: 11px 10px; }
  .slip-footer { display: flex; gap: 16px; justify-content: space-between; margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .sig { flex: 1; text-align: center; font-size: 0.72rem; color: #94a3b8; }
  .sig-line { border-top: 1px solid #cbd5e1; margin-bottom: 6px; padding-top: 32px; }
  @media print {
    body { background: #fff; padding: 0; }
    .slip { border: 1px solid #ccc; border-radius: 0; margin: 0; max-width: 100%; page-break-after: always; box-shadow: none; }
    .slip:last-child { page-break-after: auto; }
  }
</style>
</head><body>${slipHtml}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 700);
}
