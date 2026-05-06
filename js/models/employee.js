export const EMPLOYEE_TYPES = ['Teacher', 'Admin'];

// Default work schedule: Monday–Friday (1–5). 0=Sun, 6=Sat.
export const DEFAULT_EMPLOYEE_SCHEDULE = [1, 2, 3, 4, 5];

function normalizeSchedule(input) {
  if (!Array.isArray(input)) return [...DEFAULT_EMPLOYEE_SCHEDULE];
  const cleaned = input
    .map(n => parseInt(n, 10))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  // Dedupe + sort for consistency
  return [...new Set(cleaned)].sort((a, b) => a - b);
}

export function createEmployee(data) {
  const schedule = normalizeSchedule(data.workSchedule);
  const employeeType = EMPLOYEE_TYPES.includes(data.employeeType) ? data.employeeType : 'Teacher';
  // Optional manual override for monthly working days. Mostly used for teachers
  // whose schedules vary too much for fixed Mon-Fri checkboxes. When set, this
  // value replaces the calendar/schedule calculation as the base; absences and
  // permanences still adjust it.
  let defaultDaysPerMonth = null;
  if (data.defaultDaysPerMonth !== undefined && data.defaultDaysPerMonth !== '' && data.defaultDaysPerMonth !== null) {
    const n = parseInt(data.defaultDaysPerMonth, 10);
    if (!isNaN(n) && n >= 0 && n <= 31) defaultDaysPerMonth = n;
  }
  return {
    id: crypto.randomUUID(),
    firstName:     String(data.firstName    || '').trim(),
    lastName:      String(data.lastName     || '').trim(),
    age:           parseInt(data.age)       || 0,
    homeLocation:  String(data.homeLocation || '').trim(),
    role:          String(data.role || '').trim() || (employeeType === 'Admin' ? 'Administrator' : 'Teacher'),
    employeeType,                        // tax category — derived from role
    baseSalaryLBP: parseFloat(data.baseSalaryLBP) || 0,
    kmDistance:    parseFloat(data.kmDistance)    || 0,
    email:         String(data.email        || '').trim().toLowerCase(),
    workSchedule:  schedule.length ? schedule : [...DEFAULT_EMPLOYEE_SCHEDULE],
    defaultDaysPerMonth          // null = use calendar; number = override base days
  };
}

export function validateEmployee(data) {
  const errors = [];
  if (!String(data.firstName || '').trim())     errors.push('First name is required.');
  if (!String(data.lastName  || '').trim())     errors.push('Last name is required.');

  const age = parseInt(data.age);
  if (isNaN(age) || age < 18 || age > 100)      errors.push('Age must be between 18 and 100.');

  if (!String(data.homeLocation || '').trim())  errors.push('Home location is required.');

  if (!EMPLOYEE_TYPES.includes(data.employeeType)) {
    errors.push('Employee type must be Teacher or Admin.');
  }

  const salary = parseFloat(data.baseSalaryLBP);
  if (isNaN(salary) || salary < 0)              errors.push('Base salary must be a non-negative number.');

  const km = parseFloat(data.kmDistance);
  if (isNaN(km) || km < 0)                      errors.push('Distance must be a non-negative number.');

  const email = String(data.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email address is not valid.');
  }

  // Work schedule must have at least one day if provided
  if (data.workSchedule !== undefined) {
    const schedule = normalizeSchedule(data.workSchedule);
    if (schedule.length === 0) {
      errors.push('Work schedule must include at least one day.');
    }
  }

  return errors;
}
