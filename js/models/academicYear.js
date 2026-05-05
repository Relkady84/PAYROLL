/**
 * Academic Year — encapsulates a school year's calendar configuration.
 *
 * Stored at: /companies/{X}/academicYears/{yearId}
 *
 * Fields:
 *   yearId:      string identifier, typically 'YYYY-YYYY+1' (e.g., '2026-2027')
 *   label:       user-friendly display name
 *   startDate:   YYYY-MM-DD — when the year starts (default Sep 1)
 *   endDate:     YYYY-MM-DD — when the year ends (default Jun 30)
 *   isCurrent:   boolean — flag set on the active year (only one at a time)
 *   weekendDays: array of day-of-week ints (0=Sun, 6=Sat)
 *   holidays:    [{ date, name, type: 'official'|'school' }, ...]
 *   rolePeriods: { roleId: [{ from, to, schedule: number[] }, ...] }
 *
 * Each role can have multiple active periods within the year — e.g., a main
 * period (Aug 21 – Jul 21) plus a permanence period (Jul 22 – Jul 31, Wed only).
 */

import { DEFAULT_CALENDAR } from './calendar.js';

export const DEFAULT_ACTIVE_PERIODS = {
  Teacher:       [{ from: '', to: '', schedule: [1, 2, 3, 4, 5] }],
  Administrator: [{ from: '', to: '', schedule: [1, 2, 3, 4, 5] }]
};

/**
 * Generate a yearId from a start date.
 * '2026-09-01' → '2026-2027'
 */
export function generateYearId(startDateIso) {
  const startYear = parseInt((startDateIso || '').slice(0, 4), 10);
  if (isNaN(startYear)) return '';
  return `${startYear}-${startYear + 1}`;
}

export function makeAcademicYear({ yearId, startDate, endDate, isCurrent = false }) {
  return {
    yearId:      yearId || generateYearId(startDate),
    label:       yearId || generateYearId(startDate),
    startDate:   startDate,
    endDate:     endDate,
    isCurrent,
    weekendDays: [...DEFAULT_CALENDAR.weekendDays],
    holidays:    [],
    rolePeriods: structuredClone(DEFAULT_ACTIVE_PERIODS)
  };
}

/**
 * Suggest a default academic year structure based on today's date.
 * Returns { yearId, startDate, endDate } for the school year that "today" belongs to.
 *  - Aug 1 onward of year N → year N..N+1
 *  - Before Aug 1 → year N-1..N
 */
export function suggestCurrentAcademicYear(today = new Date()) {
  const month = today.getMonth() + 1;       // 1-based
  const year  = today.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return {
    yearId:    `${startYear}-${startYear + 1}`,
    startDate: `${startYear}-09-01`,
    endDate:   `${startYear + 1}-06-30`
  };
}

/**
 * Determine if a given date falls within ANY of an array of active periods.
 * @param {string} iso 'YYYY-MM-DD'
 * @param {Array<{from,to,schedule}>} periods
 * @returns the matching period (with its schedule) or null
 */
export function findActivePeriod(iso, periods) {
  if (!Array.isArray(periods) || !iso) return null;
  for (const p of periods) {
    if (!p || !p.from || !p.to) continue;
    if (iso >= p.from && iso <= p.to) return p;
  }
  return null;
}

/**
 * Validate a single active period.
 */
export function validatePeriod(period) {
  const errors = [];
  if (period.from && !/^\d{4}-\d{2}-\d{2}$/.test(period.from)) {
    errors.push('Period start date must be YYYY-MM-DD.');
  }
  if (period.to && !/^\d{4}-\d{2}-\d{2}$/.test(period.to)) {
    errors.push('Period end date must be YYYY-MM-DD.');
  }
  if (period.from && period.to && period.to < period.from) {
    errors.push('Period end date must be on or after the start date.');
  }
  if (Array.isArray(period.schedule) && period.schedule.length === 0) {
    errors.push('Schedule must include at least one day.');
  }
  return errors;
}
