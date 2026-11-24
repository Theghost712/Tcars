import { Bell, Car, ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { buttonClass } from './ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? 'text-brand-700 bg-brand-50' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`;

function useUnreadCount(enabled: boolean): number {
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () =>
      endpoints
        .getNotifications()
        .then((data) => active && setUnread(data.unread))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, location.pathname]);
  return unread;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useUnreadCount(Boolean(user));
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const canSell = user?.role === 'seller' || user?.role === 'dealer';
  // The home page draws its own full-width hero, so it manages its own width.
  const fullWidth = location.pathname === '/';

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const links = (
    <>
      <NavLink to="/vehicles" className={linkClass}>Browse cars</NavLink>
      {canSell && <NavLink to="/sell" className={linkClass}>Sell a car</NavLink>}
      {user && <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>}
      {user && <NavLink to="/favorites" className={linkClass}>Favourites</NavLink>}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Car className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Tanzania Car Marketplace</span>
            <span className="sm:hidden">TZ Cars</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">{links}</div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative rounded-full p-2 text-slate-700 hover:bg-slate-100">
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-expanded={accountOpen}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                  >
                    {user.full_name.split(' ')[0] || 'Account'}
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <Link to="/account" className="block px-4 py-2 text-sm hover:bg-slate-50">My account</Link>
                      {user.role === 'dealer' && <Link to="/dealer" className="block px-4 py-2 text-sm hover:bg-slate-50">Dealership profile</Link>}
                      {user.role === 'admin' && <Link to="/admin" className="block px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-50">Administration</Link>}
                      <button type="button" onClick={handleSignOut} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-slate-50">
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className={buttonClass('ghost', 'min-h-[40px] py-2')}>Sign in</Link>
                <Link to="/register" className={buttonClass('primary', 'min-h-[40px] py-2')}>Join free</Link>
              </div>
            )}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">{links}</div>
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <Link to="/account" className="rounded-md px-3 py-2 text-sm hover:bg-slate-100">My account</Link>
                  {user.role === 'dealer' && <Link to="/dealer" className="rounded-md px-3 py-2 text-sm hover:bg-slate-100">Dealership profile</Link>}
                  {user.role === 'admin' && <Link to="/admin" className="rounded-md px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-100">Administration</Link>}
                  <button type="button" onClick={handleSignOut} className="rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-slate-100">Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="rounded-md px-3 py-2 text-sm hover:bg-slate-100">Sign in</Link>
                  <Link to="/register" className="rounded-md px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-slate-100">Create a free account</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className={fullWidth ? 'w-full flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8'}>
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-slate-600 md:grid-cols-2">
          <p>
            Tanzania Car Marketplace connects buyers and sellers. It does not process payments, inspect vehicles or
            transfer ownership. Verify the vehicle, its documents and the seller before paying anything.
          </p>
          <p className="md:text-right">Dar es Salaam, Tanzania · Need help? Use the report button on any listing.</p>
        </div>
      </footer>
    </div>
  );
}
