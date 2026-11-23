import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Facets } from '../api/types';
import { BODY_TYPES, CONDITIONS, FUEL_TYPES, REGIONS, TRANSMISSIONS } from '../lib/regions';
import { label } from '../lib/format';
import { EMPTY_FILTERS, type Filters } from '../lib/filters';
import { Button, Field, inputClass } from './ui';

type Props = {
  filters: Filters;
  facets: Facets | null;
  onApply: (next: Filters) => void;
};

export default function FilterPanel({ filters, facets, onApply }: Props) {
  const [draft, setDraft] = useState<Filters>(filters);
  const serialised = JSON.stringify(filters);

  useEffect(() => {
    setDraft(filters);
    // Re-sync the draft only when the applied filters change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised]);

  const set = (key: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const selectClass = inputClass;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, page: '1' });
      }}
      aria-label="Filter vehicles"
    >
      <Field label="Keywords" htmlFor="f-q">
        <input id="f-q" className={inputClass} value={draft.q} onChange={set('q')} placeholder="e.g. Prado, diesel, Masaki" />
      </Field>

      <Field label="Make" htmlFor="f-make">
        <input id="f-make" className={inputClass} list="makes" value={draft.make} onChange={set('make')} placeholder="Any make" />
        <datalist id="makes">
          {facets?.makes.map((item) => <option key={item.make} value={item.make} />)}
        </datalist>
      </Field>

      <Field label="Model" htmlFor="f-model">
        <input id="f-model" className={inputClass} value={draft.model} onChange={set('model')} placeholder="Any model" />
      </Field>

      <Field label="Region" htmlFor="f-region">
        <select id="f-region" className={selectClass} value={draft.region} onChange={set('region')}>
          <option value="">All regions</option>
          {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
      </Field>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 text-sm font-medium text-slate-700">Price (TZS)</legend>
        <Field label="Minimum" htmlFor="f-price-min" className="col-span-1">
          <input id="f-price-min" type="number" min={0} step={500000} className={inputClass} value={draft.price_min} onChange={set('price_min')} placeholder="0" />
        </Field>
        <Field label="Maximum" htmlFor="f-price-max" className="col-span-1">
          <input id="f-price-max" type="number" min={0} step={500000} className={inputClass} value={draft.price_max} onChange={set('price_max')} placeholder="Any" />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 text-sm font-medium text-slate-700">Year</legend>
        <Field label="From" htmlFor="f-year-min">
          <input id="f-year-min" type="number" min={1950} max={2100} className={inputClass} value={draft.year_min} onChange={set('year_min')} placeholder={facets?.bounds.min_year?.toString() ?? '1950'} />
        </Field>
        <Field label="To" htmlFor="f-year-max">
          <input id="f-year-max" type="number" min={1950} max={2100} className={inputClass} value={draft.year_max} onChange={set('year_max')} placeholder={facets?.bounds.max_year?.toString() ?? ''} />
        </Field>
      </fieldset>

      <Field label="Maximum mileage (km)" htmlFor="f-mileage">
        <input id="f-mileage" type="number" min={0} step={5000} className={inputClass} value={draft.mileage_max} onChange={set('mileage_max')} placeholder="Any" />
      </Field>

      <Field label="Fuel type" htmlFor="f-fuel">
        <select id="f-fuel" className={selectClass} value={draft.fuel_type} onChange={set('fuel_type')}>
          <option value="">Any</option>
          {FUEL_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </Field>

      <Field label="Transmission" htmlFor="f-gear">
        <select id="f-gear" className={selectClass} value={draft.transmission} onChange={set('transmission')}>
          <option value="">Any</option>
          {TRANSMISSIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </Field>

      <Field label="Body type" htmlFor="f-body">
        <select id="f-body" className={selectClass} value={draft.body_type} onChange={set('body_type')}>
          <option value="">Any</option>
          {BODY_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </Field>

      <Field label="Condition" htmlFor="f-condition">
        <select id="f-condition" className={selectClass} value={draft.condition} onChange={set('condition')}>
          <option value="">Any</option>
          {CONDITIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </Field>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Apply filters
        </Button>
        <Button variant="secondary" onClick={() => onApply({ ...EMPTY_FILTERS })}>Clear</Button>
      </div>
    </form>
  );
}
