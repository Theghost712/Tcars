import { label } from '../lib/format';

const tones: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  sold: 'bg-slate-200 text-slate-800',
  expired: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-200 text-red-900',
  verified: 'bg-emerald-100 text-emerald-800',
  unverified: 'bg-slate-100 text-slate-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {label(status)}
    </span>
  );
}
