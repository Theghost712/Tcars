import { CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Notification } from '../api/types';
import { Alert, Button, EmptyState, PageTitle, Spinner } from '../components/ui';
import { timeAgo } from '../lib/format';

export default function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  function load() {
    endpoints.getNotifications().then((data) => setItems(data.results)).catch((err) => setError(errorMessage(err)));
  }

  useEffect(load, []);

  async function markAll() {
    await endpoints.markAllNotificationsRead();
    load();
  }

  async function open(item: Notification) {
    if (!item.is_read) await endpoints.markNotificationRead(item.id);
    setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)) ?? null);
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!items) return <Spinner label="Loading notifications" />;

  return (
    <>
      <PageTitle
        title="Notifications"
        subtitle="Listing decisions, new enquiries and verification updates."
        actions={items.some((n) => !n.is_read) ? (
          <Button variant="secondary" onClick={markAll}><CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read</Button>
        ) : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="You are all caught up" />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className={item.is_read ? 'bg-white' : 'bg-brand-50/40'}>
              <Link to={item.link || '/dashboard'} onClick={() => open(item)} className="block p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm ${item.is_read ? 'font-medium text-slate-800' : 'font-semibold text-slate-900'}`}>
                      {!item.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500" dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
