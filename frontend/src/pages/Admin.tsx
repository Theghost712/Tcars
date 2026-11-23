import { CheckCircle2, Flag, MinusCircle, PauseCircle, PlayCircle, Star, StarOff, UserCheck, UserX, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { AdminReport, AdminStats, AdminUser, AdminVerification, LogEntry, VehicleCard } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import { Alert, Button, Card, EmptyState, Field, PageTitle, Spinner, inputClass } from '../components/ui';
import { formatDate, formatTzs, label, timeAgo } from '../lib/format';

type Tab = 'overview' | 'listings' | 'reports' | 'verifications' | 'users' | 'log';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'listings', label: 'Listing queue' },
  { key: 'reports', label: 'Reports' },
  { key: 'verifications', label: 'Verifications' },
  { key: 'users', label: 'Users' },
  { key: 'log', label: 'Activity log' },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <>
      <PageTitle title="Administration" subtitle="Moderate listings, handle reports, verify sellers and dealers, and manage accounts." />
      <div role="tablist" aria-label="Administration sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((item) => (
          <button key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === item.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'listings' && <ListingQueue />}
      {tab === 'reports' && <Reports />}
      {tab === 'verifications' && <Verifications />}
      {tab === 'users' && <Users />}
      {tab === 'log' && <ActivityLog />}
    </>
  );
}

function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    load().then((value) => active && setData(value)).catch((err) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, error, reload: () => setVersion((v) => v + 1), setData };
}

function Overview() {
  const { data, error } = useLoader<AdminStats>(endpoints.getAdminStats);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Spinner />;
  const tiles = [
    { label: 'Awaiting approval', value: data.listings.pending, tone: 'text-amber-700' },
    { label: 'Live listings', value: data.listings.approved, tone: 'text-emerald-700' },
    { label: 'Open reports', value: data.open_reports, tone: 'text-red-700' },
    { label: 'Verification requests', value: data.pending_verifications, tone: 'text-sky-700' },
    { label: 'Users', value: data.users.total, tone: 'text-slate-900' },
    { label: 'Suspended accounts', value: data.users.suspended, tone: 'text-slate-900' },
    { label: 'Enquiries today', value: data.inquiries_today, tone: 'text-slate-900' },
    { label: 'Enquiries all time', value: data.inquiries_total, tone: 'text-slate-900' },
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Key figures">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className={`text-3xl font-bold ${tile.tone}`}>{tile.value.toLocaleString('en')}</p>
            <p className="mt-1 text-sm text-slate-600">{tile.label}</p>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="font-semibold text-slate-900">Users by role</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(data.users.by_role).map(([role, count]) => (
            <div key={role} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{label(role)}</dt>
              <dd className="text-xl font-semibold">{count}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function ListingQueue() {
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useLoader(() => endpoints.getAdminVehicles(status), [status]);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');

  async function act(id: number, action: string, body: Record<string, unknown> = {}) {
    setActionError('');
    try {
      await endpoints.adminVehicleAction(id, action, body);
      setRejecting(null);
      setReason('');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600" htmlFor="queue-status">Show</label>
        <select id="queue-status" className={`${inputClass} mt-0 w-auto py-2`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Waiting for approval</option>
          <option value="approved">Live</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="all">All</option>
        </select>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.results.length === 0 && <EmptyState title="Nothing to review here" />}
      {data?.results.map((vehicle: VehicleCard) => (
        <Card key={vehicle.id} className="flex flex-col gap-4 sm:flex-row">
          <div className="h-28 w-40 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {vehicle.main_image && <img src={vehicle.main_image} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/vehicles/${vehicle.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{vehicle.title}</a>
              <StatusBadge status={vehicle.status} />
              {vehicle.is_featured && <span className="text-xs font-medium text-amber-700">Featured</span>}
            </div>
            <p className="text-sm text-slate-700">{formatTzs(vehicle.price_tzs)} · {vehicle.region}{vehicle.city ? `, ${vehicle.city}` : ''} · submitted {timeAgo(vehicle.created_at)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {vehicle.status === 'pending' && (
                <>
                  <Button className="min-h-[36px] px-3 py-1.5 text-sm" onClick={() => act(vehicle.id, 'approve')}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve</Button>
                  <Button variant="secondary" className="min-h-[36px] px-3 py-1.5 text-sm" onClick={() => setRejecting(rejecting === vehicle.id ? null : vehicle.id)}><XCircle className="h-4 w-4" aria-hidden="true" /> Reject</Button>
                </>
              )}
              {(vehicle.status === 'approved' || vehicle.status === 'pending') && (
                <Button variant="secondary" className="min-h-[36px] px-3 py-1.5 text-sm" onClick={() => act(vehicle.id, 'feature', { featured: !vehicle.is_featured })}>
                  {vehicle.is_featured ? <><StarOff className="h-4 w-4" aria-hidden="true" /> Unfeature</> : <><Star className="h-4 w-4" aria-hidden="true" /> Feature</>}
                </Button>
              )}
              {(vehicle.status === 'approved' || vehicle.status === 'pending' || vehicle.status === 'expired') && (
                <Button variant="secondary" className="min-h-[36px] px-3 py-1.5 text-sm" onClick={() => act(vehicle.id, 'suspend', { reason: 'Suspended after moderation review.' })}>
                  <PauseCircle className="h-4 w-4" aria-hidden="true" /> Suspend
                </Button>
              )}
              {vehicle.status === 'suspended' && (
                <Button className="min-h-[36px] px-3 py-1.5 text-sm" onClick={() => act(vehicle.id, 'restore')}><PlayCircle className="h-4 w-4" aria-hidden="true" /> Restore</Button>
              )}
            </div>
            {rejecting === vehicle.id && (
              <form className="flex flex-col gap-2 pt-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); act(vehicle.id, 'reject', { reason }); }}>
                <label htmlFor={`reason-${vehicle.id}`} className="sr-only">Reason for rejection</label>
                <input id={`reason-${vehicle.id}`} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason the seller will see, e.g. photos are unclear"
                  className={`${inputClass} mt-0`} />
                <Button type="submit" variant="danger" className="min-h-[40px] py-2 text-sm">Send rejection</Button>
              </form>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Reports() {
  const [status, setStatus] = useState('open');
  const { data, error, reload } = useLoader(() => endpoints.getAdminReports(status), [status]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState('');

  async function resolve(report: AdminReport, action: 'dismiss' | 'remove_listing') {
    setActionError('');
    try {
      await endpoints.resolveReport(report.id, action, notes[report.id] ?? '');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <select aria-label="Report status" className={`${inputClass} mt-0 w-auto py-2`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="open">Open</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
        <option value="all">All</option>
      </select>
      {error && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.results.length === 0 && <EmptyState title="No reports in this group" />}
      {data?.results.map((report) => (
        <Card key={report.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span className="font-semibold text-slate-900">{report.reason_label}</span>
            <StatusBadge status={report.status === 'open' ? 'pending' : report.status === 'resolved' ? 'approved' : 'expired'} />
            <span className="text-xs text-slate-500">{timeAgo(report.created_at)} by {report.reporter_email}</span>
          </div>
          <p className="text-sm text-slate-700">
            Listing: <a className="font-medium text-brand-700 hover:underline" href={`/vehicles/${report.vehicle.id}`}>{report.vehicle.title}</a> ({label(report.vehicle.status)})
          </p>
          {report.details && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{report.details}</p>}
          {report.status === 'open' && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input aria-label="Resolution note" className={`${inputClass} mt-0`} placeholder="Note for the record"
                value={notes[report.id] ?? ''} onChange={(e) => setNotes({ ...notes, [report.id]: e.target.value })} />
              <Button variant="secondary" onClick={() => resolve(report, 'dismiss')}><MinusCircle className="h-4 w-4" aria-hidden="true" /> Dismiss</Button>
              <Button variant="danger" onClick={() => resolve(report, 'remove_listing')}>Suspend listing</Button>
            </div>
          )}
          {report.resolution_note && <p className="text-xs text-slate-500">Note: {report.resolution_note}</p>}
        </Card>
      ))}
    </div>
  );
}

function Verifications() {
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useLoader(() => endpoints.getAdminVerifications(status), [status]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState('');

  async function decide(item: AdminVerification, decision: 'approve' | 'reject') {
    setActionError('');
    try {
      await endpoints.decideVerification(item.id, decision, notes[item.id] ?? '');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <select aria-label="Verification status" className={`${inputClass} mt-0 w-auto py-2`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="all">All</option>
      </select>
      {error && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.results.length === 0 && <EmptyState title="No verification requests here" />}
      {data?.results.map((item) => (
        <Card key={item.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{label(item.kind)} verification</span>
            <StatusBadge status={item.status === 'approved' ? 'verified' : item.status === 'rejected' ? 'rejected' : 'pending'} />
            <span className="text-xs text-slate-500">submitted {formatDate(item.created_at)}</span>
          </div>
          <p className="text-sm text-slate-700">Reference: <strong className="font-mono">{item.reference_number}</strong></p>
          {item.details && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.details}</p>}
          {item.status === 'pending' && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input aria-label="Note to applicant" className={`${inputClass} mt-0`} placeholder="Note (required if rejecting)"
                value={notes[item.id] ?? ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} />
              <Button onClick={() => decide(item, 'approve')}><UserCheck className="h-4 w-4" aria-hidden="true" /> Approve</Button>
              <Button variant="danger" onClick={() => decide(item, 'reject')}>Reject</Button>
            </div>
          )}
          {item.admin_note && <p className="text-xs text-slate-500">Note: {item.admin_note}</p>}
        </Card>
      ))}
    </div>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState({ q: '', role: '' });
  const { data, error, reload } = useLoader(() => endpoints.getAdminUsers(search.q, search.role), [search.q, search.role]);
  const [actionError, setActionError] = useState('');

  async function update(user: AdminUser, body: { is_active?: boolean; role?: string; suspension_reason?: string }) {
    setActionError('');
    try {
      await endpoints.updateAdminUser(user.id, body);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_200px_auto]" onSubmit={(e) => { e.preventDefault(); setSearch({ q, role }); }}>
        <Field label="Search" htmlFor="u-search">
          <input id="u-search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" />
        </Field>
        <Field label="Role" htmlFor="u-role">
          <select id="u-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="dealer">Dealer</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex items-end"><Button type="submit" variant="secondary">Search</Button></div>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Listings</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.results.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{user.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <select aria-label={`Role for ${user.email}`} className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={user.role}
                      onChange={(e) => update(user, { role: e.target.value })}>
                      <option value="buyer">Buyer</option><option value="seller">Seller</option><option value="dealer">Dealer</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{user.listings}</td>
                  <td className="px-4 py-3">{user.is_active ? <span className="text-emerald-700">Active</span> : <span className="text-red-700">Suspended</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.date_joined)}</td>
                  <td className="px-4 py-3 text-right">
                    {user.is_active ? (
                      <Button variant="secondary" className="min-h-[34px] px-3 py-1 text-xs" onClick={() => {
                        const reason = window.prompt('Reason for suspending this account (shown to the user):', 'Breach of marketplace rules');
                        if (reason !== null) update(user, { is_active: false, suspension_reason: reason });
                      }}><UserX className="h-3.5 w-3.5" aria-hidden="true" /> Suspend</Button>
                    ) : (
                      <Button className="min-h-[34px] px-3 py-1 text-xs" onClick={() => update(user, { is_active: true })}>Reactivate</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActivityLog() {
  const { data, error } = useLoader<LogEntry[]>(endpoints.getAdminLog);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Spinner />;
  if (data.length === 0) return <EmptyState title="No moderation activity yet" />;
  return (
    <ol className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {data.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-medium text-slate-900">{label(entry.action)}</span> · {entry.vehicle_title}{entry.reason && <span className="text-slate-600"> — {entry.reason}</span>}</p>
          <p className="text-xs text-slate-500">{entry.moderator ?? 'System'} · {formatDate(entry.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
