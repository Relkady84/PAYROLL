/**
 * All salary calculation functions are pure — they take data, return results.
 * Rates stored in settings are decimals (0.05 = 5%).
 * Fuel price stored in settings is USD; converted to LBP internally.
 */

import { computeWorkingDaysInMonth, countHolidaysInMonth } from '../models/calendar.js';
import { countApprovedAbsencesInMonth, countApprovedPermanenceInMonth } from '../models/absenceRequest.js';
import { resolveEmployeeRole } from '../models/role.js';

/**
 * Compute the effective paid working days for an employee in a given month.
 *
 * Hierarchy (highest priority first):
 *   1. Manual override (if provided)        — admin-typed value in payroll table
 *   2. Active periods of the role × calendar − absences  (when academic year is set)
 *   3. Plain calendar (legacy fallback) − absences       (when no academic year)
 *
 * Also returns a breakdown for display.
 *
 * @returns {{
 *   days: number,
 *   calendarDays: number,
 *   holidays: number,
 *   absences: number,
 *   isManualOverride: boolean,
 *   isOutsideActivePeriod: boolean
 * }}
 */
export function computeEffectiveDays({
  employee,
  calendar,
  absenceRequests,
  year,
  month,
  manualOverride = undefined,
  academicYear   = null,           // optional: if provided, role-based periods are used
  roleRegistry   = null,           // optional: needed when academicYear is provided
  forceOffPeriod = false           // optional: when academic years exist but none covers this month
}) {
  // Short-circuit: month is outside ALL defined academic years → 0 days for everyone
  if (forceOffPeriod) {
    const absences   = countApprovedAbsencesInMonth(absenceRequests, employee.id, year, month);
    const permanence = countApprovedPermanenceInMonth(absenceRequests, employee.id, year, month);
    if (manualOverride !== undefined && manualOverride !== null && manualOverride !== '' && !isNaN(manualOverride)) {
      return {
        days: Math.max(0, parseInt(manualOverride, 10) || 0),
        calendarDays:        0,
        holidays:             0,
        absences,
        permanence,
        isManualOverride:     true,
        isOutsideActivePeriod: true
      };
    }
    return {
      days: Math.max(0, permanence),                  // permanence days still pay even when "off-period"
      calendarDays:           0,
      holidays:                0,
      absences,
      permanence,
      isManualOverride:        false,
      isOutsideActivePeriod:   true
    };
  }
  // Resolve the role + the active periods that apply (if academic-year mode).
  // Periods with empty from/to are treated as "not set" — we fall back to the
  // legacy calc (employee.workSchedule + full month) rather than showing "off-period"
  // for an unconfigured year.
  let activePeriods = null;
  let roleId        = null;
  if (academicYear && academicYear.rolePeriods) {
    const role = resolveEmployeeRole(employee, roleRegistry);
    roleId = role?.id;
    const raw = academicYear.rolePeriods[roleId]
             || academicYear.rolePeriods[role?.name]
             || null;
    if (Array.isArray(raw)) {
      const valid = raw.filter(p => p && p.from && p.to);
      activePeriods = valid.length ? valid : null;
    }
  }

  const calendarDays = computeWorkingDaysInMonth(year, month, calendar, employee, {
    activePeriods: activePeriods || undefined
  });
  const holidays     = countHolidaysInMonth(year, month, calendar);
  const absences     = countApprovedAbsencesInMonth(absenceRequests, employee.id, year, month);
  const permanence   = countApprovedPermanenceInMonth(absenceRequests, employee.id, year, month);

  // Outside active period? = no calendar days at all because none matched
  const isOutsideActivePeriod = !!activePeriods && calendarDays === 0;

  if (manualOverride !== undefined && manualOverride !== null && manualOverride !== '' && !isNaN(manualOverride)) {
    return {
      days: Math.max(0, parseInt(manualOverride, 10) || 0),
      calendarDays,
      holidays,
      absences,
      permanence,
      isManualOverride: true,
      isOutsideActivePeriod
    };
  }

  return {
    days: Math.max(0, calendarDays - absences + permanence),
    calendarDays,
    holidays,
    absences,
    permanence,
    isManualOverride: false,
    isOutsideActivePeriod
  };
}


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
/** Transport cost per day (round trip).
 *  ≤ 20 km → fixed at minimum (e.g. $5/day).
 *  > 20 km → distance formula, with minimum as floor.
 */
export function calculateTransport(employee, settings) {
  const minimumLBP = settings.minimumTransportUSD * settings.exchangeRate;
  if (employee.kmDistance <= 20) {
    return minimumLBP;
  }
  const fuelPriceLBP = getFuelPriceInLBP(settings);
  const litersNeeded = employee.kmDistance / (settings.kmPerLitre ?? 7.5);
  const dailyCost    = litersNeeded * fuelPriceLBP * 2;
  return Math.max(dailyCost, minimumLBP);
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
  const totalTransportLBP  = transportPerDayLBP * days;
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
