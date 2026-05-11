/**
 * Import employees from CSV or Excel.
 * Merges by id if present, appends as new if not.
 * Depends on: PapaParse (window.Papa), SheetJS (window.XLSX)
 */

import { createEmployee, validateEmployee } from '../models/employee.js';
import { mergeEmployees, getRoleRegistry } from '../data/store.js';
import { findRole } from '../models/role.js';

// Column name → employee model key mappings (case-insensitive)
const COLUMN_MAP = {
  'first name':       'firstName',
  'firstname':        'firstName',
  'last name':        'lastName',
  'lastname':         'lastName',
  'age':              'age',
  'home location':    'homeLocation',
  'homelocation':     'homeLocation',
  'location':         'homeLocation',
  'employee type':    'employeeType',
  'employeetype':     'employeeType',
  'type':             'employeeType',
  'role':             'role',
  'job role':         'role',
  'position':         'role',
  'base salary (lbp)': 'baseSalaryLBP',
  'base salary':      'baseSalaryLBP',
  'basesalarylbp':    'baseSalaryLBP',
  'salary':           'baseSalaryLBP',
  'distance (km)':    'kmDistance',
  'distance':         'kmDistance',
  'kmdistance':       'kmDistance',
  'km':               'kmDistance',
  'id':               'id',
  'email':            'email',
  'e-mail':           'email',
  'email address':    'email'
};

function mapRow(rawRow) {
  const out = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normalized = rawKey.trim().toLowerCase();
    const mapped     = COLUMN_MAP[normalized];
    if (mapped) out[mapped] = value;
  }
  return out;
}

// Case-insensitive role lookup against the company's role registry.
// Returns the canonical role object (id, name, taxCategory) or null.
function resolveRoleCell(value, registry) {
  if (!value || !registry || !Array.isArray(registry.roles)) return null;
  const needle = String(value).trim().toLowerCase();
  return registry.roles.find(r => (r.id || '').toLowerCase()   === needle)
      || registry.roles.find(r => (r.name || '').toLowerCase() === needle)
      || null;
}

// forceType: if set ('Teacher' or 'Admin'), overrides the type column in every row.
// This lets users import a CSV that has no "Type" column at all.
function processRows(rawRows, onSuccess, onError, forceType = null) {
  if (!rawRows.length) {
    onError('The file appears to be empty.');
    return;
  }

  const errors   = [];
  const warnings = [];
  const valid    = [];
  const registry = getRoleRegistry();

  rawRows.forEach((raw, i) => {
    if (!raw || Object.values(raw).every(v => !v)) return; // skip blank rows
    const mapped = mapRow(raw);

    // Role resolution — if the row has a "Role" cell, look it up in the
    // company's role registry. Match by id or by name, case-insensitive.
    // When a role is matched, auto-derive employeeType from its tax category
    // (so the user doesn't have to provide BOTH Role and Type — one is enough).
    if (mapped.role) {
      const resolved = resolveRoleCell(mapped.role, registry);
      if (resolved) {
        mapped.role         = resolved.id;
        mapped.employeeType = resolved.taxCategory;
      } else {
        warnings.push(`Row ${i + 2}: role "${mapped.role}" not found in your role registry — saved as a custom label.`);
        // Keep the raw role text — admin can clean it up later.
      }
    }

    if (forceType) mapped.employeeType = forceType;

    const errs = validateEmployee(mapped);
    if (errs.length) {
      errors.push(`Row ${i + 2}: ${errs.join(' ')}`);
    } else {
      const emp = createEmployee(mapped);
      if (mapped.id) emp.id = mapped.id; // preserve original id for merge
      valid.push(emp);
    }
  });

  if (errors.length && !valid.length) {
    onError('Import failed:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n…and ${errors.length - 5} more.` : ''));
    return;
  }

  mergeEmployees(valid);

  if (errors.length) {
    onError(`${valid.length} imported, ${errors.length} rows had errors and were skipped.`);
  } else if (warnings.length) {
    onError(`${valid.length} imported successfully. Heads up:\n` +
      warnings.slice(0, 5).join('\n') +
      (warnings.length > 5 ? `\n…and ${warnings.length - 5} more.` : '') +
      `\n\nFix by adding the role in Settings → Academic Year & Roles, then re-importing — or editing each employee individually.`);
  } else {
    onSuccess(valid.length);
  }
}

export function importCSV(file, onSuccess, onError, forceType = null) {
  if (!window.Papa) {
    onError('CSV library not loaded. Check your internet connection.');
    return;
  }
  window.Papa.parse(file, {
    header:         true,
    skipEmptyLines: true,
    complete: result => processRows(result.data, onSuccess, onError, forceType),
    error:    err   => onError('CSV parse error: ' + err.message)
  });
}

export function importExcel(file, onSuccess, onError, forceType = null) {
  if (!window.XLSX) {
    onError('Excel library not loaded. Check your internet connection.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data  = new Uint8Array(e.target.result);
      const wb    = window.XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows  = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      processRows(rows, onSuccess, onError, forceType);
    } catch (err) {
      onError('Excel parse error: ' + err.message);
    }
  };
  reader.onerror = () => onError('Failed to read file.');
  reader.readAsArrayBuffer(file);
}
