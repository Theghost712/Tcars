import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="text-center py-16">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand-700 underline">
        Back to home
      </Link>
    </section>
  );
}
