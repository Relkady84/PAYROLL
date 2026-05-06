/**
 * Export payroll rows to CSV, Excel (.xlsx), or PDF.
 * Depends on: PapaParse (window.Papa), SheetJS (window.XLSX), jsPDF (window.jspdf)
 */

// ── Column definitions ────────────────────────────────────
const COLUMNS = [
  { key: 'firstName',          label: 'First Name' },
  { key: 'lastName',           label: 'Last Name' },
  { key: 'employeeType',       label: 'Type' },
  { key: 'age',                label: 'Age' },
  { key: 'homeLocation',       label: 'Home Location' },
  { key: 'kmDistance',         label: 'Distance (km)' },
  { key: 'daysWorked',         label: 'Days Worked' },
  { key: 'baseSalaryLBP',      label: 'Base Salary (LBP)' },
  { key: 'baseSalaryUSD',      label: 'Base Salary (USD)' },
  { key: 'totalTransportLBP',  label: 'Transport (LBP)' },
  { key: 'totalTransportUSD',  label: 'Transport (USD)' },
  { key: 'taxLBP',             label: 'Tax (LBP)' },
  { key: 'nfsLBP',             label: 'NFS (LBP)' },
  { key: 'netSalaryLBP',       label: 'Net Salary (LBP)' },
  { key: 'netSalaryUSD',       label: 'Net Salary (USD)' }
];

function rowsToPlain(rows) {
  return rows.map(r => {
    const obj = {};
    for (const col of COLUMNS) {
      let val = r[col.key] ?? '';
      if (typeof val === 'number') val = Math.round(val * 100) / 100;
      obj[col.label] = val;
    }
    return obj;
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV ───────────────────────────────────────────────────
export function exportCSV(rows) {
  const plain = rowsToPlain(rows);
  let csv;
  if (window.Papa) {
    csv = window.Papa.unparse(plain);
  } else {
    const headers = COLUMNS.map(c => c.label);
    const escape  = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines   = [
      headers.map(escape).join(','),
      ...plain.map(row => headers.map(h => escape(row[h] ?? '')).join(','))
    ];
    csv = lines.join('\r\n');
  }
  // BOM for correct Arabic character display in Excel
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `payroll_${dateStamp()}.csv`);
}

// ── Excel ─────────────────────────────────────────────────
export function exportExcel(rows) {
  if (!window.XLSX) {
    alert('Excel library not loaded. Check your internet connection.');
    return;
  }
  const plain    = rowsToPlain(rows);
  const ws       = window.XLSX.utils.json_to_sheet(plain);

  // Column widths
  ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length, 14) }));

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
  window.XLSX.writeFile(wb, `payroll_${dateStamp()}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────
export function exportPDF(rows, settings) {
  if (!window.jspdf) {
    alert('PDF library not loaded. Check your internet connection.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Defensive formatters — handle null/undefined gracefully (just shows '—')
  const fmt    = n => (typeof n === 'number' && !isNaN(n))
    ? Math.round(n).toLocaleString('en-US') : '—';
  const fmtUSD = n => (typeof n === 'number' && !isNaN(n))
    ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Payroll Report', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB')}  |  Rate: 1 USD = ${settings.exchangeRate.toLocaleString()} LBP  |  Employees: ${rows.length}`,
    14, 22
  );
  doc.setTextColor(0);

  // Table columns (abbreviated for landscape A4)
  const pdfColumns = [
    { header: 'Name',            dataKey: 'name' },
    { header: 'Type',            dataKey: 'type' },
    { header: 'Base (LBP)',      dataKey: 'baseLBP' },
    { header: 'Base (USD)',      dataKey: 'baseUSD' },
    { header: 'Transport (LBP)', dataKey: 'transLBP' },
    { header: 'Transport (USD)', dataKey: 'transUSD' },
    { header: 'Tax (LBP)',       dataKey: 'tax' },
    { header: 'NFS (LBP)',       dataKey: 'nfs' },
    { header: 'Net (LBP)',       dataKey: 'netLBP' },
    { header: 'Net (USD)',       dataKey: 'netUSD' }
  ];

  const pdfRows = rows.map(r => ({
    name:     `${r.firstName || ''} ${r.lastName || ''}`.trim(),
    type:     r.employeeType,
    baseLBP:  fmt(r.baseSalaryLBP),
    baseUSD:  fmtUSD(r.baseSalaryUSD),
    transLBP: fmt(r.totalTransportLBP),
    transUSD: fmtUSD(r.totalTransportUSD),
    tax:      fmt(r.taxLBP),
    nfs:      fmt(r.nfsLBP),
    netLBP:   fmt(r.netSalaryLBP),
    netUSD:   fmtUSD(r.netSalaryUSD)
  }));

  doc.autoTable({
    startY: 26,
    columns: pdfColumns,
    body: pdfRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      name:     { cellWidth: 36 },
      type:     { cellWidth: 22 },
      baseLBP:  { halign: 'right' },
      baseUSD:  { halign: 'right' },
      transLBP: { halign: 'right' },
      transUSD: { halign: 'right' },
      tax:      { halign: 'right' },
      nfs:      { halign: 'right' },
      netLBP:   { halign: 'right', fontStyle: 'bold' },
      netUSD:   { halign: 'right', fontStyle: 'bold' }
    }
  });

  doc.save(`payroll_${dateStamp()}.pdf`);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
