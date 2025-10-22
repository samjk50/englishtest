// Map UI region -> Stripe price + currency
export const REGIONS = {
  EU: { label: 'Europe (EUR)',         currencyCode: 'EUR', priceId: 'price_1SEvqoQ7GAc1v5HcLC2UhccR' },
  UK: { label: 'United Kingdom (GBP)', currencyCode: 'GBP', priceId: 'price_1SEvqoQ7GAc1v5HcjKmp3g0v' },
  US: { label: 'United States (USD)',  currencyCode: 'USD', priceId: 'price_1SEvl2Q7GAc1v5HcZjTfPVyA' },
};

export const REGION_LIST = Object.entries(REGIONS).map(([key, v]) => ({
  key, label: v.label, currencyCode: v.currencyCode,
}));

export const REGION_TO_PRICE = Object.fromEntries(
  Object.entries(REGIONS).map(([k, v]) => [k, v.priceId])
);

export const REGION_TO_CURRENCY = Object.fromEntries(
  Object.entries(REGIONS).map(([k, v]) => [k, v.currencyCode])
);
