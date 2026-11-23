/** Search filters are kept in the URL so results can be shared, bookmarked and refreshed safely. */
export type Filters = {
  q: string;
  make: string;
  model: string;
  region: string;
  price_min: string;
  price_max: string;
  year_min: string;
  year_max: string;
  mileage_max: string;
  fuel_type: string;
  transmission: string;
  body_type: string;
  condition: string;
  dealer: string;
  sort: string;
  page: string;
};

export const EMPTY_FILTERS: Filters = {
  q: '',
  make: '',
  model: '',
  region: '',
  price_min: '',
  price_max: '',
  year_min: '',
  year_max: '',
  mileage_max: '',
  fuel_type: '',
  transmission: '',
  body_type: '',
  condition: '',
  dealer: '',
  sort: 'newest',
  page: '1',
};

export function parseFilters(params: URLSearchParams): Filters {
  const next = { ...EMPTY_FILTERS };
  (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).forEach((key) => {
    const value = params.get(key);
    if (value !== null) next[key] = value;
  });
  return next;
}

/** Only non-empty values are written to the URL. Changing any filter (except page) resets paging. */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(filters) as (keyof Filters)[]).forEach((key) => {
    const value = filters[key].trim();
    if (value && !(key === 'sort' && value === 'newest') && !(key === 'page' && value === '1')) {
      params.set(key, value);
    }
  });
  return params;
}

export function activeFilterCount(filters: Filters): number {
  const ignored: (keyof Filters)[] = ['sort', 'page'];
  return (Object.keys(filters) as (keyof Filters)[]).filter(
    (key) => !ignored.includes(key) && filters[key].trim() !== '',
  ).length;
}

export const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  year_desc: 'Year: newest model',
  mileage_asc: 'Mileage: lowest',
};
