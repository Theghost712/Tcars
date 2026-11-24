import { BadgeCheck, Calendar, Edit3, Eye, Flag, Fuel, Gauge, MapPin, MessageCircle, Phone, Settings2, Store, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { VehicleCard, VehicleDetail as Detail } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import FavoriteButton from '../components/FavoriteButton';
import Gallery from '../components/Gallery';
import StatusBadge from '../components/StatusBadge';
import VehicleCardView from '../components/VehicleCard';
import { Alert, Button, Card, Field, Spinner, buttonClass, inputClass } from '../components/ui';
import { daysLeft, formatDate, formatKm, formatTzs, label } from '../lib/format';
import { REPORT_REASONS } from '../lib/regions';

export default function VehicleDetail() {
  const { id } = useParams();
  const vehicleId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [vehicle, setVehicle] = useState<Detail | null>(null);
  const [related, setRelated] = useState<VehicleCard[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setVehicle(null);
    setError('');
    setNotFound(false);
    endpoints
      .getVehicle(vehicleId)
      .then((data) => active && setVehicle(data))
      .catch((err) => {
        if (!active) return;
        if (err?.response?.status === 404) setNotFound(true);
        else setError(errorMessage(err));
      });
    endpoints.getRelated(vehicleId).then((items) => active && setRelated(items)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [vehicleId]);

  if (notFound) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-2xl font-bold">This listing is not available</h1>
        <p className="mt-2 text-slate-600">It may have been sold, expired or removed.</p>
        <Link to="/vehicles" className={buttonClass('primary', 'mt-6')}>Browse other cars</Link>
      </section>
    );
  }
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!vehicle) return <Spinner label="Loading vehicle" />;

  const isOwner = vehicle.is_owner;
  const days = daysLeft(vehicle.expires_at);
  const images = vehicle.images;

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link to="/vehicles" className="hover:text-slate-800">Cars for sale</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800">{vehicle.make} {vehicle.model}</span>
      </nav>

      {flash && <Alert tone="success">{flash}</Alert>}
      {isOwner && <OwnerBanner vehicle={vehicle} onChanged={setVehicle} />}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Gallery images={images} alt={vehicle.title} />

          <section aria-labelledby="title-heading" className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 id="title-heading" className="text-2xl font-bold tracking-tight text-slate-900">{vehicle.title}</h1>
              {vehicle.is_featured && <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold">Featured</span>}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {vehicle.city ? `${vehicle.city}, ` : ''}{vehicle.region}
              {vehicle.published_at && <span className="text-slate-400"> · listed {formatDate(vehicle.published_at)}</span>}
            </p>
          </section>

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="mb-3 text-lg font-semibold text-slate-900">Specifications</h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
              {[
                ['Make', vehicle.make],
                ['Model', vehicle.model],
                ['Year', String(vehicle.year)],
                ['Condition', label(vehicle.condition)],
                ['Mileage', formatKm(vehicle.mileage_km)],
                ['Fuel', label(vehicle.fuel_type)],
                ['Transmission', label(vehicle.transmission)],
                ['Engine', vehicle.engine_cc ? `${vehicle.engine_cc.toLocaleString('en')} cc` : 'Not stated'],
                ['Body type', label(vehicle.body_type)],
                ['Colour', vehicle.color || 'Not stated'],
              ].map(([term, value]) => (
                <div key={term} className="bg-white p-4">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{term}</dt>
                  <dd className="mt-1 font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="mb-3 text-lg font-semibold text-slate-900">Description</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{vehicle.description}</p>
          </section>

          {related.length > 0 && (
            <section aria-labelledby="related-heading">
              <h2 id="related-heading" className="mb-4 text-lg font-semibold text-slate-900">Similar vehicles</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {related.map((item) => <VehicleCardView key={item.id} vehicle={item} />)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Asking price</p>
                <p className="text-3xl font-bold text-brand-700">{formatTzs(vehicle.price_tzs)}</p>
              </div>
              <FavoriteButton vehicleId={vehicle.id} initial={vehicle.is_favorited} />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />{vehicle.year}</li>
              <li className="flex items-center gap-2"><Gauge className="h-4 w-4 text-slate-400" aria-hidden="true" />{formatKm(vehicle.mileage_km)}</li>
              <li className="flex items-center gap-2"><Fuel className="h-4 w-4 text-slate-400" aria-hidden="true" />{label(vehicle.fuel_type)}</li>
              <li className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-slate-400" aria-hidden="true" />{label(vehicle.transmission)}</li>
            </ul>

            {vehicle.status === 'approved' && (
              <div className="mt-5 grid gap-2">
                <a href={`tel:${vehicle.contact_phone}`} className={buttonClass('primary', 'w-full')}>
                  <Phone className="h-4 w-4" aria-hidden="true" /> Call seller
                </a>
                {vehicle.whatsapp_url && (
                  <a href={vehicle.whatsapp_url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'w-full')}>
                    <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              {vehicle.dealer ? <Store className="h-4 w-4" aria-hidden="true" /> : null}
              {vehicle.dealer ? vehicle.dealer.business_name : vehicle.seller.name}
              {(vehicle.dealer?.is_verified || vehicle.seller.is_verified) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {vehicle.dealer ? 'Dealership' : 'Private seller'} · {vehicle.dealer ? `${vehicle.dealer.city || vehicle.dealer.region}` : vehicle.region}
            </p>
            {vehicle.dealer && (
              <Link to={`/dealers/${vehicle.dealer.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
                View all stock from this dealer
              </Link>
            )}
          </Card>

          {vehicle.status === 'approved' && !isOwner && (
            <InquiryForm vehicleId={vehicle.id} defaults={{ name: user?.full_name ?? '', phone: user?.phone ?? '', email: user?.email ?? '' }} />
          )}

          {!isOwner && vehicle.status === 'approved' && <ReportForm vehicleId={vehicle.id} onNeedLogin={() => navigate(`/login?next=/vehicles/${vehicle.id}`)} />}

          <p className="text-xs leading-relaxed text-slate-500">
            Check the vehicle in person, confirm its documents and never pay before you have seen the car and verified ownership.
          </p>
          {days !== null && vehicle.status === 'approved' && (
            <p className="text-xs text-slate-500">This listing is visible for {days} more day{days === 1 ? '' : 's'}.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function OwnerBanner({ vehicle, onChanged }: { vehicle: Detail; onChanged: (v: Detail) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const days = daysLeft(vehicle.expires_at);

  async function act(action: 'mark-sold' | 'renew') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await endpoints.vehicleAction(vehicle.id, action);
      onChanged({ ...vehicle, ...updated });
      setMessage(action === 'mark-sold' ? 'Marked as sold. It is no longer shown in search.' : 'Renewal requested. The listing will be reviewed again.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canSell = ['approved', 'pending', 'expired', 'rejected'].includes(vehicle.status);
  return (
    <Card className="border-brand-200 bg-brand-50/50">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900">Your listing</span>
            <StatusBadge status={vehicle.status} />
            <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{vehicle.views_count} views</span>
          </div>
          {vehicle.status === 'pending' && <p className="text-sm text-slate-700">Our team is reviewing this listing. It will appear in search once approved.</p>}
          {vehicle.status === 'rejected' && <Alert tone="error">Rejected: {vehicle.rejection_reason || 'See the notification for details.'} Edit the listing to send it back for review.</Alert>}
          {vehicle.status === 'suspended' && <Alert tone="error">Suspended: {vehicle.suspension_reason || 'Contact support for more information.'}</Alert>}
          {vehicle.status === 'expired' && <p className="text-sm text-slate-700">This listing has expired. Renew it to send it back for review.</p>}
          {vehicle.status === 'approved' && days !== null && <p className="text-sm text-slate-700">Live for {days} more day{days === 1 ? '' : 's'}.</p>}
          {vehicle.status === 'sold' && <p className="text-sm text-slate-700">Sold on {formatDate(vehicle.sold_at)}.</p>}
          {message && <Alert tone="success">{message}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
        </div>
        <div className="flex flex-wrap gap-2">
          {vehicle.status !== 'suspended' && (
            <Link to={`/vehicles/${vehicle.id}/edit`} className={buttonClass('secondary')}>
              <Edit3 className="h-4 w-4" aria-hidden="true" /> Edit
            </Link>
          )}
          {canSell && (
            <Button variant="secondary" disabled={busy} onClick={() => act('mark-sold')}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Mark as sold
            </Button>
          )}
          {(vehicle.status === 'expired' || vehicle.status === 'approved') && (
            <Button variant="secondary" disabled={busy} onClick={() => act('renew')}>Renew listing</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function InquiryForm({ vehicleId, defaults }: { vehicleId: number; defaults: { name: string; phone: string; email: string } }) {
  const [form, setForm] = useState({ ...defaults, message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await endpoints.sendInquiry(vehicleId, form);
      setStatus('sent');
      setForm((current) => ({ ...current, message: '' }));
    } catch (err) {
      setStatus('error');
      setError(errorMessage(err));
    }
  }

  if (status === 'sent') {
    return (
      <Card>
        <Alert tone="success">Your message was sent. The seller will reply using the phone number or email you provided.</Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-900">Send an enquiry</h2>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Your name" htmlFor="inq-name">
          <input id="inq-name" required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        </Field>
        <Field label="Phone number" htmlFor="inq-phone" hint="Tanzanian mobile, e.g. 0712 345 678">
          <input id="inq-phone" type="tel" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
        </Field>
        <Field label="Email (optional)" htmlFor="inq-email">
          <input id="inq-email" type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </Field>
        <Field label="Message" htmlFor="inq-message">
          <textarea id="inq-message" required rows={4} maxLength={1000} className={inputClass} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Is the price negotiable? Can I see it this weekend?" />
        </Field>
        {status === 'error' && <Alert tone="error">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send enquiry'}
        </Button>
      </form>
    </Card>
  );
}

function ReportForm({ vehicleId, onNeedLogin }: { vehicleId: number; onNeedLogin: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('misleading');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!open) {
    return (
      <button type="button" className="inline-flex items-center gap-2 text-sm text-slate-600 underline-offset-2 hover:text-red-700 hover:underline"
        onClick={() => (user ? setOpen(true) : onNeedLogin())}>
        <Flag className="h-4 w-4" aria-hidden="true" /> Report this listing
      </button>
    );
  }
  if (status === 'done') return <Alert tone="success">Thank you. Our team will review this listing.</Alert>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await endpoints.reportVehicle(vehicleId, reason, details);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(errorMessage(err));
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-900">Report this listing</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="What is wrong?" htmlFor="rep-reason">
          <select id="rep-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        <Field label="Details (optional)" htmlFor="rep-details">
          <textarea id="rep-details" rows={3} maxLength={1000} className={inputClass} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        {status === 'error' && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={status === 'sending'}>Send report</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
