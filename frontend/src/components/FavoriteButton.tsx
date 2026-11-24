import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import { useAuth } from '../auth/AuthContext';

type Props = { vehicleId: number; initial: boolean; onChange?: (saved: boolean) => void };

export default function FavoriteButton({ vehicleId, initial, onChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (saved) await endpoints.removeFavorite(vehicleId);
      else await endpoints.addFavorite(vehicleId);
      setSaved(!saved);
      onChange?.(!saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow ring-1 ring-slate-200 transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
      >
        <Heart className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : ''}`} aria-hidden="true" />
      </button>
      {error && <span className="sr-only" role="alert">{error}</span>}
    </>
  );
}
