import { getEmployees, deleteEmployee } from '../data/store.js';
import { getSettings } from '../data/store.js';
import { openAddModal, openEditModal } from './employeeFormView.js';
import { openModal, closeModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { importCSV, importExcel } from '../services/importService.js';

let _filterType   = 'all';
let _searchQuery  = '';
let _sortKey      = 'firstName';
let _sortDir      = 'asc';

export function render(selector) {
  const container = document.querySelector(selector);
  _filterType  = 'all';
  _searchQuery = '';
  _sortKey     = 'firstName';
  _sortDir     = 'asc';

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Employees</h1>
        <span class="content-header-subtitle" id="emp-count-label">Loading…</span>
      </div>
      <div class="content-header-actions">
        <button class="btn btn-primary" id="add-employee-btn">+ Add Employee</button>
      </div>
    </div>
    <div class="page-body">
      <div class="section-card">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" id="emp-search" placeholder="Search by name or location…">
            </div>
            <select class="filter-select" id="emp-type-filter">
              <option value="all">All Types</option>
              <option value="Teacher">Teachers</option>
              <option value="Admin">Administrators</option>
            </select>
          </div>
          <div class="toolbar-right">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;" title="Import any spreadsheet (CSV, Excel) — file must include a Type column with values 'Teacher' or 'Admin'">
              📥 Import Spreadsheet
              <input type="file" class="file-input-hidden" id="import-spreadsheet" accept=".csv,.xlsx,.xls">
            </label>
            <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-weight:500;margin-left:8px;">QUICK CSV:</span>
            <label class="btn btn-secondary btn-sm badge-teacher" style="cursor:pointer;" title="Import Teachers from CSV (auto-sets type to Teacher)">
              📂 Teachers
              <input type="file" class="file-input-hidden" id="import-teacher-csv" accept=".csv">
            </label>
            <label class="btn btn-secondary btn-sm badge-admin" style="cursor:pointer;" title="Import Administrators from CSV (auto-sets type to Admin)">
              📂 Administrators
              <input type="file" class="file-input-hidden" id="import-admin-csv" accept=".csv">
            </label>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="emp-table">
            <thead>
              <tr>
                <th class="sortable" data-key="firstName">Name <span class="sort-icon">↕</span></th>
                <th>Type</th>
                <th class="sortable" data-key="age">Age <span class="sort-icon">↕</span></th>
                <th>Location</th>
                <th class="sortable" data-key="baseSalaryLBP">Base Salary <span class="sort-icon">↕</span></th>
                <th class="sortable" data-key="kmDistance">Distance <span class="sort-icon">↕</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="emp-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderRows(container);

  // Add employee
  document.getElementById('add-employee-btn').addEventListener('click', () => {
    openAddModal(() => renderRows(container));
  });

  // Import Spreadsheet (CSV or Excel) — type is read from the file's "Type" column
  document.getElementById('import-spreadsheet').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const importer = (ext === 'xlsx' || ext === 'xls') ? importExcel : importCSV;
    importer(file,
      count => { showToast(`${count} employee(s) imported.`, 'success'); renderRows(container); },
      err   => showToast(err, 'error')
      // No forceType — file must contain a Type column ('Teacher' or 'Admin')
    );
    e.target.value = '';
  });

  // Import Teachers CSV
  document.getElementById('import-teacher-csv').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importCSV(file,
      count => { showToast(`${count} teacher(s) imported.`, 'success'); renderRows(container); },
      err   => showToast(err, 'error'),
      'Teacher'
    );
    e.target.value = '';
  });

  // Import Administrators CSV
  document.getElementById('import-admin-csv').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importCSV(file,
      count => { showToast(`${count} administrator(s) imported.`, 'success'); renderRows(container); },
      err   => showToast(err, 'error'),
      'Admin'
    );
    e.target.value = '';
  });

  // Search
  document.getElementById('emp-search').addEventListener('input', e => {
    _searchQuery = e.target.value.toLowerCase();
    renderRows(container);
  });

  // Type filter
  document.getElementById('emp-type-filter').addEventListener('change', e => {
    _filterType = e.target.value;
    renderRows(container);
  });

  // Sort headers
  document.getElementById('emp-table').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const key = th.dataset.key;
    if (_sortKey === key) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortKey = key;
      _sortDir = 'asc';
    }
    renderRows(container);
  });

  // Delegate edit/delete on tbody
  document.getElementById('emp-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit') {
      openEditModal(id, () => renderRows(container));
    }
    if (action === 'delete') {
      confirmDelete(id, () => renderRows(container));
    }
  });
}

function renderRows(container) {
  const settings  = getSettings();
  let employees   = getEmployees();

  // Filter
  if (_filterType !== 'all') {
    employees = employees.filter(e => e.employeeType === _filterType);
  }
  if (_searchQuery) {
    employees = employees.filter(e =>
      `${e.firstName} ${e.lastName} ${e.homeLocation}`.toLowerCase().includes(_searchQuery)
    );
  }

  // Sort
  employees = [...employees].sort((a, b) => {
    let va = a[_sortKey] ?? '';
    let vb = b[_sortKey] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Update count label
  const total = getEmployees().length;
  document.getElementById('emp-count-label').textContent =
    `${total} employee${total !== 1 ? 's' : ''} total`;

  // Update sort icons
  document.querySelectorAll('#emp-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.key === _sortKey) {
      th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = _sortDir === 'asc' ? '↑' : '↓';
    } else {
      if (icon) icon.textContent = '↕';
    }
  });

  const tbody = document.getElementById('emp-tbody');

  if (!employees.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="table-empty">
            <div class="table-empty-icon">👤</div>
            <p>${_searchQuery || _filterType !== 'all' ? 'No employees match your filter.' : 'No employees yet.'}</p>
            ${!_searchQuery && _filterType === 'all'
              ? '<button class="btn btn-primary" id="empty-add-btn">+ Add First Employee</button>'
              : ''}
          </div>
        </td>
      </tr>
    `;
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      openAddModal(() => renderRows(container));
    });
    return;
  }

  const fmt = n => n.toLocaleString('en-US');
  const fmtUSD = n => '$' + (n / settings.exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  tbody.innerHTML = employees.map(e => `
    <tr>
      <td>
        <strong>${esc(e.firstName)} ${esc(e.lastName)}</strong>
        ${e.email ? `<br><span style="font-size:var(--font-size-xs);color:var(--color-text-muted);">${esc(e.email)}</span>` : ''}
      </td>
      <td>
        <span class="badge badge-${e.employeeType === 'Teacher' ? 'teacher' : 'admin'}">
          ${e.employeeType === 'Admin' ? 'Administrator' : 'Teacher'}
        </span>
      </td>
      <td>${e.age}</td>
      <td>${esc(e.homeLocation)}</td>
      <td>
        <span class="num-lbp">${fmt(e.baseSalaryLBP)} ل.ل</span>
        <span class="num-usd">${fmtUSD(e.baseSalaryLBP)}</span>
      </td>
      <td>${e.kmDistance} km</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${e.id}" title="Edit">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${e.id}" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function confirmDelete(id, onDeleted) {
  const emp = getEmployees().find(e => e.id === id);
  if (!emp) return;
  const name = `${emp.firstName} ${emp.lastName}`;

  openModal(
    'Delete Employee',
    `<p style="color:var(--color-text-secondary)">Are you sure you want to delete <strong>${esc(name)}</strong>? This action cannot be undone.</p>`,
    {
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        deleteEmployee(id);
        closeModal();
        showToast(`${name} has been deleted.`, 'info');
        onDeleted();
      }
    }
  );
}

function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
