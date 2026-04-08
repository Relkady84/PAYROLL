import { getEmployees, addEmployee, updateEmployee } from '../data/store.js';
import { createEmployee, validateEmployee, EMPLOYEE_TYPES } from '../models/employee.js';
import { openModal, closeModal } from './components/modal.js';
import { showToast } from './components/toast.js';

function buildFormHTML(employee = null) {
  const e = employee || {};
  return `
    <form id="employee-form" novalidate>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ef-firstName">First Name <span class="required">*</span></label>
          <input class="form-control" id="ef-firstName" name="firstName"
            type="text" placeholder="e.g. Ahmad" value="${esc(e.firstName)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-lastName">Last Name <span class="required">*</span></label>
          <input class="form-control" id="ef-lastName" name="lastName"
            type="text" placeholder="e.g. Khoury" value="${esc(e.lastName)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-age">Age <span class="required">*</span></label>
          <input class="form-control" id="ef-age" name="age"
            type="number" min="18" max="100" placeholder="30" value="${e.age || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-employeeType">Employee Type <span class="required">*</span></label>
          <select class="form-control" id="ef-employeeType" name="employeeType">
            ${EMPLOYEE_TYPES.map(t => `
              <option value="${t}" ${e.employeeType === t ? 'selected' : ''}>${t === 'Admin' ? 'Personal Administrator' : t}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group form-full">
          <label class="form-label" for="ef-homeLocation">Home Location <span class="required">*</span></label>
          <input class="form-control" id="ef-homeLocation" name="homeLocation"
            type="text" placeholder="e.g. Jounieh, Beirut" value="${esc(e.homeLocation)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-baseSalaryLBP">Base Salary (LBP) <span class="required">*</span></label>
          <div class="input-group">
            <input class="form-control" id="ef-baseSalaryLBP" name="baseSalaryLBP"
              type="number" min="0" step="10000" placeholder="0" value="${e.baseSalaryLBP || ''}">
            <span class="input-addon input-addon-right">ل.ل</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="ef-kmDistance">Distance to Work (km) <span class="required">*</span></label>
          <div class="input-group">
            <input class="form-control" id="ef-kmDistance" name="kmDistance"
              type="number" min="0" step="0.5" placeholder="0" value="${e.kmDistance || ''}">
            <span class="input-addon input-addon-right">km</span>
          </div>
          <span class="form-hint">One-way distance from home to workplace</span>
        </div>
      </div>
      <div id="form-errors" style="margin-top:12px;"></div>
    </form>
  `;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openAddModal(onSaved) {
  openModal('Add Employee', buildFormHTML(), {
    confirmLabel: 'Add Employee',
    onConfirm: () => handleSubmit(null, onSaved)
  });
}

export function openEditModal(id, onSaved) {
  const employee = getEmployees().find(e => e.id === id);
  if (!employee) return;

  openModal('Edit Employee', buildFormHTML(employee), {
    confirmLabel: 'Save Changes',
    onConfirm: () => handleSubmit(id, onSaved)
  });
}

function handleSubmit(existingId, onSaved) {
  const form = document.getElementById('employee-form');
  if (!form) return;

  const data = {
    firstName:     form.querySelector('#ef-firstName').value,
    lastName:      form.querySelector('#ef-lastName').value,
    age:           form.querySelector('#ef-age').value,
    homeLocation:  form.querySelector('#ef-homeLocation').value,
    employeeType:  form.querySelector('#ef-employeeType').value,
    baseSalaryLBP: form.querySelector('#ef-baseSalaryLBP').value,
    kmDistance:    form.querySelector('#ef-kmDistance').value
  };

  const errors = validateEmployee(data);
  const errContainer = document.getElementById('form-errors');

  if (errors.length) {
    errContainer.innerHTML = `
      <div class="alert alert-warning">
        <span>⚠</span>
        <ul style="margin:0;padding-left:16px">${errors.map(e => `<li>${e}</li>`).join('')}</ul>
      </div>
    `;
    return; // Keep modal open
  }

  errContainer.innerHTML = '';

  if (existingId) {
    const updated = createEmployee({ ...getEmployees().find(e => e.id === existingId), ...data });
    updated.id = existingId; // preserve original id
    updateEmployee(existingId, updated);
    showToast('Employee updated.', 'success');
  } else {
    addEmployee(createEmployee(data));
    showToast('Employee added.', 'success');
  }

  closeModal();
  if (onSaved) onSaved();
}
