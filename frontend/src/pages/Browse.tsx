import { SlidersHorizontal, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Dealer, Facets, Paginated, VehicleCard } from '../api/types';
import FilterPanel from '../components/FilterPanel';
import Pagination from '../components/Pagination';
import VehicleCardView from '../components/VehicleCard';
import { Alert, Button, EmptyState, PageTitle, Spinner, inputClass } from '../components/ui';
import { activeFilterCount, parseFilters, SORT_LABELS, toSearchParams, type Filters } from '../lib/filters';

const PAGE_SIZE = 12;

type BrowseProps = { dealerId?: number; hideTitle?: boolean };

export default function Browse({ dealerId, hideTitle = false }: BrowseProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => {
    const parsed = parseFilters(searchParams);
    if (dealerId) parsed.dealer = String(dealerId);
    return parsed;
  }, [searchParams, dealerId]);
  const [results, setResults] = useState<Paginated<VehicleCard> | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const queryKey = `${searchParams.toString()}|${dealerId ?? ''}`;

  useEffect(() => {
    endpoints.getFacets().then(setFacets).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (filters.dealer) {
      endpoints.getDealer(Number(filters.dealer)).then(setDealer).catch(() => setDealer(null));
    } else {
      setDealer(null);
    }
  }, [filters.dealer]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    endpoints
      .searchVehicles({ ...filters, page: filters.page })
      .then((data) => active && setResults(data))
      .catch((err) => active && setError(errorMessage(err, 'We could not load listings. Please try again.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // queryKey captures every filter in the URL, so this runs exactly when the search changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  function applyFilters(next: Filters) {
    setSearchParams(toSearchParams(next));
    setMobileFiltersOpen(false);
  }

  function changeSort(sort: string) {
    applyFilters({ ...filters, sort, page: '1' });
  }

  function changePage(page: number) {
    setSearchParams(toSearchParams({ ...filters, page: String(page) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const count = activeFilterCount(filters);

  return (
    <>
      {!hideTitle && <PageTitle
        title={dealer ? dealer.business_name : 'Cars for sale in Tanzania'}
        subtitle={
          dealer
            ? `Vehicles from this dealership${dealer.verification_status === 'verified' ? ' · verified' : ''}`
            : 'Search used cars, pick-ups, vans and more from private sellers and dealers.'
        }
        actions={
          <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFiltersOpen((open) => !open)} aria-expanded={mobileFiltersOpen}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{count ? ` (${count})` : ''}
          </Button>
        }
      />}

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-white p-5 lg:block lg:self-start lg:sticky lg:top-24`} aria-label="Filters">
          <FilterPanel filters={filters} facets={facets} onApply={applyFilters} />
        </aside>

        <section aria-live="polite" aria-busy={loading}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {results ? <><strong className="text-slate-900">{results.count.toLocaleString('en')}</strong> vehicle{results.count === 1 ? '' : 's'} found</> : 'Searching…'}
            </p>
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
              <span>Sort by</span>
              <select aria-label="Sort by" className={`${inputClass} mt-0 w-auto py-2`} value={filters.sort} onChange={(e) => changeSort(e.target.value)}>
                {Object.entries(SORT_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          {loading && !results && <Spinner label="Loading vehicles" />}

          {results && results.results.length === 0 && !loading && (
            <EmptyState title="No vehicles match these filters">
              <p>Try removing a filter or widening your price range.</p>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => applyFilters(parseFilters(new URLSearchParams()))}>
                  <SearchX className="h-4 w-4" aria-hidden="true" /> Clear all filters
                </Button>
              </div>
            </EmptyState>
          )}

          {results && results.results.length > 0 && (
            <div className={`grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
              {results.results.map((vehicle) => <VehicleCardView key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}

          {results && (
            <Pagination page={Number(filters.page) || 1} count={results.count} pageSize={PAGE_SIZE} onChange={changePage} />
          )}
        </section>
      </div>
    </>
  );
}
