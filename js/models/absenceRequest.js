export const ABSENCE_CATEGORIES = ['sick', 'personal', 'training', 'other'];

export const CATEGORY_LABELS = {
  sick:     'Sick Leave',
  personal: 'Personal',
  training: 'Training / Professional',
  other:    'Other'
};

export const STATUS_LABELS = {
  pending:              'Pending',                    // legacy — pre-two-step
  pending_supervisor:   'Awaiting supervisor',
  pending_financier:    'Awaiting Service Financier',
  approved:             'Approved',
  rejected:             'Rejected',                   // legacy
  rejected_supervisor:  'Rejected by supervisor',
  rejected_financier:   'Rejected by Service Financier'
};

// Helpers to classify a status into one of the high-level buckets
export function isPending(status)      { return status === 'pending' || status === 'pending_supervisor' || status === 'pending_financier'; }
export function isAwaitingSupervisor(s){ return s === 'pending_supervisor'; }
export function isAwaitingFinancier(s) { return s === 'pending_financier' || s === 'pending'; }
export function isApprovedFinal(s)     { return s === 'approved'; }
export function isRejected(s)          { return s === 'rejected' || s === 'rejected_supervisor' || s === 'rejected_financier'; }

// Request types — 'absence' subtracts a day; 'permanence' adds a day.
// Permanence: an employee worked on a day that's normally non-working
// (holiday, weekend, vacation period). Counts as +1 in the pay slip.
export const REQUEST_TYPES = ['absence', 'permanence'];

export const TYPE_LABELS = {
  absence:    'Absence',
  permanence: 'Permanence'
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
 * Validate a request's input.
 * Returns array of error strings (empty if valid).
 */
export function validateAbsenceRequest(data) {
  const errors = [];
  const type = data.type || 'absence';

  if (!REQUEST_TYPES.includes(type)) {
    errors.push('Invalid request type.');
  }

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('A valid date is required.');
  } else {
    const earliest = dateNDaysAgo(MAX_BACKDATE_DAYS);
    if (data.date < earliest) {
      errors.push(`Date cannot be more than ${MAX_BACKDATE_DAYS} days in the past.`);
    }
  }

  if (type === 'absence') {
    // Absence: category required + reason required for "other"
    if (!ABSENCE_CATEGORIES.includes(data.category)) {
      errors.push('Please select a valid category.');
    }
    if (data.category === 'other' && !String(data.reason || '').trim()) {
      errors.push('Reason is required for "Other" category.');
    }
  } else if (type === 'permanence') {
    // Permanence: reason is always required (need to explain why work was done)
    if (!String(data.reason || '').trim()) {
      errors.push('Please describe why you came in (reason is required).');
    }
  }

  if (data.reason && String(data.reason).length > 500) {
    errors.push('Reason must be 500 characters or less.');
  }

  return errors;
}

/**
 * Build a clean request object for storage.
 * Supports both absence and permanence types.
 */
export function createAbsenceRequest(data, employee, options = {}) {
  const type = REQUEST_TYPES.includes(data.type) ? data.type : 'absence';
  // Two-step routing: if a supervisor email is provided (looked up from the
  // employee's role), the request starts in pending_supervisor. Otherwise it
  // skips straight to pending_financier (e.g. for Service Financier, Principal,
  // or any role that has no supervisor configured).
  const supervisorEmail = (options.supervisorEmail || '').trim().toLowerCase();
  const status = supervisorEmail ? 'pending_supervisor' : 'pending_financier';
  return {
    employeeId:    employee.id,
    employeeEmail: String(employee.email || '').trim().toLowerCase(),
    employeeName:  `${employee.firstName} ${employee.lastName}`.trim(),
    date:          data.date,
    type,                                                   // 'absence' or 'permanence'
    category:      type === 'absence' ? data.category : null,
    reason:        String(data.reason || '').trim(),
    status,
    supervisorEmail: supervisorEmail || null,                // denormalized for fast supervisor portal lookup
    requestedAt:   Date.now(),
    // Supervisor review
    supervisorReviewedBy:  null,
    supervisorReviewedAt:  null,
    supervisorNotes:       '',
    // Financier / final review
    reviewedBy:    null,
    reviewedAt:    null,
    reviewNotes:   ''
  };
}

/**
 * Count approved requests of a given type for an employee in a given month.
 * @param {Array} requests
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month     - 1-based
 * @param {string} type      - 'absence' or 'permanence'
 * @returns {number}
 */
function countApprovedByType(requests, employeeId, year, month, type) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return requests.filter(r =>
    r.status === 'approved'
    && r.employeeId === employeeId
    && (r.type || 'absence') === type        // legacy entries default to 'absence'
    && typeof r.date === 'string'
    && r.date.startsWith(prefix)
  ).length;
}

/** Count approved absences in a month (legacy entries without `type` count here). */
export function countApprovedAbsencesInMonth(requests, employeeId, year, month) {
  return countApprovedByType(requests, employeeId, year, month, 'absence');
}

/** Count approved permanence days in a month. */
export function countApprovedPermanenceInMonth(requests, employeeId, year, month) {
  return countApprovedByType(requests, employeeId, year, month, 'permanence');
}
