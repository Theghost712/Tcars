import type { ReactNode } from 'react';
import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';

type LayoutProps = { children: ReactNode };

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <Car className="h-6 w-6 text-brand-600" aria-hidden="true" />
            Tanzania Car Marketplace
          </Link>
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          Buyers and sellers remain responsible for verifying vehicle condition, documents and ownership.
        </div>
      </footer>
    </div>
  );
}
