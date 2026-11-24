import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { VehicleImage } from '../api/types';

export default function Gallery({ images, alt }: { images: VehicleImage[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-500">
        <ImageOff className="h-8 w-8" aria-hidden="true" />
        <span className="text-sm">No photos were added for this vehicle</span>
      </div>
    );
  }
  const current = images[index];
  const go = (step: number) => setIndex((index + step + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
        <img src={current.url} alt={`${alt} — photo ${index + 1} of ${images.length}`} className="h-full w-full object-contain" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`block aspect-square w-full overflow-hidden rounded-lg border-2 ${i === index ? 'border-brand-600' : 'border-transparent'}`}
              >
                <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
