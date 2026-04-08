import { getSettings, saveSettings, resetSettings } from '../data/store.js';
import { validateSettings, normalizeSettings, denormalizeSettings } from '../models/settings.js';
import { showToast } from './components/toast.js';
import { openModal, closeModal } from './components/modal.js';

export function render(selector) {
  const container = document.querySelector(selector);
  const settings  = denormalizeSettings(getSettings());

  container.innerHTML = `
    <div class="content-header">
      <div class="content-header-left">
        <h1>Settings</h1>
        <span class="content-header-subtitle">Configure rates, formulas and exchange values</span>
      </div>
    </div>
    <div class="page-body">
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
                  Formula: <strong>(km ÷ 7.5 L/100km) × fuel price × working days × 2</strong> (round trip).
                  Car average: 150 km / 20 L = 7.5 km per litre. Minimum applies if calculated is lower.
                </span>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="minimumTransportUSD">
                    Minimum Transport (USD) <span class="required">*</span>
                  </label>
                  <div class="input-group">
                    <span class="input-addon input-addon-left">$</span>
                    <input class="form-control" id="minimumTransportUSD" name="minimumTransportUSD"
                      type="number" min="0" step="0.5"
                      value="${settings.minimumTransportUSD}">
                  </div>
                  <span class="form-hint">Employees will receive at least this amount per month</span>
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

  // Sync fuel currency label on radio change
  container.querySelectorAll('[name="fuelPriceCurrency"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('fuel-currency-label').textContent = radio.value;
    });
  });

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

function handleSave(container) {
  const form = document.getElementById('settings-form');

  const rawData = {
    exchangeRate:        form.querySelector('#exchangeRate').value,
    fuelPricePerLitre:   form.querySelector('#fuelPricePerLitre').value,
    fuelPriceCurrency:   form.querySelector('[name="fuelPriceCurrency"]:checked')?.value || 'USD',
    workingDaysPerMonth: form.querySelector('#workingDaysPerMonth').value,
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
