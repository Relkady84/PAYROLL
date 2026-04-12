import { DEFAULT_SETTINGS } from './defaults.js';
import { db } from '../firebase.js';
import {
  collection, doc,
  getDoc, getDocs,
  setDoc, deleteDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Super Admin ───────────────────────────────────────────
export const SUPER_ADMIN_EMAIL = 'raedelkady@gmail.com';

// ── In-memory cache ───────────────────────────────────────
let _employees  = [];
let _settings   = structuredClone(DEFAULT_SETTINGS);
let _companyId  = null;

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
  await Promise.all([_loadSettings(), _loadEmployees()]);
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

export function addEmployee(employee) {
  _employees.push(employee);
  setDoc(companyDoc('employees', employee.id), employee).catch(console.error);
}

export function updateEmployee(id, changes) {
  const idx = _employees.findIndex(e => e.id === id);
  if (idx === -1) return false;
  _employees[idx] = { ..._employees[idx], ...changes };
  setDoc(companyDoc('employees', id), _employees[idx]).catch(console.error);
  return true;
}

export function deleteEmployee(id) {
  _employees = _employees.filter(e => e.id !== id);
  deleteDoc(companyDoc('employees', id)).catch(console.error);
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
  batch.commit().catch(console.error);
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

// ── Super Admin: list all companies ───────────────────────
export async function getAllCompanies() {
  const snap = await getDocs(collection(db, 'companies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
