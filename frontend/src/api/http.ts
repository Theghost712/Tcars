import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
const STORAGE_KEY = 'tcm.tokens';

export type Tokens = { access: string; refresh: string };

/** Tokens live in this browser only. Storage can be unavailable (private mode), so every access is guarded. */
export function loadTokens(): Tokens | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens | null): void {
  try {
    if (tokens) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the user simply has to sign in again next time */
  }
}

export const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const tokens = loadTokens();
  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens?.refresh) return null;
  try {
    const response = await axios.post(`${baseURL}/auth/token/refresh/`, { refresh: tokens.refresh });
    const next: Tokens = { access: response.data.access, refresh: response.data.refresh ?? tokens.refresh };
    saveTokens(next);
    return next.access;
  } catch {
    saveTokens(null);
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/') ?? false;
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

/** Turns DRF error payloads into one readable sentence. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const response = (error as AxiosError)?.response;
  if (!response) {
    return (error as AxiosError)?.code === 'ECONNABORTED'
      ? 'The server took too long to respond. Please try again.'
      : 'Cannot reach the server. Check your connection and try again.';
  }
  if (response.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (response.status >= 500) return 'The server ran into a problem. Please try again shortly.';
  const data = response.data as unknown;
  if (typeof data === 'string') return fallback;
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (typeof body.detail === 'string') return body.detail;
    const messages: string[] = [];
    for (const [field, value] of Object.entries(body)) {
      const text = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : '';
      if (text) messages.push(field === 'non_field_errors' ? text : `${humanize(field)}: ${text}`);
    }
    if (messages.length) return messages.join(' · ');
  }
  return fallback;
}

function humanize(field: string): string {
  const text = field.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
