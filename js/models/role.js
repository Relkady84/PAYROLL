/**
 * Role registry — used to organize employees by scheduling profile.
 *
 * Each role has:
 *   - id:           internal id (string, used as key in academic year periods)
 *   - name:         display name
 *   - taxCategory:  'Teacher' | 'Admin' — drives tax rate, NFS rate, dashboard grouping
 *
 * Built-in roles cannot be deleted (Teacher, Administrator). Admin can add
 * custom sub-roles (e.g., Service Financier) by picking a tax category.
 */

export const TAX_CATEGORIES = ['Teacher', 'Admin'];

export const BUILTIN_ROLES = [
  { id: 'Teacher',       name: 'Teacher',       taxCategory: 'Teacher', builtin: true },
  { id: 'Administrator', name: 'Administrator', taxCategory: 'Admin',   builtin: true }
];

export const DEFAULT_ROLE_REGISTRY = {
  roles: [...BUILTIN_ROLES]
};

/**
 * Validate a custom role definition.
 * Returns array of error strings.
 */
export function validateRole(role, existingRoles = []) {
  const errors = [];
  const name = String(role.name || '').trim();
  if (!name) errors.push('Role name is required.');
  if (name.length > 50) errors.push('Role name must be 50 characters or less.');
  if (!TAX_CATEGORIES.includes(role.taxCategory)) {
    errors.push("Tax category must be 'Teacher' or 'Admin'.");
  }
  if (existingRoles.some(r => r.id === name || r.name === name)) {
    errors.push('A role with this name already exists.');
  }
  return errors;
}

/**
 * Look up a role by id (or name as fallback).
 * Returns the role object or null.
 */
export function findRole(registry, idOrName) {
  if (!registry || !Array.isArray(registry.roles)) return null;
  return registry.roles.find(r => r.id === idOrName)
      || registry.roles.find(r => r.name === idOrName)
      || null;
}

/**
 * Resolve an employee's effective role and tax category, with backward compat.
 * If the employee has no `role` field, fall back to `employeeType` ('Teacher' or 'Admin').
 */
export function resolveEmployeeRole(employee, registry) {
  const idOrName = employee.role || employee.employeeType || 'Teacher';
  const role = findRole(registry, idOrName);
  if (role) return role;
  // Fallback: synthesize a role from employeeType
  const cat = TAX_CATEGORIES.includes(employee.employeeType) ? employee.employeeType : 'Teacher';
  return { id: idOrName, name: idOrName, taxCategory: cat, builtin: false };
}
