import { BadgeCheck, Fuel, Gauge, MapPin, Settings2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { VehicleCard as Card } from '../api/types';
import { formatKm, formatTzs, label } from '../lib/format';
import FavoriteButton from './FavoriteButton';

export default function VehicleCard({ vehicle }: { vehicle: Card }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/vehicles/${vehicle.id}`} className="block aspect-[4/3] overflow-hidden bg-slate-100">
        {vehicle.main_image ? (
          <img
            src={vehicle.main_image}
            alt={vehicle.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo yet</div>
        )}
      </Link>
      <div className="absolute right-3 top-3">
        <FavoriteButton vehicleId={vehicle.id} initial={vehicle.is_favorited} />
      </div>
      {vehicle.is_featured && (
        <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-slate-900">
          Featured
        </span>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <Link to={`/vehicles/${vehicle.id}`} className="line-clamp-1 font-semibold text-slate-900 hover:text-brand-700">
            {vehicle.title}
          </Link>
          <p className="text-lg font-bold text-brand-700">{formatTzs(vehicle.price_tzs)}</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600">
          <li className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{vehicle.year}</li>
          <li className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" aria-hidden="true" />{formatKm(vehicle.mileage_km)}</li>
          <li className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5" aria-hidden="true" />{label(vehicle.fuel_type)}</li>
          <li className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" aria-hidden="true" />{label(vehicle.transmission)}</li>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{vehicle.city ? `${vehicle.city}, ` : ''}{vehicle.region}</span>
          </span>
          {vehicle.dealer_name ? (
            <span className="flex shrink-0 items-center gap-1 font-medium text-slate-700">
              {vehicle.dealer_verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-600" aria-label="Verified dealer" />}
              {vehicle.dealer_name}
            </span>
          ) : (
            <span className="shrink-0">Private seller</span>
          )}
        </div>
      </div>
    </article>
  );
}
