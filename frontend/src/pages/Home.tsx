import { ArrowRight, Search, ShieldCheck, Store, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { HomeFeed } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import VehicleCard from '../components/VehicleCard';
import { Alert, Button, EmptyState, Spinner, inputClass } from '../components/ui';
import { REGIONS } from '../lib/regions';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    endpoints.getHome().then(setFeed).catch((err) => setError(errorMessage(err)));
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (region) params.set('region', region);
    navigate(`/vehicles?${params.toString()}`);
  }

  return (
    <div className="space-y-12">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 px-6 py-12 text-white shadow-lg sm:px-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">Used cars, pick-ups and dealer stock</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Find your next vehicle in Tanzania, from Dar es Salaam to Arusha and beyond
        </h1>
        <form onSubmit={search} className="mt-8 grid gap-3 rounded-xl bg-white p-3 shadow-xl sm:grid-cols-[1fr_200px_auto]" role="search">
          <label className="sr-only" htmlFor="hero-q">Search vehicles</label>
          <div className="flex items-center gap-2 px-2">
            <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Make, model or keyword, e.g. Toyota Prado"
              className="w-full border-0 bg-transparent py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none" />
          </div>
          <label className="sr-only" htmlFor="hero-region">Region</label>
          <select id="hero-region" value={region} onChange={(e) => setRegion(e.target.value)} className={`${inputClass} mt-0`}>
            <option value="">All regions</option>
            {REGIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button type="submit" className="w-full sm:w-auto">Search</Button>
        </form>
        <div className="mt-6 flex flex-wrap gap-2">
          {feed?.body_types.filter((item) => item.count > 0).slice(0, 6).map((item) => (
            <Link key={item.value} to={`/vehicles?body_type=${item.value}`}
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm hover:bg-white/20">
              {item.label} <span className="text-white/70">({item.count})</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Why use the marketplace">
        {[
          { icon: ShieldCheck, title: 'Reviewed listings', text: 'Every advert is checked by our team before it goes live.' },
          { icon: Store, title: 'Verified dealers', text: 'Look for the verified badge on dealership stock and seller profiles.' },
          { icon: Users, title: 'Direct contact', text: 'Call, WhatsApp or send an enquiry straight to the seller.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      {error && <Alert tone="error">{error}</Alert>}
      {!feed && !error && <Spinner label="Loading listings" />}

      {feed && (
        <>
          {feed.featured.length > 0 && (
            <section aria-labelledby="featured-heading">
              <div className="mb-4 flex items-end justify-between">
                <h2 id="featured-heading" className="text-xl font-bold text-slate-900">Featured vehicles</h2>
                <Link to="/vehicles?sort=price_desc" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {feed.featured.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
              </div>
            </section>
          )}

          <section aria-labelledby="recent-heading">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="recent-heading" className="text-xl font-bold text-slate-900">Recently added</h2>
              <Link to="/vehicles" className="text-sm font-semibold text-brand-700 hover:underline">Browse all</Link>
            </div>
            {feed.recent.length === 0 ? (
              <EmptyState title="No vehicles are listed yet">Check back soon, or be the first to list a car.</EmptyState>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {feed.recent.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
              </div>
            )}
          </section>

          {feed.regions.length > 0 && (
            <section aria-labelledby="regions-heading">
              <h2 id="regions-heading" className="mb-4 text-xl font-bold text-slate-900">Browse by location</h2>
              <ul className="flex flex-wrap gap-2">
                {feed.regions.map((item) => (
                  <li key={item.region}>
                    <Link to={`/vehicles?region=${encodeURIComponent(item.region)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:border-brand-500 hover:text-brand-700">
                      {item.region} <span className="text-slate-500">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!(user && (user.role === 'seller' || user.role === 'dealer')) && (
        <section className="flex flex-col items-start gap-4 rounded-2xl bg-brand-50 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Selling a car or running a dealership?</h2>
            <p className="mt-1 text-sm text-slate-700">Create a free account, publish your adverts with photos, and manage enquiries from one dashboard.</p>
          </div>
          <Link to={user ? '/account' : '/register?role=seller'} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
            {user ? 'Switch to a seller account' : 'Start selling'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}
