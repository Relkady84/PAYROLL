import {
  getSettings, saveSettings, resetSettings,
  getCompanyMetadata, updateCompanyMetadata,
  getCalendar, saveCalendar,
  getAcademicYears, getCurrentAcademicYear, getCurrentAcademicYearId,
  saveAcademicYear, setCurrentAcademicYear, deleteAcademicYear,
  getRoleRegistry, saveRoleRegistry,
  setCompanyBackupSchedule, recordBackupTaken, buildCompanyBackup
} from '../data/store.js';
import { openRestoreOverlay } from './backupRestoreView.js';
import { validateSettings, normalizeSettings, denormalizeSettings } from '../models/settings.js';
import {
  DOW_LABELS, DOW_LABELS_FULL,
  seedLebaneseHolidays, validateHoliday
} from '../models/calendar.js';
import {
  TAX_CATEGORIES, validateRole
} from '../models/role.js';
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, t } from '../i18n.js';
import {
  makeAcademicYear, generateYearId, suggestCurrentAcademicYear,
  validatePeriod
} from '../models/academicYear.js';
import { showToast } from './components/toast.js';
import { openModal, closeModal } from './components/modal.js';

export async function render(selector) {
  const container = document.querySelector(selector);
  const settings  = denormalizeSettings(getSettings());
  const meta      = await getCompanyMetadata() || {};

  const logoUrl = meta.logoUrl || '';

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>${esc(t('settings.title'))}</h1>
        <span class="content-header-subtitle">${esc(t('settings.subtitle'))}</span>
      </div>
    </div>

    <!-- Settings tabs -->
    <div id="settings-tabs" style="display:flex;flex-wrap:wrap;gap:4px;padding:0 20px;margin:0 0 16px;border-bottom:2px solid var(--color-border);">
      <button type="button" class="settings-tab" data-tab="company">${esc(t('settings.tab.company'))}</button>
      <button type="button" class="settings-tab" data-tab="display">${esc(t('settings.tab.display'))}</button>
      <button type="button" class="settings-tab" data-tab="calendar">${esc(t('settings.tab.calendar'))}</button>
      <button type="button" class="settings-tab" data-tab="academic">${esc(t('settings.tab.academic'))}</button>
      <button type="button" class="settings-tab" data-tab="global">${esc(t('settings.tab.global'))}</button>
      <button type="button" class="settings-tab" data-tab="backup">${esc(t('settings.tab.backup'))}</button>
      <button type="button" class="settings-tab" data-tab="language">${esc(t('settings.tab.language'))}</button>
    </div>

    <div class="page-body">

      <!-- Language -->
      <div class="section-card settings-pane" data-pane="language" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.language'))}</span>
        </div>
        <div class="section-card-body">
          <div id="lang-picker" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
          <span class="form-hint" style="margin-top:8px;">${esc(t('settings.lang_hint'))}</span>
        </div>
      </div>

      <!-- Company Profile -->
      <div class="section-card settings-pane" data-pane="company" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.company'))}</span>
        </div>
        <div class="section-card-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="company-name-field">Company Name</label>
              <input class="form-control" id="company-name-field" type="text"
                placeholder="e.g. Lycée Montaigne"
                value="${esc(meta.name || '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="company-logo-url">Logo URL</label>
              <input class="form-control" id="company-logo-url" type="url"
                placeholder="https://example.com/logo.png"
                value="${esc(logoUrl)}">
              <span class="form-hint">Paste a direct image URL, or upload a file below</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="company-logo-file">Upload Logo (JPG / PNG / SVG)</label>
              <input class="form-control" id="company-logo-file" type="file"
                accept="image/jpeg,image/png,image/svg+xml,image/webp">
              <span class="form-hint">Max recommended size: 200 KB</span>
            </div>
            <div class="form-group" style="align-self:center;">
              <label class="form-label">Preview</label>
              <div id="logo-preview" style="width:64px;height:64px;border-radius:10px;
                   border:2px dashed #e2e8f0;display:flex;align-items:center;
                   justify-content:center;font-size:28px;background:#f8fafc;overflow:hidden;">
                ${logoUrl
                  ? `<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:contain;">`
                  : '💼'}
              </div>
            </div>
          </div>
          <button type="button" id="save-profile-btn" class="btn btn-primary">
            💾 Save Company Profile
          </button>

          <!-- Quick Links — shown on Employee Portal Home page -->
          <div class="settings-section" style="margin-top:24px;border-top:1px solid var(--color-border);padding-top:18px;">
            <div class="settings-section-title">🔗 Quick Links (Employee Portal Home)</div>
            <div class="alert alert-info" style="margin-bottom:12px;">
              <span>ℹ</span>
              <span>These tiles appear on the Employee Portal home page. Each opens in a new tab.</span>
            </div>

            <div id="quicklinks-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>

            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;background:#f8fafc;padding:12px;border-radius:8px;">
              <div style="flex:0 0 70px;">
                <label class="form-label" style="font-size:0.78rem;">Icon</label>
                <input type="text" class="form-control" id="ql-add-icon" maxlength="4" placeholder="📚" style="text-align:center;font-size:1.1rem;">
              </div>
              <div style="flex:1 1 160px;">
                <label class="form-label" style="font-size:0.78rem;">Label</label>
                <input type="text" class="form-control" id="ql-add-label" maxlength="40" placeholder="e.g., Pronote">
              </div>
              <div style="flex:2 1 220px;">
                <label class="form-label" style="font-size:0.78rem;">URL</label>
                <input type="url" class="form-control" id="ql-add-url" placeholder="https://...">
              </div>
              <button type="button" class="btn btn-secondary" id="ql-add-btn">+ Add</button>
            </div>
            <div id="ql-add-error" style="font-size:0.78rem;color:var(--color-danger);margin-top:6px;min-height:18px;"></div>

            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary" id="ql-save-btn">💾 Save Quick Links</button>
              <button type="button" class="btn btn-secondary" id="ql-defaults-btn">↺ Restore default links</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Display Settings -->
      <div class="section-card settings-pane" data-pane="display" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.display'))}</span>
        </div>
        <div class="section-card-body">

          <!-- Preset themes -->
          <div style="margin-bottom:20px;">
            <div class="form-label" style="margin-bottom:10px;">Quick Themes</div>
            <div id="theme-presets" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
          </div>

          <!-- Color pickers -->
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="color-sidebar">Sidebar Background</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" id="color-sidebar" style="width:48px;height:36px;border:none;
                  border-radius:6px;cursor:pointer;padding:2px;">
                <span id="color-sidebar-hex" style="font-size:0.8rem;color:#64748b;font-family:monospace;"></span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="color-sidebar-active">Sidebar Active Item</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" id="color-sidebar-active" style="width:48px;height:36px;border:none;
                  border-radius:6px;cursor:pointer;padding:2px;">
                <span id="color-sidebar-active-hex" style="font-size:0.8rem;color:#64748b;font-family:monospace;"></span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="color-header">Header Bar</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" id="color-header" style="width:48px;height:36px;border:none;
                  border-radius:6px;cursor:pointer;padding:2px;">
                <span id="color-header-hex" style="font-size:0.8rem;color:#64748b;font-family:monospace;"></span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="color-page-bg">Page Background</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="color" id="color-page-bg" style="width:48px;height:36px;border:none;
                  border-radius:6px;cursor:pointer;padding:2px;">
                <span id="color-page-bg-hex" style="font-size:0.8rem;color:#64748b;font-family:monospace;"></span>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:4px;">
            <button type="button" id="save-display-btn" class="btn btn-primary">
              💾 Save Colors
            </button>
            <button type="button" id="reset-display-btn" class="btn btn-secondary">
              ↺ Reset to Default
            </button>
          </div>
        </div>
      </div>

      <!-- School Calendar -->
      <div class="section-card settings-pane" id="calendar-card" data-pane="calendar" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.calendar'))}</span>
        </div>
        <div class="section-card-body">
          <div class="alert alert-info" style="margin-bottom:14px;">
            <span>ℹ</span>
            <span>The calendar auto-computes monthly working days. Define weekends and holidays once
              per year and the Payroll page applies them automatically (alongside approved absences).</span>
          </div>

          <!-- Weekends -->
          <div class="settings-section">
            <div class="settings-section-title">Weekend Days</div>
            <div id="cal-weekend-checks" style="display:flex;flex-wrap:wrap;gap:10px;"></div>
            <span class="form-hint">Lebanon default: Saturday + Sunday. Some schools follow Friday + Saturday or Sunday only.</span>
          </div>

          <!-- Holidays list -->
          <div class="settings-section">
            <div class="settings-section-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span>Holidays</span>

              <!-- Year filter dropdown (multi-select) -->
              <div id="cal-year-filter-wrap" style="position:relative;display:inline-block;font-weight:400;font-size:0.8rem;">
                <button type="button" id="cal-year-filter-btn"
                  style="padding:5px 10px;border:1.5px solid var(--color-border);border-radius:6px;
                         background:#fff;cursor:pointer;font-family:inherit;font-size:0.78rem;
                         color:var(--color-text-secondary);display:inline-flex;align-items:center;gap:6px;">
                  <span id="cal-year-filter-label">All years</span>
                  <span style="font-size:0.7rem;">▼</span>
                </button>
                <div id="cal-year-filter-menu"
                  style="display:none;position:absolute;top:100%;left:0;margin-top:4px;
                         background:#fff;border:1.5px solid var(--color-border);border-radius:8px;
                         box-shadow:0 4px 12px rgba(0,0,0,0.08);min-width:180px;z-index:1000;
                         padding:6px;max-height:280px;overflow-y:auto;">
                  <!-- Filled by JS -->
                </div>
              </div>

              <span id="cal-holiday-count" style="font-size:0.75rem;color:var(--color-text-muted);font-weight:400;margin-left:auto;"></span>
            </div>

            <div class="table-wrapper" style="margin-bottom:10px;">
              <table class="data-table" id="cal-holidays-table">
                <thead>
                  <tr>
                    <th style="width:140px;">Date</th>
                    <th>Name</th>
                    <th style="width:120px;">Type</th>
                    <th style="width:80px;">Action</th>
                  </tr>
                </thead>
                <tbody id="cal-holidays-tbody"></tbody>
              </table>
            </div>

            <!-- Add holiday / vacation period inline form -->
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
              <div style="flex:0 0 150px;">
                <label class="form-label">From date</label>
                <input type="date" class="form-control" id="cal-add-date">
              </div>
              <div style="flex:0 0 150px;">
                <label class="form-label">To date <span class="form-hint" style="margin:0;font-weight:400;">(optional)</span></label>
                <input type="date" class="form-control" id="cal-add-end-date">
              </div>
              <div style="flex:1 1 200px;">
                <label class="form-label">Name</label>
                <input type="text" class="form-control" id="cal-add-name" maxlength="80" placeholder="e.g., Christmas Break, All Saints Week">
              </div>
              <div style="flex:0 0 130px;">
                <label class="form-label">Type</label>
                <select class="form-control" id="cal-add-type">
                  <option value="school">School</option>
                  <option value="official">Official</option>
                </select>
              </div>
              <div>
                <button type="button" class="btn btn-secondary" id="cal-add-btn">+ Add</button>
              </div>
            </div>
            <div id="cal-add-error" style="font-size:0.78rem;color:var(--color-danger);margin-top:6px;min-height:18px;"></div>
            <span class="form-hint" style="margin-top:6px;">
              For multi-day vacations, fill both <strong>From</strong> and <strong>To</strong>.
              The system creates one entry per day automatically. Days that fall on weekends are still included
              (so the calendar stays accurate if you ever change which days are weekends).
            </span>

            <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
              <button type="button" class="btn btn-secondary btn-sm" id="cal-prefill-btn">
                🇱🇧 Pre-fill Lebanese holidays
              </button>
              <span class="form-hint" style="margin:0;">
                Adds 10 fixed-date Lebanese holidays for both the current year and the next year (so school
                breaks crossing Jan 1 get the right labels). Movable holidays (Easter, Eid, Ashura) and
                school breaks (Christmas, All Saints, Snow week) must be added manually.
              </span>
            </div>
          </div>

          <!-- Save -->
          <div style="display:flex;gap:10px;padding-top:8px;">
            <button type="button" class="btn btn-primary" id="cal-save-btn">💾 Save Calendar</button>
          </div>
        </div>
      </div>

      <!-- Academic Year + Roles -->
      <div class="section-card settings-pane" id="academic-year-card" data-pane="academic" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.academic'))}</span>
        </div>
        <div class="section-card-body">

          <div class="alert alert-info" style="margin-bottom:14px;">
            <span>ℹ</span>
            <span>Define each role's active period within the academic year. For example: Teachers
              start Sep 7, Administrators start Sep 1, Service Financier starts Aug 21 with a permanence
              period at end of July (1 day/week).</span>
          </div>

          <!-- Year selector + actions -->
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:18px;">
            <div style="flex:1 1 220px;">
              <label class="form-label">Academic year</label>
              <select class="form-control" id="ay-year-select"></select>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="ay-new-btn">+ New year</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ay-set-current-btn">★ Set as current</button>
            <button type="button" class="btn btn-danger btn-sm" id="ay-delete-btn">🗑 Delete</button>
          </div>

          <!-- Year details -->
          <div id="ay-details">
            <!-- Filled by JS -->
          </div>

          <!-- Roles management -->
          <div class="settings-section" style="margin-top:24px;">
            <div class="settings-section-title">Roles</div>
            <div class="table-wrapper" style="margin-bottom:10px;">
              <table class="data-table" id="role-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style="width:140px;">Tax category</th>
                    <th style="width:100px;">Action</th>
                  </tr>
                </thead>
                <tbody id="role-tbody"></tbody>
              </table>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
              <div style="flex:1 1 200px;">
                <label class="form-label">Add role — name</label>
                <input type="text" class="form-control" id="role-add-name" maxlength="50"
                  placeholder="e.g., Service Financier">
              </div>
              <div style="flex:0 0 160px;">
                <label class="form-label">Tax category</label>
                <select class="form-control" id="role-add-tax">
                  ${TAX_CATEGORIES.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
              </div>
              <button type="button" class="btn btn-secondary" id="role-add-btn">+ Add role</button>
            </div>
            <div id="role-add-error" style="font-size:0.78rem;color:var(--color-danger);margin-top:6px;min-height:18px;"></div>
            <span class="form-hint">Built-in roles (Teacher, Administrator) cannot be deleted. Custom roles
              like "Service Financier" inherit their tax/NFS rates from the chosen tax category.</span>
          </div>

        </div>
      </div>

      <!-- Backup -->
      <div class="section-card settings-pane" data-pane="backup" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.backup'))}</span>
        </div>
        <div class="section-card-body">

          <div class="alert alert-info" style="margin-bottom:14px;">
            <span>ℹ</span>
            <span>${esc(t('settings.backup.info'))}</span>
          </div>

          <div id="backup-status" style="margin-bottom:14px;"></div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">${esc(t('settings.backup.frequency'))}</label>
              <select class="form-control" id="backup-frequency">
                <option value="never">${esc(t('settings.backup.freq.never'))}</option>
                <option value="daily">${esc(t('settings.backup.freq.daily'))}</option>
                <option value="weekly">${esc(t('settings.backup.freq.weekly'))}</option>
                <option value="monthly">${esc(t('settings.backup.freq.monthly'))}</option>
              </select>
              <span class="form-hint">${esc(t('settings.backup.freq_hint'))}</span>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:8px;">
            <button type="button" class="btn btn-primary" id="backup-download-btn">
              📥 ${esc(t('settings.backup.download'))}
            </button>
            <label class="btn btn-warning" style="cursor:pointer;background:#f59e0b;color:#fff;border:none;">
              📂 ${esc(t('settings.backup.restore'))}
              <input type="file" id="backup-restore-input" accept=".json" class="file-input-hidden">
            </label>
            <button type="button" class="btn btn-secondary" id="backup-save-freq-btn">
              💾 ${esc(t('settings.backup.save_freq'))}
            </button>
          </div>

          <div style="margin-top:18px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:0.82rem;">
            <strong>💡 ${esc(t('settings.backup.tip_title'))}</strong><br>
            ${esc(t('settings.backup.tip_body'))}
          </div>
        </div>
      </div>

      <div class="section-card settings-pane" data-pane="global">
        <div class="section-card-header">
          <span class="section-card-title">${esc(t('settings.section.global'))}</span>
        </div>
        <div class="section-card-body">
          <form id="settings-form" novalidate>

            <!-- Exchange & Fuel -->
            <div class="settings-section">
              <div class="settings-section-title">Exchange &amp; Fuel</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="exchangeRate">
                    USD / LBP Exchange Rate <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <span class="input-addon input-addon-left">1 $ =</span>
                    <input class="form-control" id="exchangeRate" name="exchangeRate"
                      type="number" min="1" step="100"
                      value="${settings.exchangeRate}">
                    <span class="input-addon input-addon-right">ل.ل</span>
                  </div>
                  <span class="form-hint">Current rate: 1 USD = ${settings.exchangeRate.toLocaleString()} LBP</span>
                </div>
                <div class="form-group">
                  <label class="form-label">Fuel Price Input Mode</label>
                  <div class="radio-group">
                    <input type="radio" name="fuelInputMode" id="fuelModeLitre" value="litre" checked>
                    <label for="fuelModeLitre">Per Litre</label>
                    <input type="radio" name="fuelInputMode" id="fuelModeTank" value="tank">
                    <label for="fuelModeTank">Per Tank (20L)</label>
                  </div>
                </div>
                <!-- Per Litre input -->
                <div class="form-group" id="fuel-litre-group">
                  <label class="form-label" for="fuelPricePerLitre">
                    Fuel Price per Litre <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <input class="form-control" id="fuelPricePerLitre" name="fuelPricePerLitre"
                      type="number" min="0" step="0.01"
                      value="${settings.fuelPricePerLitre}">
                    <span class="input-addon input-addon-right" id="fuel-currency-label">
                      ${settings.fuelPriceCurrency}
                    </span>
                  </div>
                </div>
                <!-- Per Tank input -->
                <div class="form-group" id="fuel-tank-group" style="display:none;">
                  <label class="form-label" for="fuelPricePerTank">
                    Fuel Price per Tank (20L) <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <input class="form-control" id="fuelPricePerTank" name="fuelPricePerTank"
                      type="number" min="0" step="0.5" value="">
                    <span class="input-addon input-addon-right" id="fuel-currency-label-tank">
                      ${settings.fuelPriceCurrency}
                    </span>
                  </div>
                  <span class="form-hint" id="fuel-per-litre-computed">Enter tank price to see per-litre equivalent</span>
                </div>
                <div class="form-group">
                  <label class="form-label">Fuel Price Currency</label>
                  <div class="radio-group">
                    <input type="radio" name="fuelPriceCurrency" id="fuelCurrencyUSD" value="USD"
                      ${settings.fuelPriceCurrency === 'USD' ? 'checked' : ''}>
                    <label for="fuelCurrencyUSD">USD ($)</label>
                    <input type="radio" name="fuelPriceCurrency" id="fuelCurrencyLBP" value="LBP"
                      ${settings.fuelPriceCurrency === 'LBP' ? 'checked' : ''}>
                    <label for="fuelCurrencyLBP">LBP (ل.ل)</label>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="workingDaysPerMonth">
                    Working Days / Month <span class="required">*</span>
                  </label>
                  <input class="form-control" id="workingDaysPerMonth" name="workingDaysPerMonth"
                    type="number" min="1" max="31"
                    value="${settings.workingDaysPerMonth}">
                </div>
              </div>
            </div>

            <!-- Transport -->
            <div class="settings-section">
              <div class="settings-section-title">Transportation</div>
              <div class="alert alert-info">
                <span>ℹ</span>
                <span>
                  Formula: <strong>(km ÷ kmPerLitre) × fuel price × 2</strong> (round trip per day).
                  Employees ≤ 20 km receive the minimum flat rate. Minimum also applies as floor for longer distances.
                </span>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="minimumTransportUSD">
                    Minimum Transport/Day (USD) <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <span class="input-addon input-addon-left">$</span>
                    <input class="form-control" id="minimumTransportUSD" name="minimumTransportUSD"
                      type="number" min="0" step="0.5"
                      value="${settings.minimumTransportUSD}">
                  </div>
                  <span class="form-hint">Employees ≤ 20 km always get this flat daily rate</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="kmPerLitre">
                    Car Consumption (km/L) <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <input class="form-control" id="kmPerLitre" name="kmPerLitre"
                      type="number" min="0.1" step="0.1"
                      value="${settings.kmPerLitre ?? 7.5}">
                    <span class="input-addon input-addon-right">km/L</span>
                  </div>
                  <span class="form-hint">Default 7.5 km/L (150 km per 20L tank)</span>
                </div>
              </div>
            </div>

            <!-- Tax Rates -->
            <div class="settings-section">
              <div class="settings-section-title">Tax Rates (% of Base Salary)</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="taxTeacher">Teacher Tax Rate</label>
                  <div class="input-group">
                    <input class="form-control" id="taxTeacher" type="number"
                      min="0" max="100" step="0.1"
                      value="${settings.taxRates.Teacher}">
                    <span class="input-addon input-addon-right">%</span>
                  </div>
                  <span class="form-hint">Deducted from teacher base salary</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="taxAdmin">Administrator Tax Rate</label>
                  <div class="input-group">
                    <input class="form-control" id="taxAdmin" type="number"
                      min="0" max="100" step="0.1"
                      value="${settings.taxRates.Admin}">
                    <span class="input-addon input-addon-right">%</span>
                  </div>
                  <span class="form-hint">Deducted from admin base salary</span>
                </div>
              </div>
            </div>

            <!-- NFS Rates -->
            <div class="settings-section">
              <div class="settings-section-title">NFS / NSSF Rates (% of Base Salary)</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="nfsTeacher">Teacher NFS Rate</label>
                  <div class="input-group">
                    <input class="form-control" id="nfsTeacher" type="number"
                      min="0" max="100" step="0.1"
                      value="${settings.nfsRates.Teacher}">
                    <span class="input-addon input-addon-right">%</span>
                  </div>
                  <span class="form-hint">National Social Security Fund — teachers</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="nfsAdmin">Administrator NFS Rate</label>
                  <div class="input-group">
                    <input class="form-control" id="nfsAdmin" type="number"
                      min="0" max="100" step="0.1"
                      value="${settings.nfsRates.Admin}">
                    <span class="input-addon input-addon-right">%</span>
                  </div>
                  <span class="form-hint">National Social Security Fund — admins</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex; gap:10px; padding-top:8px;">
              <button type="submit" class="btn btn-primary btn-lg">
                💾 Save Settings
              </button>
              <button type="button" id="reset-settings-btn" class="btn btn-secondary btn-lg">
                ↺ Reset to Defaults
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  `;

  // ── Company Profile logic ────────────────────────────────
  const logoUrlInput  = document.getElementById('company-logo-url');
  const logoFileInput = document.getElementById('company-logo-file');
  const logoPreview   = document.getElementById('logo-preview');

  function setPreview(src) {
    logoPreview.textContent = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      logoPreview.appendChild(img);
    } else {
      logoPreview.textContent = '💼';
    }
  }

  logoUrlInput.addEventListener('input', () => setPreview(logoUrlInput.value.trim()));

  logoFileInput.addEventListener('change', () => {
    const file = logoFileInput.files[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      showToast('Image is too large (max 300 KB). Please resize it first.', 'warning');
      logoFileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      logoUrlInput.value = e.target.result;
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const btn      = document.getElementById('save-profile-btn');
    const name     = document.getElementById('company-name-field').value.trim();
    const logoUrl  = logoUrlInput.value.trim();

    if (!name) {
      showToast('Company name cannot be empty.', 'warning');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
      await updateCompanyMetadata({ name, logoUrl });
      // Update sidebar instantly
      document.getElementById('sidebar-company-name').textContent = name;
      _applySidebarLogo(logoUrl);
      showToast('Company profile saved!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to save profile. Try again.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '💾 Save Company Profile';
    }
  });

  // ── Display / Color settings ─────────────────────────────
  const THEMES = [
    { label: 'Default',  sidebarBg: '#0f172a', sidebarActive: '#1e3a8a', headerBg: '#ffffff', pageBg: '#f1f5f9' },
    { label: 'Slate',    sidebarBg: '#1e293b', sidebarActive: '#334155', headerBg: '#f8fafc', pageBg: '#f1f5f9' },
    { label: 'Blue',     sidebarBg: '#1e40af', sidebarActive: '#3b82f6', headerBg: '#eff6ff', pageBg: '#e8f0fe' },
    { label: 'Green',    sidebarBg: '#14532d', sidebarActive: '#16a34a', headerBg: '#f0fdf4', pageBg: '#dcfce7' },
    { label: 'Purple',   sidebarBg: '#4c1d95', sidebarActive: '#7c3aed', headerBg: '#faf5ff', pageBg: '#f3e8ff' },
    { label: 'Teal',     sidebarBg: '#134e4a', sidebarActive: '#0d9488', headerBg: '#f0fdfa', pageBg: '#ccfbf1' },
    { label: 'Rose',     sidebarBg: '#881337', sidebarActive: '#e11d48', headerBg: '#fff1f2', pageBg: '#ffe4e6' },
    { label: 'Midnight', sidebarBg: '#020617', sidebarActive: '#0f172a', headerBg: '#0f172a', pageBg: '#1e293b' },
  ];

  const displayColors = meta.displayColors || {};
  const currentColors = {
    sidebarBg:     displayColors.sidebarBg     || '#0f172a',
    sidebarActive: displayColors.sidebarActive || '#1e3a8a',
    headerBg:      displayColors.headerBg      || '#ffffff',
    pageBg:        displayColors.pageBg        || '#f1f5f9',
  };

  // Render theme preset buttons
  const presetsEl = document.getElementById('theme-presets');
  THEMES.forEach(t => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.title     = t.label;
    btn.innerHTML = `
      <div style="display:flex;gap:3px;margin-bottom:4px;">
        <div style="width:16px;height:28px;border-radius:3px 0 0 3px;background:${t.sidebarBg};"></div>
        <div style="width:28px;height:28px;background:${t.headerBg};border:1px solid #e2e8f0;"></div>
        <div style="width:20px;height:28px;border-radius:0 3px 3px 0;background:${t.pageBg};border:1px solid #e2e8f0;"></div>
      </div>
      <div style="font-size:0.7rem;color:#64748b;text-align:center;">${t.label}</div>
    `;
    btn.style.cssText = 'background:none;border:2px solid #e2e8f0;border-radius:8px;padding:6px 8px;cursor:pointer;transition:border-color 0.15s;';
    btn.addEventListener('mouseenter', () => btn.style.borderColor = '#2563eb');
    btn.addEventListener('mouseleave', () => btn.style.borderColor = '#e2e8f0');
    btn.addEventListener('click', () => {
      setPickerValues({ sidebarBg: t.sidebarBg, sidebarActive: t.sidebarActive, headerBg: t.headerBg, pageBg: t.pageBg });
      applyDisplayColors({ sidebarBg: t.sidebarBg, sidebarActive: t.sidebarActive, headerBg: t.headerBg, pageBg: t.pageBg });
    });
    presetsEl.appendChild(btn);
  });

  function setPickerValues(c) {
    document.getElementById('color-sidebar').value        = c.sidebarBg;
    document.getElementById('color-sidebar-active').value = c.sidebarActive;
    document.getElementById('color-header').value         = c.headerBg;
    document.getElementById('color-page-bg').value        = c.pageBg;
    document.getElementById('color-sidebar-hex').textContent        = c.sidebarBg;
    document.getElementById('color-sidebar-active-hex').textContent = c.sidebarActive;
    document.getElementById('color-header-hex').textContent         = c.headerBg;
    document.getElementById('color-page-bg-hex').textContent        = c.pageBg;
  }

  // Init pickers with current colors
  setPickerValues(currentColors);

  // Live preview on change
  ['color-sidebar', 'color-sidebar-active', 'color-header', 'color-page-bg'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      document.getElementById(id + '-hex').textContent = e.target.value;
      applyDisplayColors(getPickerValues());
    });
  });

  function getPickerValues() {
    return {
      sidebarBg:     document.getElementById('color-sidebar').value,
      sidebarActive: document.getElementById('color-sidebar-active').value,
      headerBg:      document.getElementById('color-header').value,
      pageBg:        document.getElementById('color-page-bg').value,
    };
  }

  document.getElementById('save-display-btn').addEventListener('click', async () => {
    const btn    = document.getElementById('save-display-btn');
    const colors = getPickerValues();
    btn.disabled    = true;
    btn.textContent = 'Saving…';
    try {
      await updateCompanyMetadata({ displayColors: colors });
      showToast('Colors saved!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to save colors.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '💾 Save Colors';
    }
  });

  document.getElementById('reset-display-btn').addEventListener('click', async () => {
    const defaults = { sidebarBg: '#0f172a', sidebarActive: '#1e3a8a', headerBg: '#ffffff', pageBg: '#f1f5f9' };
    setPickerValues(defaults);
    applyDisplayColors(defaults);
    try {
      await updateCompanyMetadata({ displayColors: defaults });
      showToast('Colors reset to default.', 'info');
    } catch (e) {
      console.error(e);
    }
  });

  // ── Tabs ───────────────────────────────────────────────
  initSettingsTabs();

  // ── Language picker ─────────────────────────────────────
  initLanguagePicker();

  // ── School Calendar ─────────────────────────────────────
  initCalendarSection();

  // ── Academic Year & Roles ──────────────────────────────
  initAcademicYearSection();
  initRolesSection();

  // ── Backup ─────────────────────────────────────────────
  initBackupSection(meta);

  // ── Quick Links manager ────────────────────────────────
  initQuickLinksSection(meta);

  // Convert fuel price value when switching currency (USD ↔ LBP)
  container.querySelectorAll('[name="fuelPriceCurrency"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const newCurrency = radio.value;
      const rate        = parseFloat(document.getElementById('exchangeRate').value) || 89600;
      const mode        = document.querySelector('[name="fuelInputMode"]:checked')?.value || 'litre';

      if (mode === 'litre') {
        const input = document.getElementById('fuelPricePerLitre');
        const val   = parseFloat(input.value);
        if (!isNaN(val)) {
          input.value = newCurrency === 'LBP'
            ? (val * rate).toFixed(0)
            : (val / rate).toFixed(4);
        }
      } else {
        const input = document.getElementById('fuelPricePerTank');
        const val   = parseFloat(input.value);
        if (!isNaN(val)) {
          input.value = newCurrency === 'LBP'
            ? (val * rate).toFixed(0)
            : (val / rate).toFixed(2);
        }
      }

      document.getElementById('fuel-currency-label').textContent      = newCurrency;
      document.getElementById('fuel-currency-label-tank').textContent = newCurrency;
      updateTankHint();
    });
  });

  // Fuel input mode toggle (per litre / per tank)
  const fuelLitreGroup = document.getElementById('fuel-litre-group');
  const fuelTankGroup  = document.getElementById('fuel-tank-group');

  function updateTankHint() {
    const tankVal  = parseFloat(document.getElementById('fuelPricePerTank').value);
    const currency = document.querySelector('[name="fuelPriceCurrency"]:checked')?.value || 'USD';
    const hint     = document.getElementById('fuel-per-litre-computed');
    if (!isNaN(tankVal) && tankVal >= 0) {
      hint.textContent = `= ${(tankVal / 20).toFixed(4)} ${currency} per litre`;
    } else {
      hint.textContent = 'Enter tank price to see per-litre equivalent';
    }
  }

  container.querySelectorAll('[name="fuelInputMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTank = radio.value === 'tank';
      fuelLitreGroup.style.display = isTank ? 'none' : '';
      fuelTankGroup.style.display  = isTank ? ''     : 'none';
      if (isTank) {
        const litre = parseFloat(document.getElementById('fuelPricePerLitre').value) || 0;
        document.getElementById('fuelPricePerTank').value = (litre * 20).toFixed(2);
        updateTankHint();
      }
    });
  });

  document.getElementById('fuelPricePerTank').addEventListener('input', updateTankHint);

  // Save
  document.getElementById('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    handleSave(container);
  });

  // Reset to defaults
  document.getElementById('reset-settings-btn').addEventListener('click', () => {
    openModal(
      'Reset to Defaults',
      '<p style="color:var(--color-text-secondary)">This will reset all settings to default values. Your employee data will not be affected.</p>',
      {
        confirmLabel: 'Reset',
        danger: true,
        onConfirm: () => {
          resetSettings();
          closeModal();
          showToast('Settings reset to defaults.', 'info');
          render(selector);
        }
      }
    );
  });
}

export function applyDisplayColors(colors) {
  if (!colors) return;
  const r = document.documentElement.style;
  if (colors.sidebarBg)     r.setProperty('--color-sidebar-bg',        colors.sidebarBg);
  if (colors.sidebarActive) r.setProperty('--color-sidebar-active-bg', colors.sidebarActive);
  if (colors.headerBg)      r.setProperty('--color-header-bg',         colors.headerBg);
  if (colors.pageBg)        r.setProperty('--color-bg',                colors.pageBg);
}

export function _applySidebarLogo(logoUrl) {
  const el = document.getElementById('sidebar-logo-icon');
  if (!el) return;
  if (logoUrl) {
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = 'Logo';
    img.style.cssText = 'width:36px;height:36px;object-fit:contain;border-radius:6px;';
    el.textContent = '';
    el.appendChild(img);
  } else {
    el.textContent = '💼';
  }
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleSave(container) {
  const form = document.getElementById('settings-form');

  const fuelMode    = form.querySelector('[name="fuelInputMode"]:checked')?.value || 'litre';
  const fuelPerLitre = fuelMode === 'tank'
    ? (parseFloat(form.querySelector('#fuelPricePerTank').value) || 0) / 20
    : form.querySelector('#fuelPricePerLitre').value;

  const rawData = {
    exchangeRate:        form.querySelector('#exchangeRate').value,
    fuelPricePerLitre:   fuelPerLitre,
    fuelPriceCurrency:   form.querySelector('[name="fuelPriceCurrency"]:checked')?.value || 'USD',
    workingDaysPerMonth: form.querySelector('#workingDaysPerMonth').value,
    kmPerLitre:          form.querySelector('#kmPerLitre').value,
    taxRates: {
      Teacher: form.querySelector('#taxTeacher').value,
      Admin:   form.querySelector('#taxAdmin').value
    },
    nfsRates: {
      Teacher: form.querySelector('#nfsTeacher').value,
      Admin:   form.querySelector('#nfsAdmin').value
    },
    minimumTransportUSD: form.querySelector('#minimumTransportUSD').value
  };

  // Clear previous errors
  form.querySelectorAll('.form-error').forEach(el => el.remove());
  form.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));

  const errors = validateSettings(rawData);
  if (errors.length) {
    const errBox = document.createElement('div');
    errBox.className = 'alert alert-warning';
    errBox.innerHTML = `<span>⚠</span><ul style="margin:0;padding-left:16px">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    form.prepend(errBox);
    errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  saveSettings(normalizeSettings(rawData));
  showToast('Settings saved successfully!', 'success');

  // Re-render hint with new rate
  const settings = denormalizeSettings(getSettings());
  const hint = form.querySelector('#exchangeRate').closest('.form-group').querySelector('.form-hint');
  if (hint) hint.textContent = `Current rate: 1 USD = ${settings.exchangeRate.toLocaleString()} LBP`;
}

// ── Backup section logic ───────────────────────────────────
function initBackupSection(meta) {
  const FREQUENCY_DAYS = { daily: 1, weekly: 7, monthly: 30, never: null };

  const freqSelect = document.getElementById('backup-frequency');
  const dlBtn      = document.getElementById('backup-download-btn');
  const saveBtn    = document.getElementById('backup-save-freq-btn');

  if (!freqSelect || !dlBtn || !saveBtn) return;

  // Initialize from current company metadata
  let currentSchedule = meta?.backupSchedule || 'never';
  freqSelect.value = currentSchedule;

  function refreshStatus() {
    const wrap = document.getElementById('backup-status');
    if (!wrap) return;

    // Re-fetch latest from cache (set after a backup)
    const lastBackup = meta?.lastBackupAt;

    if (!lastBackup) {
      wrap.innerHTML = `
        <div style="padding:10px 12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:0.85rem;color:#92400e;">
          ⚠️ ${esc(t('settings.backup.never_taken'))}
        </div>
      `;
      return;
    }

    const ageMs   = Date.now() - lastBackup;
    const days    = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const hours   = Math.floor(ageMs / (1000 * 60 * 60));
    const minutes = Math.floor(ageMs / (1000 * 60));
    const dueDays = FREQUENCY_DAYS[currentSchedule];
    const isOverdue = dueDays !== null && days >= dueDays;

    // Exact timestamp with date + time + seconds (locale-aware)
    const exactDate = new Date(lastBackup).toLocaleString(undefined, {
      year:   'numeric',
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Friendly relative ago text
    const ago = days > 0    ? `${days} day${days !== 1 ? 's' : ''} ago`
              : hours > 0   ? `${hours} hour${hours !== 1 ? 's' : ''} ago`
              : minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
              : 'just now';

    if (isOverdue) {
      wrap.innerHTML = `
        <div style="padding:10px 12px;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;font-size:0.85rem;color:#991b1b;">
          🔴 <strong>Last backup OVERDUE</strong><br>
          🕐 ${esc(exactDate)} <span style="opacity:0.7;">(${esc(ago)})</span>
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <div style="padding:10px 12px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;font-size:0.85rem;color:#166534;">
          ✅ <strong>Last backup up to date</strong><br>
          🕐 ${esc(exactDate)} <span style="opacity:0.7;">(${esc(ago)})</span>
        </div>
      `;
    }
  }

  // Save the chosen frequency
  saveBtn.addEventListener('click', async () => {
    const newSchedule = freqSelect.value;
    saveBtn.disabled = true;
    saveBtn.textContent = '...';
    try {
      await setCompanyBackupSchedule(newSchedule);
      currentSchedule = newSchedule;
      meta = { ...meta, backupSchedule: newSchedule };
      showToast(t('settings.backup.freq_saved'), 'success');
      refreshStatus();
    } catch (e) {
      console.error(e);
      showToast(t('settings.backup.save_failed'), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 ' + t('settings.backup.save_freq');
    }
  });

  // Download backup
  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    const originalText = dlBtn.textContent;
    dlBtn.textContent = '...';
    try {
      const data = buildCompanyBackup();
      const filename = `payroll-backup-${data.companyId || 'company'}-${new Date().toISOString().slice(0, 10)}.json`;
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Record in Firestore
      await recordBackupTaken();
      meta = { ...meta, lastBackupAt: Date.now() };
      showToast(t('settings.backup.downloaded'), 'success');
      refreshStatus();
    } catch (e) {
      console.error(e);
      showToast(t('settings.backup.download_failed'), 'error');
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = originalText;
    }
  });

  // Restore from backup file
  const restoreInput = document.getElementById('backup-restore-input');
  if (restoreInput) {
    restoreInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data || typeof data !== 'object') {
            showToast('Invalid backup file.', 'error');
            return;
          }
          // Sanity check — at least one of these should exist
          const hasData = data.employees || data.settings || data.calendar
            || data.academicYears || data.absenceRequests || data.roleRegistry;
          if (!hasData) {
            showToast('Not a valid payroll backup file.', 'error');
            return;
          }
          openRestoreOverlay(data);
        } catch (err) {
          console.error(err);
          showToast('Could not parse backup file. Make sure it is a valid JSON.', 'error');
        }
      };
      reader.onerror = () => showToast('Could not read file.', 'error');
      reader.readAsText(file);
      restoreInput.value = ''; // reset so picking the same file again works
    });
  }

  // Initial render
  refreshStatus();
}

// ── Quick Links manager (Company Profile section) ─────────
function initQuickLinksSection(meta) {
  const DEFAULT_LINKS = [
    { id: 'pronote',    label: 'Pronote',         url: 'https://2050048n.index-education.net/pronote/', icon: '📚' },
    { id: 'website',    label: 'School Website',  url: 'https://www.lycee-montaigne.edu.lb/',          icon: '🌐' },
    { id: 'outlook',    label: 'Outlook',         url: 'https://outlook.office365.com/',               icon: '📧' },
    { id: 'sharepoint', label: 'SharePoint',      url: 'https://sharepoint-explorer.web.app/',         icon: '📁' },
    { id: 'padlet',     label: 'Padlet',          url: 'https://padlet.com/michelinechaaban/bonne-rentree-2025-ipmmo5sypaxr4pl7', icon: '🎓' }
  ];

  let links = Array.isArray(meta?.quickLinks) && meta.quickLinks.length
    ? structuredClone(meta.quickLinks)
    : structuredClone(DEFAULT_LINKS);

  const listEl    = document.getElementById('quicklinks-list');
  const iconInput = document.getElementById('ql-add-icon');
  const labelInput= document.getElementById('ql-add-label');
  const urlInput  = document.getElementById('ql-add-url');
  const errEl     = document.getElementById('ql-add-error');
  const addBtn    = document.getElementById('ql-add-btn');
  const saveBtn   = document.getElementById('ql-save-btn');
  const defaultsBtn = document.getElementById('ql-defaults-btn');

  if (!listEl) return;

  function renderList() {
    if (!links.length) {
      listEl.innerHTML = `<div style="padding:14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;text-align:center;color:#94a3b8;font-size:0.85rem;">No quick links yet.</div>`;
      return;
    }
    listEl.innerHTML = links.map((link, i) => `
      <div style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:#f8fafc;border:1px solid var(--color-border);border-radius:8px;">
        <div style="font-size:1.4rem;flex-shrink:0;width:32px;text-align:center;">${esc(link.icon || '🔗')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${esc(link.label)}</div>
          <div style="font-size:0.72rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(link.url)}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button type="button" class="btn btn-secondary btn-sm" data-up="${i}"   ${i === 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button type="button" class="btn btn-secondary btn-sm" data-down="${i}" ${i === links.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button type="button" class="btn btn-danger btn-sm" data-del="${i}" title="Remove">🗑</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.up, 10);
      if (i > 0) [links[i - 1], links[i]] = [links[i], links[i - 1]];
      renderList();
    }));
    listEl.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.down, 10);
      if (i < links.length - 1) [links[i + 1], links[i]] = [links[i], links[i + 1]];
      renderList();
    }));
    listEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const i = parseInt(b.dataset.del, 10);
      links.splice(i, 1);
      renderList();
    }));
  }

  // Add new link
  addBtn.addEventListener('click', () => {
    const icon  = iconInput.value.trim() || '🔗';
    const label = labelInput.value.trim();
    const url   = urlInput.value.trim();
    errEl.textContent = '';
    if (!label) { errEl.textContent = 'Label is required.'; return; }
    if (!url || !/^https?:\/\//.test(url)) {
      errEl.textContent = 'URL must start with https:// or http://';
      return;
    }
    links.push({
      id:    label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now(),
      label, url, icon
    });
    iconInput.value = '';
    labelInput.value = '';
    urlInput.value = '';
    renderList();
  });

  // Save to Firestore
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = '...';
    try {
      await updateCompanyMetadata({ quickLinks: links });
      showToast('Quick links saved.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to save quick links.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Quick Links';
    }
  });

  // Restore defaults
  defaultsBtn.addEventListener('click', () => {
    if (!confirm('Replace current links with the default Lycée Montaigne set?')) return;
    links = structuredClone(DEFAULT_LINKS);
    renderList();
  });

  renderList();
}

// ── Settings tabs ──────────────────────────────────────────
function initSettingsTabs() {
  // Inject scoped styles once
  if (!document.getElementById('settings-tabs-styles')) {
    const style = document.createElement('style');
    style.id = 'settings-tabs-styles';
    style.textContent = `
      .settings-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
        transition: color 0.12s, border-color 0.12s, background 0.12s;
        border-radius: 6px 6px 0 0;
      }
      .settings-tab:hover {
        color: #1e293b;
        background: #f1f5f9;
      }
      .settings-tab.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        background: transparent;
      }
      .settings-pane { display: none; }
      .settings-pane.active { display: block; }
      @media (max-width: 768px) {
        .settings-tab { padding: 8px 10px; font-size: 0.82rem; }
        #settings-tabs { overflow-x: auto; flex-wrap: nowrap !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // Persist active tab in localStorage so the user lands back where they left
  const STORAGE_KEY = 'payroll-settings-tab';
  let activeTab = localStorage.getItem(STORAGE_KEY) || 'company';

  function setActive(tab) {
    activeTab = tab;
    localStorage.setItem(STORAGE_KEY, tab);
    document.querySelectorAll('.settings-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.settings-pane').forEach(p => {
      p.classList.toggle('active', p.dataset.pane === tab);
    });
  }

  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => setActive(btn.dataset.tab));
  });

  setActive(activeTab);
}

// ── Language picker ────────────────────────────────────────
function initLanguagePicker() {
  const wrap = document.getElementById('lang-picker');
  if (!wrap) return;
  const current = getLanguage();
  wrap.innerHTML = SUPPORTED_LANGUAGES.map(lang => `
    <button type="button" class="btn ${current === lang.code ? 'btn-primary' : 'btn-secondary'}"
      data-lang="${lang.code}" style="display:inline-flex;align-items:center;gap:6px;">
      <span>${lang.flag}</span><span>${lang.label}</span>
    </button>
  `).join('');
  wrap.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });
}

// ── Academic Year section logic ────────────────────────────
function initAcademicYearSection() {
  let years      = getAcademicYears();
  let currentId  = getCurrentAcademicYearId();
  let editingId  = currentId || years[0]?.yearId || null;
  // Working copy of the year being edited (separate from the in-memory cache)
  let edited     = editingId ? structuredClone(years.find(y => y.yearId === editingId)) : null;

  function refreshYearList() {
    years     = getAcademicYears();
    currentId = getCurrentAcademicYearId();
    if (!editingId || !years.some(y => y.yearId === editingId)) {
      editingId = currentId || years[0]?.yearId || null;
      edited    = editingId ? structuredClone(years.find(y => y.yearId === editingId)) : null;
    }
    renderYearSelect();
    renderYearDetails();
  }

  function renderYearSelect() {
    const sel = document.getElementById('ay-year-select');
    if (!years.length) {
      sel.innerHTML = `<option value="">— No academic year defined yet —</option>`;
      sel.value = '';
      return;
    }
    sel.innerHTML = years.map(y =>
      `<option value="${esc(y.yearId)}" ${y.yearId === editingId ? 'selected' : ''}>${esc(y.label || y.yearId)}${y.isCurrent ? ' ★ current' : ''}</option>`
    ).join('');
  }

  function renderYearDetails() {
    const wrap = document.getElementById('ay-details');
    if (!edited) {
      wrap.innerHTML = `
        <div class="alert alert-info">
          <span>ℹ</span>
          <span>No academic year yet. Click <strong>+ New year</strong> to create one (default: Sep 1 → Jun 30).</span>
        </div>
      `;
      return;
    }

    const roleRegistry = getRoleRegistry();

    wrap.innerHTML = `
      <div class="form-grid" style="margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">Year start</label>
          <input type="date" class="form-control" id="ay-start-date" value="${esc(edited.startDate || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Year end</label>
          <input type="date" class="form-control" id="ay-end-date" value="${esc(edited.endDate || '')}">
        </div>
      </div>

      <div style="font-weight:600;margin:12px 0 8px;">Active periods per role</div>
      <div id="ay-role-periods"></div>
    `;

    document.getElementById('ay-start-date').addEventListener('change', e => {
      edited.startDate = e.target.value;
    });
    document.getElementById('ay-end-date').addEventListener('change', e => {
      edited.endDate = e.target.value;
    });

    renderRolePeriods(roleRegistry);
  }

  function renderRolePeriods(roleRegistry) {
    const wrap = document.getElementById('ay-role-periods');
    edited.rolePeriods = edited.rolePeriods || {};

    wrap.innerHTML = roleRegistry.roles.map(role => {
      const periods = edited.rolePeriods[role.id] || [];
      const periodsHtml = periods.length
        ? periods.map((p, idx) => periodRowHTML(role.id, idx, p)).join('')
        : `<div style="padding:10px;color:var(--color-text-muted);font-size:0.85rem;">No active period — this role gets 0 working days. Click "+ Add period" to set one.</div>`;
      return `
        <div class="section-card" style="margin-bottom:10px;background:#f8fafc;">
          <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border);">
            <strong>${esc(role.name)}</strong>
            <button type="button" class="btn btn-secondary btn-sm" data-add-period="${esc(role.id)}">+ Add period</button>
          </div>
          <div style="padding:10px 14px;">
            ${periodsHtml}
          </div>
        </div>
      `;
    }).join('');

    // "Add period" buttons
    wrap.querySelectorAll('[data-add-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.addPeriod;
        edited.rolePeriods[roleId] = edited.rolePeriods[roleId] || [];
        edited.rolePeriods[roleId].push({
          from:     edited.startDate || '',
          to:       edited.endDate   || '',
          schedule: [1, 2, 3, 4, 5]
        });
        renderRolePeriods(roleRegistry);
      });
    });

    // Delete period buttons
    wrap.querySelectorAll('[data-del-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [roleId, idxStr] = btn.dataset.delPeriod.split('::');
        const idx = parseInt(idxStr, 10);
        if (edited.rolePeriods[roleId]) {
          edited.rolePeriods[roleId].splice(idx, 1);
          renderRolePeriods(roleRegistry);
        }
      });
    });

    // From/To/Schedule inputs
    wrap.querySelectorAll('[data-period-input]').forEach(input => {
      input.addEventListener('change', () => {
        const [roleId, idxStr, field] = input.dataset.periodInput.split('::');
        const idx = parseInt(idxStr, 10);
        const p = edited.rolePeriods[roleId]?.[idx];
        if (!p) return;
        if (field === 'from')  p.from = input.value;
        if (field === 'to')    p.to   = input.value;
      });
    });

    // Schedule day toggles
    wrap.querySelectorAll('[data-period-day]').forEach(cb => {
      cb.addEventListener('change', () => {
        const [roleId, idxStr, dowStr] = cb.dataset.periodDay.split('::');
        const idx = parseInt(idxStr, 10);
        const dow = parseInt(dowStr, 10);
        const p = edited.rolePeriods[roleId]?.[idx];
        if (!p) return;
        p.schedule = Array.isArray(p.schedule) ? p.schedule : [];
        if (cb.checked) {
          if (!p.schedule.includes(dow)) p.schedule = [...p.schedule, dow].sort((a, b) => a - b);
        } else {
          p.schedule = p.schedule.filter(d => d !== dow);
        }
        renderRolePeriods(roleRegistry);
      });
    });
  }

  function periodRowHTML(roleId, idx, p) {
    const orderedDows = [1, 2, 3, 4, 5, 6, 0];
    const dayChips = orderedDows.map(dow => `
      <label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
                    border:1.5px solid var(--color-border);border-radius:6px;font-size:0.75rem;
                    cursor:pointer;background:${(p.schedule || []).includes(dow) ? '#dbeafe' : '#fff'};
                    color:${(p.schedule || []).includes(dow) ? '#1e40af' : '#1e293b'};">
        <input type="checkbox" data-period-day="${esc(roleId)}::${idx}::${dow}"
          ${(p.schedule || []).includes(dow) ? 'checked' : ''}>
        ${DOW_LABELS[dow]}
      </label>
    `).join('');

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:8px 0;border-bottom:1px solid var(--color-border);">
        <div style="flex:0 0 145px;">
          <label class="form-label" style="font-size:0.75rem;">From</label>
          <input type="date" class="form-control" data-period-input="${esc(roleId)}::${idx}::from" value="${esc(p.from || '')}">
        </div>
        <div style="flex:0 0 145px;">
          <label class="form-label" style="font-size:0.75rem;">To</label>
          <input type="date" class="form-control" data-period-input="${esc(roleId)}::${idx}::to" value="${esc(p.to || '')}">
        </div>
        <div style="flex:1 1 240px;">
          <label class="form-label" style="font-size:0.75rem;">Schedule</label>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${dayChips}</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" data-del-period="${esc(roleId)}::${idx}" title="Remove this period">🗑</button>
      </div>
    `;
  }

  // Year selector change
  document.getElementById('ay-year-select').addEventListener('change', async e => {
    const yearId = e.target.value;
    if (!yearId) return;
    // Save current edits before switching
    if (edited && editingId) {
      try { await saveAcademicYear(edited); } catch (err) { console.error(err); }
    }
    editingId = yearId;
    edited    = structuredClone(getAcademicYears().find(y => y.yearId === yearId));
    renderYearDetails();
  });

  // New year button
  document.getElementById('ay-new-btn').addEventListener('click', () => {
    openYearCreatorModal(async (newYear) => {
      try {
        await saveAcademicYear(newYear);
        showToast(`Academic year ${newYear.yearId} created.`, 'success');
        editingId = newYear.yearId;
        edited    = structuredClone(newYear);
        refreshYearList();
      } catch (e) {
        console.error(e);
        showToast('Failed to create academic year.', 'error');
      }
    });
  });

  // Set as current
  document.getElementById('ay-set-current-btn').addEventListener('click', async () => {
    if (!editingId) return;
    try {
      await setCurrentAcademicYear(editingId);
      showToast('Set as current academic year.', 'success');
      refreshYearList();
    } catch (e) {
      console.error(e);
      showToast('Failed to set current year.', 'error');
    }
  });

  // Delete year
  document.getElementById('ay-delete-btn').addEventListener('click', () => {
    if (!editingId) return;
    openModal(
      'Delete Academic Year',
      `<p style="color:var(--color-text-secondary)">Delete academic year <strong>${esc(editingId)}</strong>? This cannot be undone.</p>`,
      {
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          try {
            await deleteAcademicYear(editingId);
            closeModal();
            showToast('Academic year deleted.', 'info');
            editingId = null;
            edited    = null;
            refreshYearList();
          } catch (e) {
            console.error(e);
            showToast('Failed to delete.', 'error');
          }
        }
      }
    );
  });

  // Auto-save edits when user clicks save calendar (existing button)
  // Add a "Save Year" button next to year details — simpler: save on each change
  // Actually let's add a save button at the bottom of the year details block
  document.addEventListener('click', async e => {
    if (e.target.id !== 'ay-save-btn') return;
    if (!edited || !editingId) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      // Validate periods
      const errors = [];
      for (const [roleId, periods] of Object.entries(edited.rolePeriods || {})) {
        for (const p of periods) {
          const errs = validatePeriod(p);
          if (errs.length) errors.push(`${roleId}: ${errs.join(' ')}`);
        }
      }
      if (errors.length) {
        showToast(errors[0], 'warning');
        btn.disabled = false;
        btn.textContent = '💾 Save Year';
        return;
      }
      await saveAcademicYear(edited);
      showToast('Academic year saved.', 'success');
      refreshYearList();
    } catch (err) {
      console.error(err);
      showToast('Failed to save.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Year';
    }
  });

  // Inject a save button below the year details
  const observer = new MutationObserver(() => {
    const wrap = document.getElementById('ay-details');
    if (wrap && !wrap.querySelector('#ay-save-btn')) {
      const btnDiv = document.createElement('div');
      btnDiv.style.cssText = 'margin-top:12px;display:flex;gap:10px;';
      btnDiv.innerHTML = `<button type="button" class="btn btn-primary" id="ay-save-btn">💾 Save Year</button>`;
      wrap.appendChild(btnDiv);
    }
  });
  observer.observe(document.getElementById('ay-details'), { childList: true, subtree: true });

  refreshYearList();
}

function openYearCreatorModal(onCreate) {
  const suggestion = suggestCurrentAcademicYear();
  openModal(
    'Create Academic Year',
    `
      <div class="form-group">
        <label class="form-label">Start date</label>
        <input type="date" class="form-control" id="ay-new-start" value="${suggestion.startDate}">
        <span class="form-hint">Default: September 1 of the school year</span>
      </div>
      <div class="form-group">
        <label class="form-label">End date</label>
        <input type="date" class="form-control" id="ay-new-end" value="${suggestion.endDate}">
        <span class="form-hint">Default: June 30 of the next year</span>
      </div>
      <div class="alert alert-info">
        <span>ℹ</span>
        <span>The year will be named automatically (e.g., <strong>${suggestion.yearId}</strong>) and start with default Mon–Fri active periods for built-in roles.</span>
      </div>
    `,
    {
      confirmLabel: 'Create',
      onConfirm: () => {
        const startDate = document.getElementById('ay-new-start').value;
        const endDate   = document.getElementById('ay-new-end').value;
        if (!startDate || !endDate || endDate < startDate) {
          showToast('Please choose valid start and end dates (end ≥ start).', 'warning');
          return;
        }
        const yearId = generateYearId(startDate);
        const year = makeAcademicYear({ yearId, startDate, endDate, isCurrent: false });
        // Initialize role periods using the start/end as the default active range
        for (const roleId of Object.keys(year.rolePeriods)) {
          year.rolePeriods[roleId] = [{ from: startDate, to: endDate, schedule: [1,2,3,4,5] }];
        }
        closeModal();
        onCreate(year);
      }
    }
  );
}

// ── Roles section logic ────────────────────────────────────
function initRolesSection() {
  function renderRoleTable() {
    const registry = getRoleRegistry();
    const tbody = document.getElementById('role-tbody');
    if (!registry.roles.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);">No roles defined.</td></tr>`;
      return;
    }
    tbody.innerHTML = registry.roles.map(r => `
      <tr>
        <td><strong>${esc(r.name)}</strong>${r.builtin ? ' <span class="badge" style="background:#f1f5f9;color:#64748b;font-size:0.65rem;">built-in</span>' : ''}</td>
        <td><span class="badge badge-${r.taxCategory === 'Teacher' ? 'teacher' : 'admin'}">${esc(r.taxCategory)}</span></td>
        <td>
          ${r.builtin ? '<span style="font-size:0.75rem;color:var(--color-text-muted);">—</span>'
                     : `<button class="btn btn-danger btn-sm" data-del-role="${esc(r.id)}">🗑</button>`}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-del-role]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delRole;
        if (!confirm(`Delete role "${id}"? Employees with this role will fall back to their tax category.`)) return;
        const reg = getRoleRegistry();
        reg.roles = reg.roles.filter(r => r.id !== id);
        try {
          await saveRoleRegistry(reg);
          showToast('Role deleted.', 'info');
          renderRoleTable();
        } catch (e) {
          console.error(e);
          showToast('Failed to delete role.', 'error');
        }
      });
    });
  }

  document.getElementById('role-add-btn').addEventListener('click', async () => {
    const name = document.getElementById('role-add-name').value.trim();
    const tax  = document.getElementById('role-add-tax').value;
    const errEl = document.getElementById('role-add-error');

    const reg = getRoleRegistry();
    const errors = validateRole({ name, taxCategory: tax }, reg.roles);
    if (errors.length) {
      errEl.textContent = errors.join(' ');
      return;
    }
    errEl.textContent = '';

    reg.roles.push({ id: name, name, taxCategory: tax, builtin: false });
    try {
      await saveRoleRegistry(reg);
      document.getElementById('role-add-name').value = '';
      showToast(`Role "${name}" added.`, 'success');
      renderRoleTable();
    } catch (e) {
      console.error(e);
      showToast('Failed to add role.', 'error');
    }
  });

  renderRoleTable();
}

/**
 * Expand "2025-12-23" to "2026-01-07" → array of every YYYY-MM-DD in between (inclusive).
 * Includes weekend dates — that's fine because the calendar separately filters weekends
 * during the working-day calculation. Holidays exist as data even when they fall on weekends
 * so the breakdown stays correct if the school later changes which days are weekends.
 */
function expandDateRange(fromIso, toIso) {
  const out = [];
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  let cursor = new Date(fy, fm - 1, fd);
  const end  = new Date(ty, tm - 1, td);
  while (cursor <= end) {
    const y  = cursor.getFullYear();
    const m  = String(cursor.getMonth() + 1).padStart(2, '0');
    const d  = String(cursor.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ── School Calendar section logic ──────────────────────────
function initCalendarSection() {
  // Working copy — only flushed to Firestore on Save
  let cal = getCalendar();

  // Year filter state — null means "all years"; array of year strings (e.g. ["2026","2027"]) means filtered.
  let yearFilter = null;

  function renderWeekendChecks() {
    const wrap = document.getElementById('cal-weekend-checks');
    wrap.innerHTML = DOW_LABELS_FULL.map((label, i) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;
                    padding:6px 12px;border:1.5px solid var(--color-border);border-radius:7px;
                    background:${cal.weekendDays.includes(i) ? '#dbeafe' : '#fff'};
                    color:${cal.weekendDays.includes(i) ? '#1e40af' : '#1e293b'};
                    font-weight:${cal.weekendDays.includes(i) ? '600' : '500'};">
        <input type="checkbox" data-dow="${i}" ${cal.weekendDays.includes(i) ? 'checked' : ''}>
        ${label}
      </label>
    `).join('');

    wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const dow = parseInt(cb.dataset.dow, 10);
        if (cb.checked) {
          if (!cal.weekendDays.includes(dow)) cal.weekendDays = [...cal.weekendDays, dow].sort((a,b) => a - b);
        } else {
          cal.weekendDays = cal.weekendDays.filter(d => d !== dow);
        }
        renderWeekendChecks();
      });
    });
  }

  function yearOf(iso) {
    return typeof iso === 'string' && iso.length >= 4 ? iso.slice(0, 4) : '';
  }

  // Distinct years present in the data — recomputed when needed.
  function getAvailableYears() {
    return [...new Set(cal.holidays.map(h => yearOf(h.date)).filter(Boolean))].sort();
  }

  function updateYearFilterLabel() {
    const labelEl = document.getElementById('cal-year-filter-label');
    if (!labelEl) return;
    const years = getAvailableYears();
    if (!yearFilter || !yearFilter.length) {
      labelEl.textContent = years.length ? `All years (${years.length})` : 'No years yet';
    } else if (yearFilter.length === 1) {
      labelEl.textContent = `Year ${yearFilter[0]}`;
    } else {
      labelEl.textContent = `${yearFilter.length} years`;
    }
  }

  // Build the dropdown menu HTML. ONLY called when the years list changes
  // (add/remove holiday) — never on filter toggles. This way clicks on
  // checkboxes don't get nuked by a rebuild during their own change handler.
  function renderYearFilterMenu() {
    const menu = document.getElementById('cal-year-filter-menu');
    if (!menu) return;
    const years = getAvailableYears();

    if (!years.length) {
      menu.innerHTML = `<div style="padding:8px;color:var(--color-text-muted);font-size:0.8rem;">No years yet — add a holiday first.</div>`;
      updateYearFilterLabel();
      return;
    }

    const allChecked = !yearFilter || !yearFilter.length;
    menu.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;
                    border-bottom:1px solid var(--color-border);font-weight:600;">
        <input type="checkbox" id="cal-year-filter-all" ${allChecked ? 'checked' : ''}>
        <span>All years</span>
      </label>
      ${years.map(y => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;font-size:0.85rem;">
          <input type="checkbox" data-year="${y}"
            ${(!yearFilter || yearFilter.length === 0 || yearFilter.includes(y)) ? 'checked' : ''}>
          <span>${y}</span>
        </label>
      `).join('')}
    `;

    // "All years" toggle
    menu.querySelector('#cal-year-filter-all').addEventListener('change', e => {
      yearFilter = e.target.checked ? null : [];
      updateYearFilterLabel();
      // Update sibling checkboxes in place (no menu rebuild)
      menu.querySelectorAll('[data-year]').forEach(cb => { cb.checked = e.target.checked; });
      renderHolidaysTableOnly();
    });

    // Per-year toggles
    menu.querySelectorAll('[data-year]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (!yearFilter) yearFilter = [...years];
        const y = cb.dataset.year;
        if (cb.checked && !yearFilter.includes(y)) yearFilter.push(y);
        else if (!cb.checked) yearFilter = yearFilter.filter(v => v !== y);
        if (yearFilter.length === years.length) yearFilter = null;
        // Update the "All years" checkbox in place
        const allCb = menu.querySelector('#cal-year-filter-all');
        if (allCb) allCb.checked = !yearFilter || !yearFilter.length;
        updateYearFilterLabel();
        renderHolidaysTableOnly();
      });
    });

    updateYearFilterLabel();
  }

  // Render JUST the table (no menu rebuild). Used by filter toggles.
  function renderHolidaysTableOnly() {
    const tbody = document.getElementById('cal-holidays-tbody');
    const allSorted = [...cal.holidays].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const sorted = (yearFilter && yearFilter.length)
      ? allSorted.filter(h => yearFilter.includes(yearOf(h.date)))
      : allSorted;

    document.getElementById('cal-holiday-count').textContent =
      `${sorted.length} day${sorted.length !== 1 ? 's' : ''}${yearFilter && yearFilter.length ? ` (filtered)` : ''}`;

    if (!sorted.length) {
      tbody.innerHTML = `
        <tr><td colspan="4">
          <div class="table-empty">
            <div class="table-empty-icon">📅</div>
            <p>${cal.holidays.length === 0
                ? 'No holidays added yet. Use "Pre-fill Lebanese holidays" or add them manually.'
                : 'No holidays match the selected year(s). Adjust the filter to see more.'}</p>
          </div>
        </td></tr>
      `;
      return;
    }

    const groups = groupConsecutiveByName(sorted);
    tbody.innerHTML = groups.map(g => {
      const isRange = g.dates.length > 1;
      const dateLabel = isRange
        ? `${g.dates[0]} <small style="color:var(--color-text-muted);">→</small> ${g.dates[g.dates.length - 1]}`
        : `<strong>${g.dates[0]}</strong>`;
      const dayBadge = isRange
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:0.7rem;font-weight:600;">${g.dates.length} days</span>`
        : '';
      const groupKey = `${g.dates[0]}::${g.dates[g.dates.length - 1]}::${g.name}`;
      return `
        <tr>
          <td>${dateLabel}${dayBadge}</td>
          <td>${esc(g.name)}</td>
          <td><span class="badge ${g.type === 'official' ? 'badge-teacher' : 'badge-admin'}">${esc(g.type || 'official')}</span></td>
          <td>
            <button class="btn btn-danger btn-sm" data-del-group="${esc(groupKey)}" title="${isRange ? `Delete all ${g.dates.length} days` : 'Delete'}">🗑</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-del-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [from, to, name] = btn.dataset.delGroup.split('::');
        cal.holidays = cal.holidays.filter(h =>
          !(h.name === name && h.date >= from && h.date <= to)
        );
        renderHolidaysTable(); // full re-render — years list may have changed
      });
    });
  }

  // Full re-render — used when the holidays list itself has changed
  // (add holiday, remove holiday, pre-fill). Rebuilds menu AND table.
  function renderHolidaysTable() {
    renderYearFilterMenu();
    renderHolidaysTableOnly();
  }

  function groupConsecutiveByName(sortedHolidays) {
    const groups = [];
    for (const h of sortedHolidays) {
      const last = groups[groups.length - 1];
      if (last
          && last.name === h.name
          && last.type === (h.type || 'official')
          && isNextDay(last.dates[last.dates.length - 1], h.date)) {
        last.dates.push(h.date);
      } else {
        groups.push({ name: h.name, type: h.type || 'official', dates: [h.date] });
      }
    }
    return groups;
  }

  function isNextDay(prevIso, nextIso) {
    const [py, pm, pd] = prevIso.split('-').map(Number);
    const prev = new Date(py, pm - 1, pd);
    prev.setDate(prev.getDate() + 1);
    const expected = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    return expected === nextIso;
  }

  // Add holiday / vacation period inline form
  document.getElementById('cal-add-btn').addEventListener('click', () => {
    const date    = document.getElementById('cal-add-date').value;
    const endDate = document.getElementById('cal-add-end-date').value;
    const name    = document.getElementById('cal-add-name').value.trim();
    const type    = document.getElementById('cal-add-type').value;
    const errEl   = document.getElementById('cal-add-error');

    // Validate "from" date and name (always required)
    const errors = validateHoliday({ date, name });
    if (errors.length) {
      errEl.textContent = errors.join(' ');
      return;
    }

    // If "To" date provided, validate it and expand into a range
    let datesToAdd = [date];
    if (endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        errEl.textContent = 'End date must be in YYYY-MM-DD format.';
        return;
      }
      if (endDate < date) {
        errEl.textContent = 'End date must be on or after the start date.';
        return;
      }
      datesToAdd = expandDateRange(date, endDate);
      // Cap at 60 days to prevent runaway adds
      if (datesToAdd.length > 60) {
        errEl.textContent = `Range too long (${datesToAdd.length} days). Please add in chunks of 60 days or less.`;
        return;
      }
    }

    // Filter out duplicates (same date already in calendar)
    const existingDates = new Set(cal.holidays.map(h => h.date));
    const newDates = datesToAdd.filter(d => !existingDates.has(d));
    const skipped  = datesToAdd.length - newDates.length;

    if (!newDates.length) {
      errEl.textContent = 'All days in this range are already in the calendar.';
      return;
    }

    errEl.textContent = '';
    for (const d of newDates) {
      cal.holidays.push({ date: d, name, type });
    }

    document.getElementById('cal-add-name').value = '';
    document.getElementById('cal-add-date').value = '';
    document.getElementById('cal-add-end-date').value = '';
    renderHolidaysTable();

    if (newDates.length > 1 || skipped > 0) {
      const parts = [`Added ${newDates.length} day${newDates.length !== 1 ? 's' : ''} for "${name}"`];
      if (skipped > 0) parts.push(`(${skipped} already existed)`);
      showToast(parts.join(' '), 'success');
    }
  });

  // Pre-fill Lebanese holidays — seeds CURRENT and NEXT year so school breaks
  // crossing into January (Christmas, New Year, Armenian Christmas) get the
  // right official labels even when the academic year spans two calendar years.
  document.getElementById('cal-prefill-btn').addEventListener('click', () => {
    const year     = new Date().getFullYear();
    const seeded   = [...seedLebaneseHolidays(year), ...seedLebaneseHolidays(year + 1)];

    const conflicts = seeded.filter(s => cal.holidays.some(h => h.date === s.date));
    const proceed = () => {
      const existingDates = new Set(cal.holidays.map(h => h.date));
      let added = 0;
      for (const h of seeded) {
        if (!existingDates.has(h.date)) {
          cal.holidays.push(h);
          added++;
        }
      }
      renderHolidaysTable();
      showToast(`Pre-filled ${added} Lebanese holiday${added !== 1 ? 's' : ''} for ${year} and ${year + 1}.`, 'success');
    };

    if (conflicts.length) {
      openModal(
        'Pre-fill Lebanese Holidays',
        `<p style="color:var(--color-text-secondary)">
          ${conflicts.length} of these dates already have holidays in your calendar.
          Existing entries will be kept; only missing ones will be added.
          Continue?
        </p>`,
        { confirmLabel: 'Add Missing', onConfirm: () => { closeModal(); proceed(); } }
      );
    } else {
      proceed();
    }
  });

  // Save calendar
  document.getElementById('cal-save-btn').addEventListener('click', async () => {
    if (!cal.weekendDays.length) {
      showToast('Select at least one weekend day, or none if your school works 7 days a week.', 'warning');
    }
    const btn = document.getElementById('cal-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await saveCalendar(cal);
      showToast('Calendar saved!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to save calendar.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Calendar';
    }
  });

  // Year-filter dropdown open/close
  const yearBtn  = document.getElementById('cal-year-filter-btn');
  const yearMenu = document.getElementById('cal-year-filter-menu');
  if (yearBtn && yearMenu) {
    yearBtn.addEventListener('click', e => {
      e.stopPropagation();
      yearMenu.style.display = yearMenu.style.display === 'block' ? 'none' : 'block';
    });
    // Stop ALL clicks inside the menu from bubbling — otherwise the document
    // "click outside" listener fires after the menu re-renders and sees a detached
    // node (the checkbox you just clicked), thinks you clicked outside, and closes.
    yearMenu.addEventListener('click', e => e.stopPropagation());
    // Close on outside click
    document.addEventListener('click', e => {
      if (!yearBtn.contains(e.target) && !yearMenu.contains(e.target)) {
        yearMenu.style.display = 'none';
      }
    });
  }

  renderWeekendChecks();
  renderHolidaysTable();
}
