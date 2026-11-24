import { BadgeCheck, Mail, MapPin, Phone, MessageCircle, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Dealer, Verification } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Alert, Button, Card, EmptyState, Field, PageTitle, Spinner, buttonClass, inputClass } from '../components/ui';
import { formatDate, label } from '../lib/format';
import { REGIONS } from '../lib/regions';
import Browse from './Browse';
import { whatsappNumberLink } from '../lib/whatsapp';

/** Public dealership page: the dealer's details plus a link to their stock on the search page. */
export function DealerPublicPage() {
  const { id } = useParams();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    endpoints.getDealer(Number(id)).then(setDealer).catch((err) => setError(errorMessage(err, 'This dealership could not be found.')));
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!dealer) return <Spinner label="Loading dealership" />;

  return (
    <div className="space-y-8">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
              {dealer.business_name}
              {dealer.verification_status === 'verified' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified dealer
                </span>
              )}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4" aria-hidden="true" /> {dealer.address ? `${dealer.address}, ` : ''}{dealer.city ? `${dealer.city}, ` : ''}{dealer.region}
            </p>
            {dealer.description && <p className="mt-3 max-w-2xl text-slate-700">{dealer.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${dealer.phone}`} className={buttonClass('primary')}><Phone className="h-4 w-4" aria-hidden="true" /> Call</a>
            {(dealer.whatsapp_number || dealer.phone) && (
              <a href={whatsappNumberLink(dealer.whatsapp_number || dealer.phone)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
                <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" /> WhatsApp
              </a>
            )}
            {dealer.email && <a href={`mailto:${dealer.email}`} className={buttonClass('secondary')}><Mail className="h-4 w-4" aria-hidden="true" /> Email</a>}
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">{dealer.active_listings} vehicle{dealer.active_listings === 1 ? '' : 's'} currently for sale</p>
      </Card>
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Stock from {dealer.business_name}</h2>
        <Browse dealerId={dealer.id} hideTitle />
      </div>
    </div>
  );
}

/** Signed-in dealer's own dealership profile and verification requests. */
export function DealerSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [dealer, setDealer] = useState<Dealer | null | undefined>(undefined);
  const [verifications, setVerifications] = useState<Verification[]>([]);

  function load() {
    endpoints.getMyDealer().then(setDealer).catch(() => setDealer(null));
    endpoints.getMyVerifications().then((page) => setVerifications(page.results)).catch(() => undefined);
  }

  useEffect(load, []);

  if (dealer === undefined) return <Spinner label="Loading your dealership" />;

  if (user?.role !== 'dealer') {
    return (
      <EmptyState title="Dealership profiles are for dealer accounts">
        <p>Switch your account to a dealer account on the <Link to="/account" className="font-semibold underline">account page</Link> first.</p>
      </EmptyState>
    );
  }

  return (
    <>
      <PageTitle title="Dealership" subtitle="Your public business details, shown on every vehicle you list." />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <DealerForm dealer={dealer} onSaved={(saved) => { setDealer(saved); refreshUser(); }} />
        <aside className="space-y-6">
          {dealer && (
            <Card>
              <h2 className="font-semibold text-slate-900">Verification</h2>
              <div className="mt-2 flex items-center gap-2"><StatusBadge status={dealer.verification_status} /></div>
              {dealer.verification_status === 'verified' && dealer.verified_at && (
                <p className="mt-2 text-sm text-slate-600">Verified on {formatDate(dealer.verified_at)}.</p>
              )}
            </Card>
          )}
          {dealer && dealer.verification_status !== 'verified' && dealer.verification_status !== 'pending' && (
            <VerificationRequest kind="dealer" onSubmitted={load} />
          )}
          {verifications.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">Requests</h2>
              <ul className="space-y-3 text-sm">
                {verifications.map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between"><span className="font-medium">{label(item.kind)} · {item.reference_number}</span><StatusBadge status={item.status === 'approved' ? 'verified' : item.status === 'rejected' ? 'rejected' : 'pending'} /></div>
                    <p className="text-xs text-slate-500">Submitted {formatDate(item.created_at)}</p>
                    {item.admin_note && <p className="mt-1 text-xs text-slate-700">Note from our team: {item.admin_note}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="bg-slate-50">
            <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <p className="mt-2 text-sm text-slate-700">Verification checks your business licence or TIN. Your documents are never published on the marketplace.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function DealerForm({ dealer, onSaved }: { dealer: Dealer | null; onSaved: (dealer: Dealer) => void }) {
  const [form, setForm] = useState({
    business_name: dealer?.business_name ?? '', description: dealer?.description ?? '', phone: dealer?.phone ?? '',
    whatsapp_number: dealer?.whatsapp_number ?? '', email: dealer?.email ?? '', region: dealer?.region ?? 'Dar es Salaam',
    city: dealer?.city ?? '', address: dealer?.address ?? '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = dealer ? await endpoints.updateDealer(form) : await endpoints.createDealer(form);
      onSaved(result);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">Dealership details saved.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="d-name" className="sm:col-span-2">
            <input id="d-name" required className={inputClass} value={form.business_name} onChange={set('business_name')} />
          </Field>
          <Field label="Phone" htmlFor="d-phone" hint="Tanzanian mobile number">
            <input id="d-phone" type="tel" required className={inputClass} value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="WhatsApp (optional)" htmlFor="d-wa">
            <input id="d-wa" type="tel" className={inputClass} value={form.whatsapp_number} onChange={set('whatsapp_number')} />
          </Field>
          <Field label="Email (optional)" htmlFor="d-email">
            <input id="d-email" type="email" className={inputClass} value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Region" htmlFor="d-region">
            <select id="d-region" className={inputClass} value={form.region} onChange={set('region')}>
              {REGIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="City" htmlFor="d-city">
            <input id="d-city" className={inputClass} value={form.city} onChange={set('city')} />
          </Field>
          <Field label="Showroom address" htmlFor="d-address" className="sm:col-span-2">
            <input id="d-address" className={inputClass} value={form.address} onChange={set('address')} />
          </Field>
          <Field label="About your dealership" htmlFor="d-desc" className="sm:col-span-2">
            <textarea id="d-desc" rows={4} maxLength={2000} className={inputClass} value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <Button type="submit" disabled={busy}><Save className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : dealer ? 'Save details' : 'Create dealership'}</Button>
      </form>
    </Card>
  );
}

function VerificationRequest({ kind, onSubmitted }: { kind: 'seller' | 'dealer'; onSubmitted: () => void }) {
  const [reference, setReference] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await endpoints.requestVerification({ kind, reference_number: reference.trim(), details: details.trim() });
      onSubmitted();
      setReference('');
      setDetails('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">Request verification</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Business licence or TIN number" htmlFor="v-ref" hint="Or your National ID number for individual sellers">
          <input id="v-ref" required className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Notes for our team (optional)" htmlFor="v-details">
          <textarea id="v-details" rows={3} maxLength={1000} className={inputClass} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</Button>
      </form>
    </Card>
  );
}

