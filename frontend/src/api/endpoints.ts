import { api } from './http';
import type {
  AdminReport,
  AdminStats,
  AdminUser,
  AdminVerification,
  Dashboard,
  Dealer,
  Facets,
  Favorite,
  HomeFeed,
  Inquiry,
  LogEntry,
  Notification,
  Paginated,
  User,
  Verification,
  VehicleCard,
  VehicleDetail,
  VehicleInput,
} from './types';

type Params = Record<string, string | number | boolean | undefined | null>;

function clean(params: Params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

// Auth
export const login = (email: string, password: string) =>
  api.post<{ access: string; refresh: string; user: User }>('auth/login/', { email, password }).then((r) => r.data);

export const register = (payload: { email: string; full_name: string; phone: string; role: string; password: string }) =>
  api.post<User>('auth/register/', payload).then((r) => r.data);

export const logoutRemote = (refresh: string) => api.post('auth/logout/', { refresh });
export const getMe = () => api.get<User>('auth/me/').then((r) => r.data);
export const updateMe = (payload: Partial<User> & { region?: string; city?: string }) =>
  api.patch<User>('auth/me/', payload).then((r) => r.data);
export const changePassword = (old_password: string, new_password: string) =>
  api.post('auth/password/change/', { old_password, new_password }).then((r) => r.data);
export const requestPasswordReset = (email: string) =>
  api.post('auth/password-reset/', { email }).then((r) => r.data);
export const confirmPasswordReset = (uid: string, token: string, new_password: string) =>
  api.post('auth/password-reset/confirm/', { uid, token, new_password }).then((r) => r.data);

// Vehicles
export const getHome = () => api.get<HomeFeed>('vehicles/home/').then((r) => r.data);
export const getFacets = () => api.get<Facets>('vehicles/facets/').then((r) => r.data);
export const searchVehicles = (params: Params) =>
  api.get<Paginated<VehicleCard>>('vehicles/', { params: clean(params) }).then((r) => r.data);
export const getVehicle = (id: number) => api.get<VehicleDetail>(`vehicles/${id}/`).then((r) => r.data);
export const getRelated = (id: number) => api.get<VehicleCard[]>(`vehicles/${id}/related/`).then((r) => r.data);
export const updateVehicle = (id: number, payload: Partial<VehicleInput>) =>
  api.patch<VehicleDetail>(`vehicles/${id}/`, payload).then((r) => r.data);
export const deleteVehicle = (id: number) => api.delete(`vehicles/${id}/`);
export const deleteVehicleImage = (vehicleId: number, imageId: number) =>
  api.delete<VehicleDetail>(`vehicles/${vehicleId}/images/${imageId}/`).then((r) => r.data);
export const uploadVehicleImages = (id: number, files: File[]) => {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  return api.post<VehicleDetail>(`vehicles/${id}/images/`, form).then((r) => r.data);
};
export const createVehicle = (payload: VehicleInput, files: File[]) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) form.append(key, String(value));
  });
  files.forEach((file) => form.append('images', file));
  return api.post<VehicleDetail>('vehicles/', form).then((r) => r.data);
};
export const vehicleAction = (id: number, action: 'mark-sold' | 'renew') =>
  api.post<VehicleDetail>(`vehicles/${id}/actions/${action}/`).then((r) => r.data);
export const reportVehicle = (id: number, reason: string, details: string) =>
  api.post(`vehicles/${id}/report/`, { reason, details }).then((r) => r.data);
export const sendInquiry = (id: number, payload: { name: string; phone: string; email: string; message: string }) =>
  api.post<Inquiry>(`vehicles/${id}/inquiries/`, payload).then((r) => r.data);

// Favourites and inquiries
export const getFavorites = () => api.get<Favorite[]>('favorites/').then((r) => r.data);
export const addFavorite = (vehicleId: number) => api.post('favorites/', { vehicle_id: vehicleId }).then((r) => r.data);
export const removeFavorite = (vehicleId: number) => api.delete(`favorites/${vehicleId}/`);
export const getReceivedInquiries = () => api.get<Paginated<Inquiry>>('inquiries/received/').then((r) => r.data);
export const getSentInquiries = () => api.get<Paginated<Inquiry>>('inquiries/sent/').then((r) => r.data);
export const markInquiryRead = (id: number) => api.post(`inquiries/${id}/read/`).then((r) => r.data);

// Dashboard, notifications
export const getDashboard = () => api.get<Dashboard>('dashboard/').then((r) => r.data);
export const getMyListings = (status?: string) =>
  api.get<Paginated<VehicleCard>>('vehicles/', { params: clean({ mine: 1, status }) }).then((r) => r.data);
export const getNotifications = () =>
  api.get<{ results: Notification[]; unread: number }>('notifications/').then((r) => r.data);
export const markNotificationRead = (id: number) => api.post(`notifications/${id}/read/`);
export const markAllNotificationsRead = () => api.post('notifications/read-all/');

// Dealers and verification
export const getMyDealer = () =>
  api
    .get<Dealer>('dealer/profile/')
    .then((r) => r.data)
    .catch((error) => {
      if (error?.response?.status === 404) return null;
      throw error;
    });
export const createDealer = (payload: Partial<Dealer>) => api.post<Dealer>('dealer/profile/create/', payload).then((r) => r.data);
export const updateDealer = (payload: Partial<Dealer>) => api.patch<Dealer>('dealer/profile/', payload).then((r) => r.data);
export const getDealer = (id: number) => api.get<Dealer>(`dealers/${id}/`).then((r) => r.data);
export const getMyVerifications = () => api.get<Paginated<Verification>>('verifications/').then((r) => r.data);
export const requestVerification = (payload: { kind: string; reference_number: string; details: string }) =>
  api.post<Verification>('verifications/', payload).then((r) => r.data);

// Administration
export const getAdminStats = () => api.get<AdminStats>('admin/stats/').then((r) => r.data);
export const getAdminVehicles = (status: string) =>
  api.get<Paginated<VehicleCard>>('admin/vehicles/', { params: { status } }).then((r) => r.data);
export const adminVehicleAction = (id: number, action: string, body: Record<string, unknown> = {}) =>
  api.post<VehicleCard>(`admin/vehicles/${id}/${action}/`, body).then((r) => r.data);
export const getAdminReports = (status: string) =>
  api.get<Paginated<AdminReport>>('admin/reports/', { params: { status } }).then((r) => r.data);
export const resolveReport = (id: number, action: 'dismiss' | 'remove_listing', note: string) =>
  api.post<AdminReport>(`admin/reports/${id}/resolve/`, { action, note }).then((r) => r.data);
export const getAdminVerifications = (status: string) =>
  api.get<Paginated<AdminVerification>>('admin/verifications/', { params: { status } }).then((r) => r.data);
export const decideVerification = (id: number, decision: 'approve' | 'reject', note: string) =>
  api.post(`admin/verifications/${id}/decide/`, { decision, note }).then((r) => r.data);
export const getAdminUsers = (q: string, role: string) =>
  api.get<Paginated<AdminUser>>('admin/users/', { params: clean({ q, role }) }).then((r) => r.data);
export const updateAdminUser = (id: number, body: { is_active?: boolean; role?: string; suspension_reason?: string }) =>
  api.patch<AdminUser>(`admin/users/${id}/`, body).then((r) => r.data);
export const getAdminLog = () => api.get<LogEntry[]>('admin/log/').then((r) => r.data);
