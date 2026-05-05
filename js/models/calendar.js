/**
 * School calendar model.
 *
 * - weekendDays: array of day-of-week integers (0=Sun, 1=Mon, …, 6=Sat)
 * - holidays:    array of { date: 'YYYY-MM-DD', name, type: 'official'|'school' }
 * - employee.workSchedule: array of day-of-week integers (which days the employee works)
 *
 * Working days for an employee in a given month =
 *   weekdays in month
 *   ∩ employee.workSchedule
 *   − weekendDays (calendar)
 *   − holidays (calendar)
 *
 * Final paid days = computed working days − approved absences in that month.
 */

export const DEFAULT_CALENDAR = {
  weekendDays: [0, 6],   // Sat (6) + Sun (0) — Lebanon default
  holidays:    []
};

export const DEFAULT_WORK_SCHEDULE = [1, 2, 3, 4, 5];  // Mon-Fri

export const HOLIDAY_TYPES = ['official', 'school'];

// Day-of-week labels (index = JS getDay() value)
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Lebanese fixed-date official holidays.
 * Movable holidays (Easter, Eid, Ashura, Prophet's Birthday, etc.) are NOT
 * included — those vary year to year (lunar) and admin must enter manually.
 */
export const LEBANESE_OFFICIAL_HOLIDAYS_FIXED = [
  { month: 1,  day: 1,  name: "New Year's Day"             },
  { month: 1,  day: 6,  name: "Armenian Christmas"          },
  { month: 2,  day: 9,  name: "Saint Maron's Day"           },
  { month: 3,  day: 25, name: "Annunciation"                },
  { month: 5,  day: 1,  name: "Labor Day"                   },
  { month: 5,  day: 25, name: "Resistance & Liberation Day" },
  { month: 8,  day: 15, name: "Assumption of Mary"          },
  { month: 11, day: 1,  name: "All Saints' Day"             },
  { month: 11, day: 22, name: "Independence Day"            },
  { month: 12, day: 25, name: "Christmas"                   }
];

/** Format YYYY-MM-DD safely (no timezone surprises). */
export function formatISO(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Generate Lebanese holiday entries for a given calendar year.
 * Returns array of { date, name, type: 'official' }.
 */
export function seedLebaneseHolidays(year) {
  return LEBANESE_OFFICIAL_HOLIDAYS_FIXED.map(h => ({
    date: formatISO(year, h.month, h.day),
    name: h.name,
    type: 'official'
  }));
}

/**
 * Validate a single holiday entry.
 * Returns array of error strings.
 */
export function validateHoliday({ date, name }) {
  const errors = [];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('Date must be in YYYY-MM-DD format.');
  }
  if (!String(name || '').trim()) {
    errors.push('Holiday name is required.');
  }
  if (String(name || '').length > 80) {
    errors.push('Holiday name must be 80 characters or less.');
  }
  return errors;
}

/**
 * Compute the number of working days in a given month for an employee.
 *
 * @param {number} year   - 4-digit year, e.g. 2026
 * @param {number} month  - 1-based month (1=Jan, …, 12=Dec)
 * @param {object} calendar - { weekendDays: number[], holidays: { date: string }[] }
 * @param {object} employee - employee record (uses .workSchedule)
 * @param {object} [opts]
 * @param {Array<{from,to,schedule}>} [opts.activePeriods] - if provided, day must
 *        fall within one of these periods AND the day must be in the period's schedule.
 *        When omitted, the employee's `workSchedule` is used and ALL days in the month
 *        are considered "active" (legacy behavior).
 * @returns {number}
 */
export function computeWorkingDaysInMonth(year, month, calendar, employee, opts = {}) {
  const cal = calendar || DEFAULT_CALENDAR;
  const weekendDays  = Array.isArray(cal.weekendDays) ? cal.weekendDays : DEFAULT_CALENDAR.weekendDays;
  const holidaySet   = new Set((cal.holidays || []).map(h => h.date));
  const fallbackSchedule = Array.isArray(employee?.workSchedule) && employee.workSchedule.length
    ? employee.workSchedule
    : DEFAULT_WORK_SCHEDULE;

  const activePeriods = Array.isArray(opts.activePeriods) ? opts.activePeriods : null;

  let count = 0;
  const lastDay = new Date(year, month, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    const dow  = date.getDay();
    const iso  = formatISO(year, month, d);

    if (weekendDays.includes(dow))  continue;
    if (holidaySet.has(iso))        continue;

    // Determine which schedule applies for this day:
    //  - If activePeriods provided: find the matching period; use its schedule.
    //    If none match, day is OUTSIDE the role's active period → not counted.
    //  - Else: fall back to the employee's workSchedule.
    let schedule = fallbackSchedule;
    if (activePeriods) {
      const match = activePeriods.find(p =>
        p && p.from && p.to && iso >= p.from && iso <= p.to
      );
      if (!match) continue;  // outside any active period
      if (Array.isArray(match.schedule) && match.schedule.length) {
        schedule = match.schedule;
      }
    }

    if (!schedule.includes(dow)) continue;
    count++;
  }
  return count;
}

/**
 * Count the holidays in a given month that fall on weekdays (i.e., would
 * have been working days if not a holiday). Used to display a breakdown.
 */
export function countHolidaysInMonth(year, month, calendar) {
  const cal = calendar || DEFAULT_CALENDAR;
  const weekendDays = Array.isArray(cal.weekendDays) ? cal.weekendDays : DEFAULT_CALENDAR.weekendDays;
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return (cal.holidays || []).filter(h => {
    if (typeof h.date !== 'string' || !h.date.startsWith(prefix)) return false;
    const day = parseInt(h.date.slice(8, 10), 10);
    if (isNaN(day)) return false;
    const dow = new Date(year, month - 1, day).getDay();
    return !weekendDays.includes(dow);
  }).length;
}
