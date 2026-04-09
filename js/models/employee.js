export const EMPLOYEE_TYPES = ['Teacher', 'Admin'];

export function createEmployee(data) {
  return {
    id: crypto.randomUUID(),
    firstName:     String(data.firstName    || '').trim(),
    lastName:      String(data.lastName     || '').trim(),
    age:           parseInt(data.age)       || 0,
    homeLocation:  String(data.homeLocation || '').trim(),
    employeeType:  EMPLOYEE_TYPES.includes(data.employeeType) ? data.employeeType : 'Teacher',
    baseSalaryLBP: parseFloat(data.baseSalaryLBP) || 0,
    kmDistance:    parseFloat(data.kmDistance)    || 0,
    email:         String(data.email        || '').trim().toLowerCase()
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

  return errors;
}
