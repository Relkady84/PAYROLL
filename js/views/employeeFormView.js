import { getEmployees, addEmployee, updateEmployee, getRoleRegistry } from '../data/store.js';
import { createEmployee, validateEmployee, EMPLOYEE_TYPES, DEFAULT_EMPLOYEE_SCHEDULE } from '../models/employee.js';
import { DOW_LABELS } from '../models/calendar.js';
import { findRole } from '../models/role.js';
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
          <label class="form-label" for="ef-role">Role <span class="required">*</span></label>
          <select class="form-control" id="ef-role" name="role">
            ${getRoleRegistry().roles.map(r => {
              const selected = (e.role && e.role === r.id)
                            || (!e.role && e.employeeType === r.taxCategory && r.builtin);
              return `<option value="${r.id}" data-tax="${r.taxCategory}" ${selected ? 'selected' : ''}>${r.name}${r.taxCategory !== r.id ? ` (${r.taxCategory} tax)` : ''}</option>`;
            }).join('')}
          </select>
          <span class="form-hint">Add custom roles in Settings → School Calendar → Roles.</span>
        </div>
        <div class="form-group form-full">
          <label class="form-label" for="ef-homeLocation">Home Location <span class="required">*</span></label>
          <input class="form-control" id="ef-homeLocation" name="homeLocation"
            type="text" placeholder="e.g. Jounieh, Beirut" value="${esc(e.homeLocation)}">
        </div>
        <div class="form-group form-full">
          <label class="form-label" for="ef-email">Email Address</label>
          <input class="form-control" id="ef-email" name="email"
            type="email" placeholder="e.g. ahmad@example.com" value="${esc(e.email)}">
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

        <div class="form-group form-full">
          <label class="form-label">Work Schedule <span class="required">*</span></label>
          <div id="ef-schedule-checks" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;"></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" data-preset="full">Full-time (Mon–Fri)</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preset="mwf">Mon / Wed / Fri</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preset="ttf">Tue / Thu</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preset="six">6-day (Mon–Sat)</button>
          </div>
          <span class="form-hint">Days this employee normally works. Used to compute monthly working days for payroll.</span>
        </div>

        <div class="form-group form-full">
          <label class="form-label" for="ef-defaultDaysPerMonth">
            Days worked per month <span class="form-hint" style="margin:0;font-weight:400;">(optional override)</span>
          </label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div class="input-group" style="max-width:240px;flex:0 0 auto;">
              <input class="form-control" id="ef-defaultDaysPerMonth" name="defaultDaysPerMonth"
                type="number" min="0" max="31" step="1" placeholder="Leave empty to use schedule"
                value="${e.defaultDaysPerMonth ?? ''}">
              <span class="input-addon input-addon-right">days</span>
            </div>
            <button type="button" id="ef-clear-days" class="btn btn-secondary btn-sm" title="Clear the override and revert to calendar/schedule calculation">
              ↺ Clear
            </button>
            <span id="ef-days-status" style="font-size:0.78rem;font-weight:600;
              color:${e.defaultDaysPerMonth != null ? '#ea580c' : '#94a3b8'};">
              ${e.defaultDaysPerMonth != null ? '⚠ Override is ACTIVE' : 'Using calendar (no override)'}
            </span>
          </div>
          <span class="form-hint">
            Useful for teachers with dynamic schedules. When set, this number replaces the calendar/schedule
            calculation. Absences and permanences still apply on top. Click <strong>↺ Clear</strong> to undo.
          </span>
        </div>
      </div>
      <div id="form-errors" style="margin-top:12px;"></div>
    </form>
  `;
}

const SCHEDULE_PRESETS = {
  full: [1, 2, 3, 4, 5],
  mwf:  [1, 3, 5],
  ttf:  [2, 4],
  six:  [1, 2, 3, 4, 5, 6]
};

function renderScheduleChecks(selected) {
  const wrap = document.getElementById('ef-schedule-checks');
  if (!wrap) return;
  // Order: Mon, Tue, Wed, Thu, Fri, Sat, Sun (the way schools think)
  const orderedDows = [1, 2, 3, 4, 5, 6, 0];
  wrap.innerHTML = orderedDows.map(dow => `
    <label style="display:inline-flex;align-items:center;gap:5px;font-size:0.82rem;cursor:pointer;
                  padding:5px 10px;border:1.5px solid var(--color-border);border-radius:7px;
                  background:${selected.includes(dow) ? '#dbeafe' : '#fff'};
                  color:${selected.includes(dow) ? '#1e40af' : '#1e293b'};
                  font-weight:${selected.includes(dow) ? '600' : '500'};">
      <input type="checkbox" data-dow="${dow}" ${selected.includes(dow) ? 'checked' : ''}>
      ${DOW_LABELS[dow]}
    </label>
  `).join('');
}

function getSelectedSchedule() {
  const wrap = document.getElementById('ef-schedule-checks');
  if (!wrap) return [...DEFAULT_EMPLOYEE_SCHEDULE];
  return Array.from(wrap.querySelectorAll('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => parseInt(cb.dataset.dow, 10))
    .sort((a, b) => a - b);
}

function bindScheduleControls() {
  // Each checkbox change → re-render to update the visual state
  const wrap = document.getElementById('ef-schedule-checks');
  wrap.addEventListener('change', () => renderScheduleChecks(getSelectedSchedule()));

  // Preset buttons
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = SCHEDULE_PRESETS[btn.dataset.preset];
      if (preset) renderScheduleChecks(preset);
    });
  });

  // Days-per-month override — clear button + live status
  const daysInput  = document.getElementById('ef-defaultDaysPerMonth');
  const clearBtn   = document.getElementById('ef-clear-days');
  const statusEl   = document.getElementById('ef-days-status');

  function updateDaysStatus() {
    if (!statusEl) return;
    const v = (daysInput?.value || '').trim();
    if (v !== '' && !isNaN(parseInt(v, 10))) {
      statusEl.textContent = '⚠ Override is ACTIVE';
      statusEl.style.color = '#ea580c';
    } else {
      statusEl.textContent = 'Using calendar (no override)';
      statusEl.style.color = '#94a3b8';
    }
  }

  if (daysInput) daysInput.addEventListener('input', updateDaysStatus);
  if (clearBtn)  clearBtn.addEventListener('click', () => {
    if (daysInput) {
      daysInput.value = '';
      updateDaysStatus();
      daysInput.focus();
    }
  });
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
  // Modal renders synchronously, so the form DOM is now in place
  renderScheduleChecks([...DEFAULT_EMPLOYEE_SCHEDULE]);
  bindScheduleControls();
}

export function openEditModal(id, onSaved) {
  const employee = getEmployees().find(e => e.id === id);
  if (!employee) return;

  openModal('Edit Employee', buildFormHTML(employee), {
    confirmLabel: 'Save Changes',
    onConfirm: () => handleSubmit(id, onSaved)
  });
  const initialSchedule = Array.isArray(employee.workSchedule) && employee.workSchedule.length
    ? employee.workSchedule
    : [...DEFAULT_EMPLOYEE_SCHEDULE];
  renderScheduleChecks(initialSchedule);
  bindScheduleControls();
}

function handleSubmit(existingId, onSaved) {
  const form = document.getElementById('employee-form');
  if (!form) return;

  const roleSelect = form.querySelector('#ef-role');
  const roleId     = roleSelect.value;
  const role       = findRole(getRoleRegistry(), roleId);
  // Tax category is inherited from the role (Teacher or Admin)
  const taxCategory = role?.taxCategory || 'Teacher';

  const daysOverrideRaw = form.querySelector('#ef-defaultDaysPerMonth').value.trim();

  const data = {
    firstName:     form.querySelector('#ef-firstName').value,
    lastName:      form.querySelector('#ef-lastName').value,
    age:           form.querySelector('#ef-age').value,
    homeLocation:  form.querySelector('#ef-homeLocation').value,
    role:          roleId,
    employeeType:  taxCategory,                     // drives tax/NFS rates
    baseSalaryLBP: form.querySelector('#ef-baseSalaryLBP').value,
    kmDistance:    form.querySelector('#ef-kmDistance').value,
    email:         form.querySelector('#ef-email').value,
    workSchedule:  getSelectedSchedule(),
    defaultDaysPerMonth: daysOverrideRaw === '' ? null : daysOverrideRaw
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
