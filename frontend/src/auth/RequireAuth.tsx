import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../api/types';
import { Spinner } from '../components/ui';

type Props = { children: ReactNode; roles?: Role[] };

/** Protects a route: signed-out visitors go to /login, and wrong roles see an explanation. */
export default function RequireAuth({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">This page is not available for your account</h1>
        <p className="mt-2 text-sm">
          Your account is a <strong>{user.role}</strong> account. You can change your account type on the{' '}
          <a className="underline" href="/account">account page</a>.
        </p>
      </section>
    );
  }
  return <>{children}</>;
}
