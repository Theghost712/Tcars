export type Role = 'buyer' | 'seller' | 'dealer' | 'admin';

export type VehicleStatus = 'pending' | 'approved' | 'rejected' | 'sold' | 'expired' | 'suspended';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  region: string;
  city: string;
  is_verified: boolean;
  has_dealer_profile: boolean;
  date_joined: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface VehicleCard {
  id: number;
  title: string;
  make: string;
  model: string;
  year: number;
  price_tzs: number;
  mileage_km: number;
  fuel_type: string;
  transmission: string;
  body_type: string;
  condition: string;
  region: string;
  city: string;
  status: VehicleStatus;
  is_featured: boolean;
  views_count: number;
  main_image: string | null;
  is_favorited: boolean;
  dealer_name: string | null;
  dealer_verified: boolean | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface VehicleImage {
  id: number;
  url: string;
  position: number;
}

export interface VehicleDetail extends VehicleCard {
  description: string;
  color: string;
  engine_cc: number | null;
  contact_phone: string;
  whatsapp_number: string;
  whatsapp_url: string;
  images: VehicleImage[];
  seller: {
    id: number;
    name: string;
    is_verified: boolean;
    dealer_id: number | null;
    dealer_name: string | null;
    dealer_verified: boolean | null;
  };
  dealer: {
    id: number;
    business_name: string;
    region: string;
    city: string;
    phone: string;
    verification_status: string;
    is_verified: boolean;
  } | null;
  rejection_reason: string;
  suspension_reason: string;
  is_owner: boolean;
  updated_at: string;
  sold_at: string | null;
}

export interface VehicleInput {
  title: string;
  make: string;
  model: string;
  year: number;
  price_tzs: number;
  mileage_km: number;
  fuel_type: string;
  transmission: string;
  engine_cc: number | null;
  body_type: string;
  condition: string;
  color: string;
  region: string;
  city: string;
  description: string;
  contact_phone: string;
  whatsapp_number: string;
}

export interface Dealer {
  id: number;
  owner_id: number;
  business_name: string;
  description: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  region: string;
  city: string;
  address: string;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verified_at: string | null;
  active_listings: number;
  created_at: string;
}

export interface Verification {
  id: number;
  kind: 'seller' | 'dealer';
  reference_number: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface Inquiry {
  id: number;
  vehicle: number;
  name: string;
  phone: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Favorite {
  id: number;
  vehicle: VehicleCard;
  created_at: string;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface Dashboard {
  role: Role;
  counts: Record<'total' | 'pending' | 'approved' | 'rejected' | 'sold' | 'expired' | 'suspended', number>;
  views: number;
  inquiries: { total: number; unread: number };
  favorites_saved: number;
  dealer: {
    id: number;
    business_name: string;
    verification_status: string;
    is_verified: boolean;
    active_listings: number;
  } | null;
  recent_listings: VehicleCard[];
  recent_inquiries: (Inquiry & { vehicle: number })[];
}

export interface HomeFeed {
  stats: { live_listings: number; verified_dealers: number; regions: number };
  featured: VehicleCard[];
  recent: VehicleCard[];
  regions: { region: string; count: number }[];
  body_types: { value: string; label: string; count: number }[];
}

export interface Facets {
  makes: { make: string; count: number }[];
  regions: { region: string; count: number }[];
  bounds: { min_price: number | null; max_price: number | null; min_year: number | null; max_year: number | null };
}

export interface AdminStats {
  users: { total: number; by_role: Record<Role, number>; suspended: number };
  listings: Record<VehicleStatus, number>;
  open_reports: number;
  pending_verifications: number;
  inquiries_total: number;
  inquiries_today: number;
}

export interface AdminReport {
  id: number;
  reason: string;
  reason_label: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
  vehicle: { id: number; title: string; status: VehicleStatus; price_tzs: number };
  reporter_email: string;
}

export interface AdminVerification extends Verification {
  user?: number;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  suspension_reason: string;
  date_joined: string;
  last_login: string | null;
  listings: number;
}

export interface LogEntry {
  id: number;
  vehicle: number;
  vehicle_title: string;
  action: string;
  reason: string;
  moderator: string | null;
  created_at: string;
}
