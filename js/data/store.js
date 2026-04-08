import { DEFAULT_SETTINGS } from './defaults.js';

const SETTINGS_KEY = 'payroll_settings';
const EMPLOYEES_KEY = 'payroll_employees';

// ── Settings ──────────────────────────────────────────────
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const stored = JSON.parse(raw);
    // Deep merge to ensure all keys exist (handles old saved data missing new keys)
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      taxRates: { ...DEFAULT_SETTINGS.taxRates, ...stored.taxRates },
      nfsRates: { ...DEFAULT_SETTINGS.nfsRates, ...stored.nfsRates }
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}

// ── Employees ─────────────────────────────────────────────
export function getEmployees() {
  try {
    const raw = localStorage.getItem(EMPLOYEES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEmployees(employees) {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
}

export function addEmployee(employee) {
  const employees = getEmployees();
  employees.push(employee);
  saveEmployees(employees);
}

export function updateEmployee(id, changes) {
  const employees = getEmployees();
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return false;
  employees[idx] = { ...employees[idx], ...changes };
  saveEmployees(employees);
  return true;
}

export function deleteEmployee(id) {
  saveEmployees(getEmployees().filter(e => e.id !== id));
}

export function mergeEmployees(incoming) {
  const existing = getEmployees();
  const map = new Map(existing.map(e => [e.id, e]));
  for (const emp of incoming) {
    if (emp.id) {
      map.set(emp.id, { ...map.get(emp.id), ...emp });
    } else {
      // No id — treat as new
      map.set(emp._tempKey || Math.random().toString(36).slice(2), emp);
    }
  }
  saveEmployees([...map.values()]);
}
