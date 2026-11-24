import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeFilterCount, parseFilters, toSearchParams } from './filters';

describe('search filters', () => {
  it('reads filters from the URL', () => {
    const filters = parseFilters(new URLSearchParams('make=Toyota&price_max=50000000&sort=price_asc'));
    expect(filters.make).toBe('Toyota');
    expect(filters.price_max).toBe('50000000');
    expect(filters.sort).toBe('price_asc');
    expect(filters.region).toBe('');
  });

  it('writes only meaningful values back to the URL', () => {
    const params = toSearchParams({ ...EMPTY_FILTERS, make: 'Suzuki', sort: 'newest', page: '1' });
    expect(params.toString()).toBe('make=Suzuki');
  });

  it('counts active filters, ignoring sort and page', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, sort: 'price_desc', page: '3', fuel_type: 'diesel' })).toBe(1);
  });
});
