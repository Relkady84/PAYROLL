export function validateSettings(data) {
  const errors = [];

  const rate = parseFloat(data.exchangeRate);
  if (isNaN(rate) || rate <= 0) errors.push('Exchange rate must be greater than 0.');

  const fuel = parseFloat(data.fuelPricePerLitre);
  if (isNaN(fuel) || fuel < 0) errors.push('Fuel price cannot be negative.');

  const days = parseInt(data.workingDaysPerMonth);
  if (isNaN(days) || days < 1 || days > 31) errors.push('Working days must be between 1 and 31.');

  for (const type of ['Teacher', 'Admin']) {
    const tax = parseFloat(data.taxRates?.[type]);
    if (isNaN(tax) || tax < 0 || tax > 100) {
      errors.push(`Tax rate for ${type} must be between 0 and 100.`);
    }
    const nfs = parseFloat(data.nfsRates?.[type]);
    if (isNaN(nfs) || nfs < 0 || nfs > 100) {
      errors.push(`NFS rate for ${type} must be between 0 and 100.`);
    }
  }

  const minTransport = parseFloat(data.minimumTransportUSD);
  if (isNaN(minTransport) || minTransport < 0) {
    errors.push('Minimum transport cannot be negative.');
  }

  return errors;
}

// Convert settings from UI (% as 0-100) to storage (0-1 decimal)
export function normalizeSettings(raw) {
  return {
    exchangeRate:        parseFloat(raw.exchangeRate),
    fuelPricePerLitre:   parseFloat(raw.fuelPricePerLitre),
    fuelPriceCurrency:   raw.fuelPriceCurrency || 'USD',
    workingDaysPerMonth: parseInt(raw.workingDaysPerMonth),
    taxRates: {
      Teacher: parseFloat(raw.taxRates?.Teacher) / 100,
      Admin:   parseFloat(raw.taxRates?.Admin)   / 100
    },
    nfsRates: {
      Teacher: parseFloat(raw.nfsRates?.Teacher) / 100,
      Admin:   parseFloat(raw.nfsRates?.Admin)   / 100
    },
    minimumTransportUSD: parseFloat(raw.minimumTransportUSD)
  };
}

// Convert stored settings (0-1 decimal) to UI display (%)
export function denormalizeSettings(s) {
  return {
    ...s,
    taxRates: {
      Teacher: (s.taxRates?.Teacher || 0) * 100,
      Admin:   (s.taxRates?.Admin   || 0) * 100
    },
    nfsRates: {
      Teacher: (s.nfsRates?.Teacher || 0) * 100,
      Admin:   (s.nfsRates?.Admin   || 0) * 100
    }
  };
}
