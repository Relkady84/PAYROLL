import { DEFAULT_SETTINGS } from './defaults.js';
import { DEFAULT_CALENDAR } from '../models/calendar.js';
import { DEFAULT_ROLE_REGISTRY } from '../models/role.js';
import { db } from '../firebase.js';
import {
  collection, doc,
  getDoc, getDocs,
  setDoc, deleteDoc, updateDoc, addDoc,
  query, where, orderBy,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Super Admin ───────────────────────────────────────────
export const SUPER_ADMIN_EMAIL = 'raedelkady@gmail.com';

// ── In-memory cache ───────────────────────────────────────
let _employees  = [];
let _settings   = structuredClone(DEFAULT_SETTINGS);
let _companyId  = null;
let _absenceRequests = [];
let _calendar   = structuredClone(DEFAULT_CALENDAR);
let _academicYears = [];                                  // array of full year docs
let _currentYearId = null;                                // id of the currently active year
let _roleRegistry  = structuredClone(DEFAULT_ROLE_REGISTRY);

// ── Helpers ───────────────────────────────────────────────
function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

// ── Company scope ─────────────────────────────────────────
export function setCompanyId(id) {
  _companyId = id;
}

export function getCompanyId() {
  return _companyId;
}

function companyCol(path) {
  return collection(db, 'companies', _companyId, path);
}

function companyDoc(...segments) {
  return doc(db, 'companies', _companyId, ...segments);
}

// ── Startup: load everything from Firestore ───────────────
export async function initStore() {
  await Promise.all([
    _loadSettings(),
    _loadEmployees(),
    _loadAbsenceRequests(),
    _loadCalendar(),
    _loadAcademicYears(),
    _loadRoleRegistry()
  ]);
  // One-time backfill: ensure /employeeLookup entries exist for all current
  // employees (so they can sign in via the employee portal).
  // Cheap because setDoc with same data is a no-op on the wire after first sync.
  for (const emp of _employees) {
    if (emp.email) _syncEmployeeLookup(emp);
  }
}

async function _loadCalendar() {
  try {
    const snap = await getDoc(companyDoc('calendar', 'config'));
    if (snap.exists()) {
      const stored = snap.data();
      _calendar = {
        ...DEFAULT_CALENDAR,
        ...stored,
        weekendDays: Array.isArray(stored.weekendDays) ? stored.weekendDays : DEFAULT_CALENDAR.weekendDays,
        holidays:    Array.isArray(stored.holidays)    ? stored.holidays    : []
      };
    } else {
      _calendar = structuredClone(DEFAULT_CALENDAR);
    }
  } catch (e) {
    console.warn('Could not load calendar:', e);
    _calendar = structuredClone(DEFAULT_CALENDAR);
  }
}

async function _loadAcademicYears() {
  try {
    const snap = await getDocs(companyCol('academicYears'));
    _academicYears = snap.docs.map(d => ({ ...d.data(), yearId: d.id }));
    const current = _academicYears.find(y => y.isCurrent);
    _currentYearId = current ? current.yearId : (_academicYears[0]?.yearId ?? null);
  } catch (e) {
    console.warn('Could not load academic years:', e);
    _academicYears = [];
    _currentYearId = null;
  }
}

async function _loadRoleRegistry() {
  try {
    const snap = await getDoc(companyDoc('roles', 'registry'));
    if (snap.exists()) {
      const stored = snap.data();
      _roleRegistry = {
        ...DEFAULT_ROLE_REGISTRY,
        ...stored,
        roles: Array.isArray(stored.roles) && stored.roles.length
          ? stored.roles
          : DEFAULT_ROLE_REGISTRY.roles
      };
    } else {
      _roleRegistry = structuredClone(DEFAULT_ROLE_REGISTRY);
    }
  } catch (e) {
    console.warn('Could not load role registry:', e);
    _roleRegistry = structuredClone(DEFAULT_ROLE_REGISTRY);
  }
}

async function _loadAbsenceRequests() {
  try {
    const snap = await getDocs(companyCol('absenceRequests'));
    _absenceRequests = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('Could not load absence requests:', e);
  }
}

async function _loadSettings() {
  try {
    const snap = await getDoc(companyDoc('settings', 'config'));
    if (snap.exists()) {
      const stored = snap.data();
      _settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        taxRates: { ...DEFAULT_SETTINGS.taxRates, ...stored.taxRates },
        nfsRates: { ...DEFAULT_SETTINGS.nfsRates, ...stored.nfsRates }
      };
    } else {
      _settings = structuredClone(DEFAULT_SETTINGS);
    }
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

async function _loadEmployees() {
  try {
    const snap = await getDocs(companyCol('employees'));
    _employees  = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('Could not load employees:', e);
  }
}

// ── Settings ──────────────────────────────────────────────
export function getSettings() {
  return structuredClone(_settings);
}

export function saveSettings(settings) {
  _settings = { ...settings };
  setDoc(companyDoc('settings', 'config'), settings).catch(console.error);
}

export function resetSettings() {
  _settings = structuredClone(DEFAULT_SETTINGS);
  setDoc(companyDoc('settings', 'config'), DEFAULT_SETTINGS).catch(console.error);
}

// ── Calendar ──────────────────────────────────────────────
export function getCalendar() {
  return structuredClone(_calendar);
}

export async function saveCalendar(calendar) {
  _calendar = structuredClone(calendar);
  await setDoc(companyDoc('calendar', 'config'), _calendar);
}

// ── Academic Years ────────────────────────────────────────
export function getAcademicYears() {
  return [..._academicYears].sort((a, b) => (b.yearId || '').localeCompare(a.yearId || ''));
}

export function getAcademicYearById(yearId) {
  return _academicYears.find(y => y.yearId === yearId) || null;
}

export function getCurrentAcademicYear() {
  if (!_currentYearId) return null;
  return _academicYears.find(y => y.yearId === _currentYearId) || null;
}

export function getCurrentAcademicYearId() {
  return _currentYearId;
}

export async function saveAcademicYear(year) {
  if (!year.yearId) throw new Error('saveAcademicYear: yearId is required');
  const idx = _academicYears.findIndex(y => y.yearId === year.yearId);
  if (idx === -1) _academicYears.push({ ...year });
  else            _academicYears[idx] = { ...year };
  await setDoc(companyDoc('academicYears', year.yearId), year);
}

export async function setCurrentAcademicYear(yearId) {
  // Flip flags: only the chosen one is current
  const batch = writeBatch(db);
  for (const y of _academicYears) {
    const updated = { ...y, isCurrent: y.yearId === yearId };
    batch.set(companyDoc('academicYears', y.yearId), updated);
  }
  await batch.commit();
  // Update memory
  _academicYears = _academicYears.map(y => ({ ...y, isCurrent: y.yearId === yearId }));
  _currentYearId = yearId;
}

export async function deleteAcademicYear(yearId) {
  _academicYears = _academicYears.filter(y => y.yearId !== yearId);
  if (_currentYearId === yearId) {
    _currentYearId = _academicYears[0]?.yearId || null;
  }
  await deleteDoc(companyDoc('academicYears', yearId));
}

// Used by employee portal — fetches a single year doc directly.
export async function getAcademicYearFor(companyId, yearId) {
  if (!yearId) return null;
  try {
    const snap = await getDoc(doc(db, 'companies', companyId, 'academicYears', yearId));
    return snap.exists() ? { ...snap.data(), yearId: snap.id } : null;
  } catch (e) {
    console.warn('Could not load academic year:', e);
    return null;
  }
}

/** Find the academic year that a given ISO date falls within.
 *  Used for single-day lookups (e.g., employee portal pay slip).
 */
export function findAcademicYearForDate(iso) {
  if (!iso) return null;
  return _academicYears.find(y => {
    if (typeof y.startDate === 'string' && typeof y.endDate === 'string'
        && iso >= y.startDate && iso <= y.endDate) return true;
    if (y.rolePeriods) {
      for (const periods of Object.values(y.rolePeriods)) {
        if (Array.isArray(periods)) {
          for (const p of periods) {
            if (p && p.from && p.to && iso >= p.from && iso <= p.to) return true;
          }
        }
      }
    }
    return false;
  }) || null;
}

/** Find the academic year that overlaps a given calendar month.
 *  A year matches if its date range OR any role period inside it intersects
 *  ANY day of the month (not just the middle). This is what payroll uses.
 */
export function findAcademicYearForMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const mm        = String(month).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  return _academicYears.find(y => {
    if (typeof y.startDate === 'string' && typeof y.endDate === 'string'
        && y.startDate <= monthEnd && y.endDate >= monthStart) return true;
    if (y.rolePeriods) {
      for (const periods of Object.values(y.rolePeriods)) {
        if (Array.isArray(periods)) {
          for (const p of periods) {
            if (p && p.from && p.to && p.from <= monthEnd && p.to >= monthStart) return true;
          }
        }
      }
    }
    return false;
  }) || null;
}

// ── Role registry ─────────────────────────────────────────
export function getRoleRegistry() {
  return structuredClone(_roleRegistry);
}

export async function saveRoleRegistry(registry) {
  _roleRegistry = structuredClone(registry);
  await setDoc(companyDoc('roles', 'registry'), _roleRegistry);
}

// Employee portal can read this for pay slip computation
export async function getRoleRegistryFor(companyId) {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId, 'roles', 'registry'));
    if (snap.exists()) {
      const stored = snap.data();
      return {
        ...DEFAULT_ROLE_REGISTRY,
        ...stored,
        roles: Array.isArray(stored.roles) && stored.roles.length
          ? stored.roles
          : DEFAULT_ROLE_REGISTRY.roles
      };
    }
  } catch (e) {
    console.warn('Could not load role registry:', e);
  }
  return structuredClone(DEFAULT_ROLE_REGISTRY);
}

// Used by the employee portal pay-slip view (no _companyId state required).
export async function getCalendarFor(companyId) {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId, 'calendar', 'config'));
    if (snap.exists()) {
      const stored = snap.data();
      return {
        ...DEFAULT_CALENDAR,
        ...stored,
        weekendDays: Array.isArray(stored.weekendDays) ? stored.weekendDays : DEFAULT_CALENDAR.weekendDays,
        holidays:    Array.isArray(stored.holidays)    ? stored.holidays    : []
      };
    }
  } catch (e) {
    console.warn('Could not load calendar:', e);
  }
  return structuredClone(DEFAULT_CALENDAR);
}

// ── Employees ─────────────────────────────────────────────
export function getEmployees() {
  return [..._employees];
}

export function getEmployeeById(id) {
  return _employees.find(e => e.id === id) || null;
}

export function addEmployee(employee) {
  _employees.push(employee);
  setDoc(companyDoc('employees', employee.id), employee).catch(console.error);
  _syncEmployeeLookup(employee);
}

export function updateEmployee(id, changes) {
  const idx = _employees.findIndex(e => e.id === id);
  if (idx === -1) return false;
  const previous = _employees[idx];
  _employees[idx] = { ...previous, ...changes };
  setDoc(companyDoc('employees', id), _employees[idx]).catch(console.error);
  // If email changed, remove old lookup entry
  if (previous.email && emailKey(previous.email) !== emailKey(_employees[idx].email)) {
    _removeEmployeeLookup(previous.email);
  }
  _syncEmployeeLookup(_employees[idx]);
  return true;
}

export function deleteEmployee(id) {
  const emp = _employees.find(e => e.id === id);
  _employees = _employees.filter(e => e.id !== id);
  deleteDoc(companyDoc('employees', id)).catch(console.error);
  if (emp?.email) _removeEmployeeLookup(emp.email);
}

export function mergeEmployees(incoming) {
  const map   = new Map(_employees.map(e => [e.id, e]));
  const batch = writeBatch(db);

  for (const emp of incoming) {
    const merged = { ...(map.get(emp.id) ?? {}), ...emp };
    map.set(emp.id, merged);
    batch.set(companyDoc('employees', emp.id), merged);
  }

  _employees = [...map.values()];
  batch.commit()
    .then(() => {
      // Sync lookup entries after batch commits
      for (const emp of incoming) {
        _syncEmployeeLookup(emp);
      }
    })
    .catch(console.error);
}

// ── Employee email → company/employee lookup table ────────
// Stored at /employeeLookup/{lowercased-email} so an employee logging in
// for the first time can find which company they belong to.
function _syncEmployeeLookup(employee) {
  const key = emailKey(employee.email);
  if (!key) return;
  setDoc(doc(db, 'employeeLookup', key), {
    companyId:  _companyId,
    employeeId: employee.id,
    name:       `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
  }).catch(e => console.warn('Could not write employee lookup:', e));
}

function _removeEmployeeLookup(email) {
  const key = emailKey(email);
  if (!key) return;
  deleteDoc(doc(db, 'employeeLookup', key))
    .catch(e => console.warn('Could not delete employee lookup:', e));
}

export async function lookupEmployeeByEmail(email) {
  const key = emailKey(email);
  if (!key) return null;
  try {
    const snap = await getDoc(doc(db, 'employeeLookup', key));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Lookup failed:', e);
    return null;
  }
}

// ── Absence Requests ──────────────────────────────────────
export function getAbsenceRequests() {
  return [..._absenceRequests];
}

export function getAbsenceRequestsForEmployee(employeeId) {
  return _absenceRequests.filter(r => r.employeeId === employeeId);
}

export async function addAbsenceRequest(request) {
  const ref  = await addDoc(companyCol('absenceRequests'), request);
  const full = { ...request, id: ref.id };
  _absenceRequests.push(full);
  return full;
}

export async function updateAbsenceRequest(id, changes) {
  const idx = _absenceRequests.findIndex(r => r.id === id);
  if (idx === -1) return false;
  _absenceRequests[idx] = { ..._absenceRequests[idx], ...changes };
  await setDoc(companyDoc('absenceRequests', id), _absenceRequests[idx]);
  return true;
}

export async function deleteAbsenceRequest(id) {
  _absenceRequests = _absenceRequests.filter(r => r.id !== id);
  await deleteDoc(companyDoc('absenceRequests', id));
}

// Used by the employee portal — loads only that employee's requests
// (the rules permit this without loading the whole company collection).
export async function loadOwnAbsenceRequests(companyId, employeeId) {
  try {
    const ref  = collection(db, 'companies', companyId, 'absenceRequests');
    const q    = query(ref, where('employeeId', '==', employeeId));
    const snap = await getDocs(q);
    _absenceRequests = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('Could not load own absence requests:', e);
    _absenceRequests = [];
  }
}

// Direct write for employee portal (uses companyId param since _companyId
// may not be set in the employee-portal flow).
export async function addOwnAbsenceRequest(companyId, request) {
  const ref = await addDoc(
    collection(db, 'companies', companyId, 'absenceRequests'),
    request
  );
  const full = { ...request, id: ref.id };
  _absenceRequests.push(full);
  return full;
}

export async function deleteOwnAbsenceRequest(companyId, requestId) {
  await deleteDoc(doc(db, 'companies', companyId, 'absenceRequests', requestId));
  _absenceRequests = _absenceRequests.filter(r => r.id !== requestId);
}

// ── User record helpers (top-level /users collection) ─────
export async function getUserRecord(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function createUserRecord(uid, data) {
  await setDoc(doc(db, 'users', uid), data);
}

// ── Personal Notes (private to each user) ─────────────────
// Stored at /users/{uid}/notes/{noteId}. Firestore rules ensure ONLY the user
// can read/write their own notes — not even company admin or super admin.
export async function getMyNotes(uid) {
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'notes'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn('Could not load notes:', e);
    return [];
  }
}

export async function addMyNote(uid, note) {
  if (!uid) throw new Error('addMyNote: uid required');
  const ref = await addDoc(collection(db, 'users', uid, 'notes'), {
    title:     String(note.title || '').trim(),
    body:      String(note.body  || ''),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return { id: ref.id, ...note };
}

export async function updateMyNote(uid, noteId, changes) {
  if (!uid || !noteId) throw new Error('updateMyNote: uid + noteId required');
  await updateDoc(doc(db, 'users', uid, 'notes', noteId), {
    ...(changes.title !== undefined && { title: String(changes.title).trim() }),
    ...(changes.body  !== undefined && { body:  String(changes.body) }),
    updatedAt: Date.now()
  });
}

export async function deleteMyNote(uid, noteId) {
  if (!uid || !noteId) throw new Error('deleteMyNote: uid + noteId required');
  await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
}

// ── Company metadata helpers ───────────────────────────────
export async function createCompany(companyId, metadata) {
  // Write to both the root company document (for super-admin listing) and the metadata subcollection
  await Promise.all([
    setDoc(doc(db, 'companies', companyId), metadata),
    setDoc(doc(db, 'companies', companyId, 'metadata', 'info'), metadata)
  ]);
}

export async function getCompanyMetadata() {
  const snap = await getDoc(companyDoc('metadata', 'info'));
  return snap.exists() ? snap.data() : null;
}

export async function updateCompanyMetadata(data) {
  const companyId = _companyId;
  await Promise.all([
    setDoc(doc(db, 'companies', companyId), data, { merge: true }),
    setDoc(companyDoc('metadata', 'info'), data, { merge: true })
  ]);
}

// ── Employee Portal helpers (no _companyId state required) ──
export async function getEmployeeRecord(companyId, employeeId) {
  const snap = await getDoc(doc(db, 'companies', companyId, 'employees', employeeId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

export async function getCompanyMetadataFor(companyId) {
  const snap = await getDoc(doc(db, 'companies', companyId, 'metadata', 'info'));
  return snap.exists() ? snap.data() : null;
}

export async function getSettingsFor(companyId) {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId, 'settings', 'config'));
    if (snap.exists()) {
      const stored = snap.data();
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        taxRates: { ...DEFAULT_SETTINGS.taxRates, ...stored.taxRates },
        nfsRates: { ...DEFAULT_SETTINGS.nfsRates, ...stored.nfsRates }
      };
    }
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
  return structuredClone(DEFAULT_SETTINGS);
}

// ── Super Admin: list all companies ───────────────────────
export async function getAllCompanies() {
  const snap = await getDocs(collection(db, 'companies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
