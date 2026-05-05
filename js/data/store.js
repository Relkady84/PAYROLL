import { DEFAULT_SETTINGS } from './defaults.js';
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
  await Promise.all([_loadSettings(), _loadEmployees(), _loadAbsenceRequests()]);
  // One-time backfill: ensure /employeeLookup entries exist for all current
  // employees (so they can sign in via the employee portal).
  // Cheap because setDoc with same data is a no-op on the wire after first sync.
  for (const emp of _employees) {
    if (emp.email) _syncEmployeeLookup(emp);
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

// ── Super Admin: list all companies ───────────────────────
export async function getAllCompanies() {
  const snap = await getDocs(collection(db, 'companies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
