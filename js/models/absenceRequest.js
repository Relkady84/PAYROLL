export const ABSENCE_CATEGORIES = ['sick', 'personal', 'training', 'other'];

export const CATEGORY_LABELS = {
  sick:     'Sick Leave',
  personal: 'Personal',
  training: 'Training / Professional',
  other:    'Other'
};

export const STATUS_LABELS = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

// How many days back can an employee retroactively request an absence?
export const MAX_BACKDATE_DAYS = 7;

/**
 * Format a Date or YYYY-MM-DD string as YYYY-MM-DD.
 */
export function formatDate(d) {
  if (typeof d === 'string') return d;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return formatDate(new Date());
}

/**
 * Returns the YYYY-MM-DD string for today minus N days.
 */
export function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/**
 * Validate an absence request's input.
 * Returns array of error strings (empty if valid).
 */
export function validateAbsenceRequest(data) {
  const errors = [];

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('A valid date is required.');
  } else {
    const earliest = dateNDaysAgo(MAX_BACKDATE_DAYS);
    if (data.date < earliest) {
      errors.push(`Date cannot be more than ${MAX_BACKDATE_DAYS} days in the past.`);
    }
  }

  if (!ABSENCE_CATEGORIES.includes(data.category)) {
    errors.push('Please select a valid category.');
  }

  if (data.category === 'other' && !String(data.reason || '').trim()) {
    errors.push('Reason is required for "Other" category.');
  }

  if (data.reason && String(data.reason).length > 500) {
    errors.push('Reason must be 500 characters or less.');
  }

  return errors;
}

/**
 * Build a clean absence request object for storage.
 */
export function createAbsenceRequest(data, employee) {
  return {
    employeeId:    employee.id,
    employeeEmail: String(employee.email || '').trim().toLowerCase(),
    employeeName:  `${employee.firstName} ${employee.lastName}`.trim(),
    date:          data.date,
    category:      data.category,
    reason:        String(data.reason || '').trim(),
    status:        'pending',
    requestedAt:   Date.now(),
    reviewedBy:    null,
    reviewedAt:    null,
    reviewNotes:   ''
  };
}

/**
 * Count approved absences for an employee in a given month.
 * @param {Array} requests  - all absence requests
 * @param {string} employeeId
 * @param {number} year     - e.g., 2026
 * @param {number} month    - 1-based (1 = January)
 * @returns {number}
 */
export function countApprovedAbsencesInMonth(requests, employeeId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return requests.filter(r =>
    r.status === 'approved'
    && r.employeeId === employeeId
    && typeof r.date === 'string'
    && r.date.startsWith(prefix)
  ).length;
}
