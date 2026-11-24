const tzs = new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 });

/** Formats Tanzanian shillings, e.g. 85000000 -> "TZS 85,000,000". */
export function formatTzs(amount: number): string {
  return `TZS ${tzs.format(amount)}`;
}

export function formatKm(km: number): string {
  return `${tzs.format(km)} km`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(value: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export const LABELS: Record<string, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  electric: 'Electric',
  other: 'Other',
  manual: 'Manual',
  automatic: 'Automatic',
  cvt: 'CVT',
  sedan: 'Sedan',
  suv: 'SUV',
  hatchback: 'Hatchback',
  pickup: 'Pick-up',
  van: 'Van',
  minibus: 'Minibus',
  coupe: 'Coupe',
  wagon: 'Station wagon',
  new: 'New',
  used: 'Used',
  reconditioned: 'Reconditioned',
  pending: 'Pending approval',
  approved: 'Live',
  rejected: 'Rejected',
  sold: 'Sold',
  expired: 'Expired',
  suspended: 'Suspended',
  unverified: 'Not verified',
  verified: 'Verified',
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  buyer: 'Buyer',
  seller: 'Individual seller',
  dealer: 'Dealer',
  admin: 'Administrator',
  dashboard: 'Dashboard',
};

export function label(value: string): string {
  return LABELS[value] ?? value;
}

export function daysLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}
