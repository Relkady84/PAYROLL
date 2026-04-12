import { getSettings, saveSettings, resetSettings, getCompanyMetadata, updateCompanyMetadata } from '../data/store.js';
import { validateSettings, normalizeSettings, denormalizeSettings } from '../models/settings.js';
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
        <h1>Settings</h1>
        <span class="content-header-subtitle">Configure rates, formulas and exchange values</span>
      </div>
    </div>
    <div class="page-body">

      <!-- Company Profile -->
      <div class="section-card" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">Company Profile</span>
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
        </div>
      </div>

      <!-- Display Settings -->
      <div class="section-card" style="margin-bottom:20px;">
        <div class="section-card-header">
          <span class="section-card-title">Display &amp; Colors</span>
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

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">Global Configuration</span>
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
    logoPreview.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:contain;">`
      : '💼';
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
    el.innerHTML = `<img src="${logoUrl}" alt="Logo"
      style="width:36px;height:36px;object-fit:contain;border-radius:6px;">`;
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
