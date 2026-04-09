/**
 * All salary calculation functions are pure — they take data, return results.
 * Rates stored in settings are decimals (0.05 = 5%).
 * Fuel price stored in settings is USD; converted to LBP internally.
 */

export function getFuelPriceInLBP(settings) {
  if (settings.fuelPriceCurrency === 'LBP') {
    return settings.fuelPricePerLitre;
  }
  return settings.fuelPricePerLitre * settings.exchangeRate;
}

/**
 * Monthly transport allowance for one employee.
 * Formula:
 *   consumption = 150 km / 20 L  →  7.5 km per litre
 *   liters_needed = kmDistance / 7.5
 *   daily_cost    = liters_needed × fuel_price_LBP
 *   monthly       = daily_cost × working_days × 2  (round trip)
 *   minimum       = minimumTransportUSD × exchangeRate
 *   result        = max(monthly, minimum)
 */
/** Transport cost per day (round trip) — no minimum applied here. */
export function calculateTransport(employee, settings) {
  const fuelPriceLBP  = getFuelPriceInLBP(settings);
  const litersNeeded  = employee.kmDistance / 7.5;
  return litersNeeded * fuelPriceLBP * 2;
}

/** Tax deduction — rate differs by employee type. */
export function calculateTax(employee, settings) {
  const rate = settings.taxRates[employee.employeeType] ?? 0;
  return employee.baseSalaryLBP * rate;
}

/** NFS deduction — rate differs by employee type. */
export function calculateNFS(employee, settings) {
  const rate = settings.nfsRates[employee.employeeType] ?? 0;
  return employee.baseSalaryLBP * rate;
}

/** Full payroll breakdown for one employee. */
export function calculateNetSalary(employee, settings, daysWorked) {
  const days               = daysWorked ?? settings.workingDaysPerMonth;
  const transportPerDayLBP = calculateTransport(employee, settings);
  const minimumLBP         = settings.minimumTransportUSD * settings.exchangeRate;
  const totalTransportLBP  = Math.max(transportPerDayLBP * days, minimumLBP);
  const taxLBP             = calculateTax(employee, settings);
  const nfsLBP             = calculateNFS(employee, settings);
  const netLBP             = employee.baseSalaryLBP + totalTransportLBP - taxLBP - nfsLBP;

  return {
    baseSalaryLBP:      employee.baseSalaryLBP,
    baseSalaryUSD:      employee.baseSalaryLBP / settings.exchangeRate,
    transportPerDayLBP,
    transportPerDayUSD: transportPerDayLBP / settings.exchangeRate,
    totalTransportLBP,
    totalTransportUSD:  totalTransportLBP / settings.exchangeRate,
    taxLBP,
    taxUSD:             taxLBP / settings.exchangeRate,
    nfsLBP,
    nfsUSD:             nfsLBP / settings.exchangeRate,
    netSalaryLBP:       netLBP,
    netSalaryUSD:       netLBP / settings.exchangeRate
  };
}

/** Returns the full employee array with calculated fields appended. */
export function calculatePayroll(employees, settings, daysWorkedMap = {}) {
  return employees.map(emp => {
    const days = daysWorkedMap[emp.id] ?? settings.workingDaysPerMonth;
    return {
      ...emp,
      daysWorked: days,
      ...calculateNetSalary(emp, settings, days)
    };
  });
}

/** Totals row across all calculated employees. */
export function calculateTotals(rows) {
  return rows.reduce((acc, row) => ({
    baseSalaryLBP:      acc.baseSalaryLBP      + row.baseSalaryLBP,
    baseSalaryUSD:      acc.baseSalaryUSD      + row.baseSalaryUSD,
    transportPerDayLBP: acc.transportPerDayLBP + row.transportPerDayLBP,
    transportPerDayUSD: acc.transportPerDayUSD + row.transportPerDayUSD,
    totalTransportLBP:  acc.totalTransportLBP  + row.totalTransportLBP,
    totalTransportUSD:  acc.totalTransportUSD  + row.totalTransportUSD,
    taxLBP:             acc.taxLBP             + row.taxLBP,
    taxUSD:             acc.taxUSD             + row.taxUSD,
    nfsLBP:             acc.nfsLBP             + row.nfsLBP,
    nfsUSD:             acc.nfsUSD             + row.nfsUSD,
    netSalaryLBP:       acc.netSalaryLBP       + row.netSalaryLBP,
    netSalaryUSD:       acc.netSalaryUSD       + row.netSalaryUSD
  }), {
    baseSalaryLBP: 0, baseSalaryUSD: 0,
    transportPerDayLBP: 0, transportPerDayUSD: 0,
    totalTransportLBP:  0, totalTransportUSD:  0,
    taxLBP:        0, taxUSD:        0,
    nfsLBP:        0, nfsUSD:        0,
    netSalaryLBP:  0, netSalaryUSD:  0
  });
}
