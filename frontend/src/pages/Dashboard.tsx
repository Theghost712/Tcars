import { Car, CheckCircle2, Clock, Eye, Inbox, Mail, PlusCircle, Store, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Dashboard as DashboardData, VehicleCard } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import { Alert, Button, Card, EmptyState, PageTitle, Spinner, buttonClass } from '../components/ui';
import { formatDate, formatTzs, label, timeAgo } from '../lib/format';
import { useAuth } from '../auth/AuthContext';

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Live' },
  { key: 'sold', label: 'Sold' },
  { key: 'expired', label: 'Expired' },
  { key: 'rejected', label: 'Rejected' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [listings, setListings] = useState<VehicleCard[] | null>(null);
  const [tab, setTab] = useState('');
  const [error, setError] = useState('');
  const [inquiries, setInquiries] = useState<{ id: number; name: string; phone: string; email: string; message: string; is_read: boolean; created_at: string; vehicle: number }[] | null>(null);

  useEffect(() => {
    endpoints.getDashboard().then(setData).catch((err) => setError(errorMessage(err)));
    endpoints.getReceivedInquiries().then((page) => setInquiries(page.results)).catch(() => setInquiries([]));
  }, []);

  useEffect(() => {
    setListings(null);
    endpoints.getMyListings(tab || undefined).then((page) => setListings(page.results)).catch(() => setListings([]));
  }, [tab]);

  async function refreshAll() {
    const [dash, mine] = await Promise.all([endpoints.getDashboard(), endpoints.getMyListings(tab || undefined)]);
    setData(dash);
    setListings(mine.results);
  }

  async function sold(id: number) {
    try {
      await endpoints.vehicleAction(id, 'mark-sold');
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function renew(id: number) {
    try {
      await endpoints.vehicleAction(id, 'renew');
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function markRead(id: number) {
    await endpoints.markInquiryRead(id);
    setInquiries((current) => current?.map((item) => (item.id === id ? { ...item, is_read: true } : item)) ?? null);
    setData((current) => (current ? { ...current, inquiries: { ...current.inquiries, unread: Math.max(0, current.inquiries.unread - 1) } } : current));
  }

  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Spinner label="Loading your dashboard" />;

  const stats = [
    { icon: Car, label: 'Total listings', value: data.counts.total },
    { icon: CheckCircle2, label: 'Live now', value: data.counts.approved },
    { icon: Clock, label: 'Awaiting review', value: data.counts.pending },
    { icon: Eye, label: 'Total views', value: data.views },
    { icon: Mail, label: 'Unread enquiries', value: data.inquiries.unread },
    { icon: XCircle, label: 'Needs changes', value: data.counts.rejected },
  ];

  return (
    <>
      <PageTitle
        title={`Welcome, ${user?.full_name.split(' ')[0] ?? 'there'}`}
        subtitle={data.role === 'dealer' ? 'Manage your dealership stock and enquiries.' : 'Manage your adverts and enquiries.'}
        actions={
          <>
            <Link to="/sell" className={buttonClass('primary')}><PlusCircle className="h-4 w-4" aria-hidden="true" /> New listing</Link>
            {data.role === 'dealer' && <Link to="/dealer" className={buttonClass('secondary')}><Store className="h-4 w-4" aria-hidden="true" /> Dealership</Link>}
          </>
        }
      />

      {!user?.is_verified && data.role !== 'buyer' && (
        <Alert tone="warning">
          Get verified to show a badge on your listings.{' '}
          <Link to={data.role === 'dealer' ? '/dealer' : '/account'} className="font-semibold underline">Request verification</Link>
        </Alert>
      )}

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6" aria-label="Summary">
        {stats.map(({ icon: Icon, label: text, value }) => (
          <Card key={text} className="p-4">
            <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold text-slate-900">{value.toLocaleString('en')}</p>
            <p className="text-xs text-slate-600">{text}</p>
          </Card>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="listings-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="listings-heading" className="text-lg font-semibold text-slate-900">My listings</h2>
            <div role="tablist" aria-label="Filter listings by status" className="flex flex-wrap gap-1">
              {TABS.map((item) => (
                <button key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}
                  className={`rounded-full px-3 py-1 text-sm ${tab === item.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          {!listings && <Spinner label="Loading listings" />}
          {listings && listings.length === 0 && (
            <EmptyState title="No listings here yet">
              <Link to="/sell" className="font-semibold text-brand-700 hover:underline">Publish your first vehicle</Link>
            </EmptyState>
          )}
          {listings && listings.length > 0 && (
            <ul className="space-y-3">
              {listings.map((vehicle) => (
                <li key={vehicle.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {vehicle.main_image && <img src={vehicle.main_image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/vehicles/${vehicle.id}`} className="truncate font-semibold text-slate-900 hover:text-brand-700">{vehicle.title}</Link>
                      <StatusBadge status={vehicle.status} />
                    </div>
                    <p className="text-sm text-brand-700">{formatTzs(vehicle.price_tzs)}</p>
                    <p className="text-xs text-slate-500">{vehicle.views_count} views · added {timeAgo(vehicle.created_at)} · {label(vehicle.condition)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <Link to={`/vehicles/${vehicle.id}/edit`} className="font-medium text-slate-700 hover:underline">Edit</Link>
                      {['approved', 'pending', 'expired', 'rejected'].includes(vehicle.status) && (
                        <button type="button" className="font-medium text-slate-700 hover:underline" onClick={() => sold(vehicle.id)}>Mark sold</button>
                      )}
                      {['expired'].includes(vehicle.status) && (
                        <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => renew(vehicle.id)}>Renew</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="inbox-heading" className="space-y-4">
          <h2 id="inbox-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Inbox className="h-5 w-5" aria-hidden="true" /> Enquiries
          </h2>
          {!inquiries && <Spinner label="Loading enquiries" />}
          {inquiries && inquiries.length === 0 && <EmptyState title="No enquiries yet">Buyers who contact you will appear here.</EmptyState>}
          {inquiries?.map((item) => (
            <Card key={item.id} className={`p-4 ${item.is_read ? '' : 'border-brand-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <time className="text-xs text-slate-500" dateTime={item.created_at}>{formatDate(item.created_at)}</time>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.message}</p>
              <p className="mt-2 text-xs text-slate-600">
                {item.phone && <a href={`tel:${item.phone}`} className="font-medium text-brand-700">{item.phone}</a>}
                {item.phone && item.email && ' · '}
                {item.email && <a href={`mailto:${item.email}`} className="font-medium text-brand-700">{item.email}</a>}
              </p>
              {!item.is_read && (
                <Button variant="ghost" className="mt-2 min-h-[36px] px-2 py-1 text-xs" onClick={() => markRead(item.id)}>Mark as read</Button>
              )}
            </Card>
          ))}
        </section>
      </div>
      <p className="mt-10 text-xs text-slate-500">Listings stay live for 60 days after approval. Renew them from here before they expire.</p>
    </>
  );
}
