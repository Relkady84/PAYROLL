import { DEFAULT_SETTINGS } from './defaults.js';
import { db } from '../firebase.js';
import {
  collection, doc,
  getDoc, getDocs,
  setDoc, updateDoc, deleteDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── In-memory cache (populated once at login) ─────────────
let _employees = [];
let _settings  = structuredClone(DEFAULT_SETTINGS);

// ── Startup: load everything from Firestore ───────────────
export async function initStore() {
  await Promise.all([_loadSettings(), _loadEmployees()]);
}

async function _loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    if (snap.exists()) {
      const stored = snap.data();
      _settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        taxRates: { ...DEFAULT_SETTINGS.taxRates, ...stored.taxRates },
        nfsRates: { ...DEFAULT_SETTINGS.nfsRates, ...stored.nfsRates }
      };
    }
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

async function _loadEmployees() {
  try {
    const snap = await getDocs(collection(db, 'employees'));
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
  setDoc(doc(db, 'settings', 'config'), settings).catch(console.error);
}

export function resetSettings() {
  _settings = structuredClone(DEFAULT_SETTINGS);
  setDoc(doc(db, 'settings', 'config'), DEFAULT_SETTINGS).catch(console.error);
}

// ── Employees ─────────────────────────────────────────────
export function getEmployees() {
  return [..._employees];
}

export function addEmployee(employee) {
  _employees.push(employee);
  setDoc(doc(db, 'employees', employee.id), employee).catch(console.error);
}

export function updateEmployee(id, changes) {
  const idx = _employees.findIndex(e => e.id === id);
  if (idx === -1) return false;
  _employees[idx] = { ..._employees[idx], ...changes };
  setDoc(doc(db, 'employees', id), _employees[idx]).catch(console.error);
  return true;
}

export function deleteEmployee(id) {
  _employees = _employees.filter(e => e.id !== id);
  deleteDoc(doc(db, 'employees', id)).catch(console.error);
}

export function mergeEmployees(incoming) {
  const map   = new Map(_employees.map(e => [e.id, e]));
  const batch = writeBatch(db);

  for (const emp of incoming) {
    const merged = { ...(map.get(emp.id) ?? {}), ...emp };
    map.set(emp.id, merged);
    batch.set(doc(db, 'employees', emp.id), merged);
  }

  _employees = [...map.values()];
  batch.commit().catch(console.error);
}
