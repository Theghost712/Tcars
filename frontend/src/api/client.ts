import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

/** Shared HTTP client for all backend requests. */
export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

export type HealthStatus = {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unavailable';
};

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await api.get<HealthStatus>('health/');
  return response.data;
}
