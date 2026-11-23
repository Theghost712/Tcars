// Keep in sync with apps/common/constants.py on the backend.
export const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Kilimanjaro', 'Lindi',
  'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga',
  'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga', 'Zanzibar',
];

export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'other'];
export const TRANSMISSIONS = ['manual', 'automatic', 'cvt', 'other'];
export const BODY_TYPES = ['sedan', 'suv', 'hatchback', 'pickup', 'van', 'minibus', 'coupe', 'wagon', 'other'];
export const CONDITIONS = ['used', 'new', 'reconditioned'];
export const REPORT_REASONS = [
  ['misleading', 'Misleading information'],
  ['wrong_price', 'Wrong price'],
  ['fake_photos', 'Photos are not of this vehicle'],
  ['sold', 'Already sold'],
  ['scam', 'Suspected scam'],
  ['other', 'Other'],
] as const;
