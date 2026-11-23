import { Link } from 'react-router-dom';
import { buttonClass } from '../components/ui';

export default function NotFound() {
  return (
    <section className="py-20 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">We could not find that page</h1>
      <p className="mt-2 text-slate-600">The link may be old, or the vehicle may have been sold.</p>
      <Link to="/vehicles" className={buttonClass('primary', 'mt-6')}>Browse cars</Link>
    </section>
  );
}
