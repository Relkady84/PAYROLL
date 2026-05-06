/**
 * i18n — internationalization helper.
 *
 * Usage:
 *   import { t } from './i18n.js';
 *   t('common.save')                       → 'Save' (or 'Enregistrer')
 *   t('portal.greet', { name: 'Ahmad' })   → 'Hi, Ahmad 👋' (or 'Bonjour, Ahmad 👋')
 *
 * Language is persisted in localStorage. setLanguage() reloads the page so
 * every view (including the static index.html nav) picks up the change.
 */

import { en } from './i18n/en.js';
import { fr } from './i18n/fr.js';

const SUPPORTED = ['en', 'fr'];
const DICTS     = { en, fr };

const STORAGE_KEY = 'payroll-lang';

let _currentLang = (() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(stored)) return stored;
  // Auto-detect from browser locale
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : 'en';
})();

export function getLanguage() {
  return _currentLang;
}

export function setLanguage(lang) {
  if (!SUPPORTED.includes(lang) || lang === _currentLang) return;
  localStorage.setItem(STORAGE_KEY, lang);
  // Page reload is the simplest way to re-render the entire app
  // (including the static HTML in index.html). The language sticks afterwards.
  location.reload();
}

export function t(key, params = {}) {
  const dict = DICTS[_currentLang] || DICTS.en;
  let str = dict[key];
  if (str === undefined) str = DICTS.en[key];     // fallback to English
  if (str === undefined) str = key;                // ultimate fallback: the key itself
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

/** Locale string for date/number formatting. */
export function getLocale() {
  return _currentLang === 'fr' ? 'fr-FR' : 'en-US';
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' }
];

/**
 * Apply translations to any DOM elements with [data-i18n] attributes.
 * Useful for static HTML like the login screen and sidebar.
 *   <span data-i18n="nav.dashboard">Dashboard</span>
 */
export function applyTranslationsToDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    // <input data-i18n-attr="placeholder:portal.search" placeholder="Search…">
    const spec = el.dataset.i18nAttr;
    const [attr, key] = spec.split(':');
    if (attr && key) el.setAttribute(attr, t(key));
  });
}
