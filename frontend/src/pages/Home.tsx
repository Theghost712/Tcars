import { ArrowRight, BadgeCheck, Gauge, Search, ShieldCheck, Store, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { HomeFeed } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import VehicleCard from '../components/VehicleCard';
import { Alert, EmptyState, Spinner, inputClass } from '../components/ui';
import { REGIONS } from '../lib/regions';

// The 3D viewer and its library are split into their own download, fetched only when the page renders.
const CarShowcase = lazy(() => import('../components/CarShowcase'));

function SectionHeader({ id, title, action }: { id: string; title: string; action?: { to: string; label: string } }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {action.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

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

  const isSeller = user?.role === 'seller' || user?.role === 'dealer';

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(16,185,129,0.25),transparent)]" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> Buy and sell vehicles across Tanzania
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Find your next car, <span className="text-emerald-400">verified and close to home.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              Reviewed listings from private sellers and verified dealerships. Compare prices, check photos, and reach the seller directly by phone or WhatsApp.
            </p>

            <form onSubmit={search} role="search" className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/30 sm:grid-cols-[1fr_180px_auto]">
              <label className="sr-only" htmlFor="hero-q">Search vehicles</label>
              <div className="flex items-center gap-2 px-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Make, model or keyword"
                  className="w-full border-0 bg-transparent py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none" />
              </div>
              <label className="sr-only" htmlFor="hero-region">Region</label>
              <select id="hero-region" value={region} onChange={(e) => setRegion(e.target.value)} className={`${inputClass} mt-0 border-0 bg-slate-50`}>
                <option value="">All regions</option>
                {REGIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button type="submit" className="rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500">Search</button>
            </form>

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {feed?.body_types.filter((item) => item.count > 0).slice(0, 5).map((item) => (
                <Link key={item.value} to={`/vehicles?body_type=${item.value}`}
                  className="rounded-full border border-white/15 px-3 py-1 text-slate-200 transition hover:border-white/40 hover:bg-white/10">
                  {item.label} <span className="text-slate-400">{item.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/80 shadow-2xl">
            <Suspense fallback={<Spinner label="Loading 3D preview" />}>
              <CarShowcase />
            </Suspense>
          </div>
        </div>

        {feed && (
          <div className="border-t border-white/10">
          <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-white/10 px-4 sm:px-6">
            {[
              { label: 'Live listings', value: feed.stats.live_listings },
              { label: 'Verified dealers', value: feed.stats.verified_dealers },
              { label: 'Regions covered', value: feed.stats.regions },
            ].map((stat) => (
              <div key={stat.label} className="py-6 pl-6 first:pl-0">
                <dt className="text-xs uppercase tracking-wider text-slate-400">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-bold sm:text-3xl">{stat.value.toLocaleString('en')}</dd>
              </div>
            ))}
          </dl>
          </div>
        )}
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
        {/* Why */}
        <section aria-label="Why use the marketplace" className="grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Reviewed before it goes live', text: 'Our team checks every listing for accuracy and photos before buyers can see it.' },
            { icon: BadgeCheck, title: 'Verified sellers and dealers', text: 'Look for the verified badge. Dealers and sellers verify with their licence or National ID.' },
            { icon: Users, title: 'Talk to the seller directly', text: 'Call, WhatsApp or send an enquiry straight from the listing. No middlemen.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        {error && <Alert tone="error">{error}</Alert>}
        {!feed && !error && <Spinner label="Loading listings" />}

        {feed && (
          <>
            {feed.featured.length > 0 && (
              <section aria-labelledby="featured-heading">
                <SectionHeader id="featured-heading" title="Featured vehicles" action={{ to: '/vehicles?sort=price_desc', label: 'See all' }} />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {feed.featured.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
                </div>
              </section>
            )}

            <section aria-labelledby="recent-heading">
              <SectionHeader id="recent-heading" title="Recently added" action={{ to: '/vehicles', label: 'Browse all' }} />
              {feed.recent.length === 0 ? (
                <EmptyState title="No vehicles are listed yet">Check back soon, or be the first to list a car.</EmptyState>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {feed.recent.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
                </div>
              )}
            </section>

            {feed.regions.length > 0 && (
              <section aria-labelledby="regions-heading">
                <SectionHeader id="regions-heading" title="Browse by location" />
                <ul className="flex flex-wrap gap-2.5">
                  {feed.regions.map((item) => (
                    <li key={item.region}>
                      <Link to={`/vehicles?region=${encodeURIComponent(item.region)}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700">
                        <Gauge className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {item.region} <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{item.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {!isSeller && (
          <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white sm:p-12">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <Store className="h-8 w-8 text-emerald-400" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-bold">Selling a car or running a dealership?</h2>
                <p className="mt-2 text-slate-300">Create a free account, publish with photos, and manage every enquiry from one dashboard.</p>
              </div>
              <Link to={user ? '/account' : '/register?role=seller'}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">
                {user ? 'Switch to a seller account' : 'Start selling free'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
