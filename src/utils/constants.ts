export const VALID_TYPE_TO_UPLOAD = [
  'image/jpeg',
  // 'image/png',
  // 'application/pdf',
];

// ─── Jurisdiction (O-S33-1 / O-S34-1) ────────────────────────────────────────
//
// THE CANONICAL CLIENT-SIDE TABLES. They mirror accounting/jurisdiction.py on
// the backend, which is the authority — these exist so the UI can render a
// dropdown, not so it can decide what is valid. The server re-validates every
// (country, region) pair and 400s anything it does not recognise.
//
// Before S34 this file held a 10-province list while Register.tsx held its own
// 13-province copy and the backend knew a third set. A registrant in Yukon,
// the Northwest Territories or Nunavut therefore submitted a value no backend
// table recognised. One table now, in one place.
//
// STRICT CA/US (O-S34-1): there is no 'OTHER' arm anywhere in this design. A
// jurisdiction we cannot seed a chart of accounts for is one we cannot keep
// books for, so it is refused at the door rather than accepted and quietly
// mistreated.

export type CountryCode = 'CA' | 'US';

export interface RegionOption {
  code: string;
  name: string;
}

export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
];

// All 13 — 10 provinces plus the three territories.
export const CA_PROVINCES: RegionOption[] = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

// 50 states plus the District of Columbia. US territories are deliberately
// absent — they are a separate tax question, same as a new country would be.
export const US_STATES: RegionOption[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export const REGIONS_BY_COUNTRY: Record<CountryCode, RegionOption[]> = {
  CA: CA_PROVINCES,
  US: US_STATES,
};

/**
 * DERIVED, not a second list. The Tier 1 profile and billing address forms
 * consume a {value,label} shape; deriving it here keeps one source of truth.
 *
 * NOTE: those two surfaces gain NT/NU/YT as a side effect, because the list
 * they shared was the 10-entry one. That is the same defect being fixed on the
 * registration side — a Yukon customer could not select their province — but
 * it IS a Tier 1 behaviour change, so it is called out rather than slipped in.
 */
export const PROVINCES_CANADA_LIST = CA_PROVINCES.map(
  ({ code, name }) => ({ value: code, label: name }),
);
