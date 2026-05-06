export const en = {
  // ── Common ──
  'common.save':      'Save',
  'common.cancel':    'Cancel',
  'common.confirm':   'Confirm',
  'common.delete':    'Delete',
  'common.edit':      'Edit',
  'common.add':       'Add',
  'common.close':     'Close',
  'common.search':    'Search…',
  'common.loading':   'Loading…',
  'common.required':  '(required)',
  'common.optional':  '(optional)',
  'common.yes':       'Yes',
  'common.no':        'No',
  'common.signout':   'Sign out',
  'common.try_again': 'Try again',
  'common.from':      'From',
  'common.to':        'To',
  'common.date':      'Date',
  'common.name':      'Name',
  'common.type':      'Type',
  'common.status':    'Status',
  'common.actions':   'Actions',
  'common.reason':    'Reason',
  'common.month':     'Month',

  // ── Login screen ──
  'login.title':     'Payroll System',
  'login.subtitle':  'Lebanon — Sign in to access payroll data',
  'login.google':    'Sign in with Google',
  'login.microsoft': 'Sign in with Microsoft',
  'login.or':        'or',
  'login.error':     'Sign-in failed. Please try again.',

  // ── Sidebar nav ──
  'nav.main':           'Main',
  'nav.dashboard':      'Dashboard',
  'nav.employees':      'Employees',
  'nav.payroll':        'Payroll Report',
  'nav.reports':        'Reports',
  'nav.attendance':     'Attendance Requests',
  'nav.config':         'Configuration',
  'nav.settings':       'Settings',
  'nav.admin':          'Admin',
  'nav.switch_company': 'Switch Company',
  'nav.signout_short':  'Out',

  // ── Mobile bottom nav ──
  'nav_m.dashboard': 'Dashboard',
  'nav_m.employees': 'Employees',
  'nav_m.payroll':   'Payroll',
  'nav_m.reports':   'Reports',
  'nav_m.settings':  'Settings',

  // ── Settings page ──
  'settings.title':       'Settings',
  'settings.subtitle':    'Configure rates, formulas and exchange values',
  'settings.language':    'Language',
  'settings.lang_hint':   'Changing the language reloads the page.',

  // ── Employee Portal ──
  'portal.title':            'Employee Portal',
  'portal.payslip_title':    'My Pay Slip',
  'portal.history_title':    'Attendance History',
  'portal.greeting':         'Hi, {name} 👋',
  'portal.role.teacher':     'Teacher',
  'portal.role.administrator': 'Administrator',

  // Drawer
  'portal.drawer.home':    'Home',
  'portal.drawer.payslip': 'My Pay Slip',
  'portal.drawer.history': 'Attendance History',

  // Absence form
  'portal.absence.title':       '🚫 Request an Absence',
  'portal.absence.subtitle':    'A day you will not be coming to work — counts as -1 day on your pay slip.',
  'portal.absence.date':        'Date',
  'portal.absence.date_hint':   'From {earliest} to any future date.',
  'portal.absence.category':    'Category',
  'portal.absence.reason':      'Reason / Note',
  'portal.absence.placeholder': 'Optional — e.g., medical appointment',
  'portal.absence.submit':      '✓ Submit Absence Request',

  // Permanence form
  'portal.permanence.title':       '🎯 Request a Permanence Day',
  'portal.permanence.subtitle':    'A day you came to work that was supposed to be off (holiday, vacation, weekend) — counts as +1 day on your pay slip.',
  'portal.permanence.date':        'Date you worked',
  'portal.permanence.reason':      'Reason for working',
  'portal.permanence.placeholder': 'e.g., Year-end closing, exam supervision, urgent task…',
  'portal.permanence.submit':      '✓ Submit Permanence Request',

  // Categories
  'category.sick':     'Sick Leave',
  'category.personal': 'Personal',
  'category.training': 'Training / Professional',
  'category.other':    'Other',

  // Status
  'status.pending':  'Pending',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',

  // Type labels
  'type.absence':    'Absence',
  'type.permanence': 'Permanence',

  // Recent requests / history
  'portal.recent.title':     '📋 Recent Requests',
  'portal.recent.view_all':  'View all →',
  'portal.empty.title':      'No requests yet.',
  'portal.empty.sub':        'Your submitted requests will appear here.',
  'portal.cancel':           'Cancel',
  'portal.cancel_confirm':   'Cancel this pending request?',
  'portal.cancel_failed':    'Could not cancel. Try again.',
  'portal.admin_note':       'Admin note:',

  // History filters
  'portal.history.total':         'Total',
  'portal.history.filter_status': 'Filter by status',
  'portal.history.filter_cat':    'Filter by category',
  'portal.history.all':           'All',
  'portal.history.empty':         'No requests match.',

  // Pay slip
  'portal.payslip.month':              'Month',
  'portal.payslip.base_salary':        'Base Salary',
  'portal.payslip.working_days':       'Working days this month',
  'portal.payslip.transport_per_day':  'Transport / day',
  'portal.payslip.total_transport':    'Total Transport (× {days} days)',
  'portal.payslip.tax':                'Tax',
  'portal.payslip.nfs':                'NFS / NSSF',
  'portal.payslip.net':                'Net Salary',
  'portal.payslip.download_pdf':       '⬇ Download PDF',
  'portal.payslip.disclaimer':         'Calculated from current settings. For official records, contact your administrator.',
  'portal.payslip.from_calendar':      '{n} from calendar',
  'portal.payslip.after_holidays':     'after {n} holiday(s)',
  'portal.payslip.minus_absences':     '− {n} absence(s)',
  'portal.payslip.plus_permanence':    '+ {n} permanence day(s)',
  'portal.payslip.no_events':          'No holidays, absences, or permanence days this month.',

  // Errors
  'portal.error.no_employee':    'We could not find your employee record. Please contact your administrator.',
  'portal.error.submit_failed':  '⚠ Failed to submit. Try again.',

  // Misc
  'portal.access_issue': 'Access issue'
};
