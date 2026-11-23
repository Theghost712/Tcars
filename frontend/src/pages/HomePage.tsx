import { useEffect, useState } from 'react';
import { fetchHealth, type HealthStatus } from '../api/client';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; health: HealthStatus }
  | { kind: 'error'; message: string };

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((health) => active && setState({ kind: 'ready', health }))
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ kind: 'error', message });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Buy and sell vehicles in Tanzania</h1>
        <p className="mt-2 text-slate-600">
          Browse used cars, pick-ups and dealership stock across Dar es Salaam and beyond.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-500">Backend connection</h2>
        {state.kind === 'loading' && <p className="mt-1 text-slate-700">Checking…</p>}
        {state.kind === 'ready' && (
          <p className="mt-1 text-slate-700">
            API status: <span className="font-semibold">{state.health.status}</span>, database:{' '}
            <span className="font-semibold">{state.health.database}</span>
          </p>
        )}
        {state.kind === 'error' && (
          <p className="mt-1 text-red-700">Could not reach the API: {state.message}</p>
        )}
      </div>
    </section>
  );
}
