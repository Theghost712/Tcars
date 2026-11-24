import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Favorite } from '../api/types';
import VehicleCard from '../components/VehicleCard';
import { Alert, EmptyState, PageTitle, Spinner, buttonClass } from '../components/ui';

export default function Favorites() {
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    endpoints.getFavorites().then(setItems).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!items) return <Spinner label="Loading favourites" />;

  return (
    <>
      <PageTitle title="Saved vehicles" subtitle="Cars you have saved to compare later. Sold or expired cars are removed from this list automatically." />
      {items.length === 0 ? (
        <EmptyState title="Nothing saved yet">
          <p>Tap the heart on any listing to keep it here.</p>
          <Link to="/vehicles" className={buttonClass('primary', 'mt-4')}>Browse cars</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <VehicleCard key={item.id} vehicle={{ ...item.vehicle, is_favorited: true }} />)}
        </div>
      )}
    </>
  );
}
