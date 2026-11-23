import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonClass } from './ui';

type Props = { page: number; count: number; pageSize: number; onChange: (page: number) => void };

export default function Pagination({ page, count, pageSize, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <button
        type="button"
        className={buttonClass('secondary', 'px-3')}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
      </button>
      <span className="text-sm text-slate-600">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className={buttonClass('secondary', 'px-3')}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
