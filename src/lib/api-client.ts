import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

// Auth calls have no protected-request retry interceptor.
export const apiClient = axios.create({
  baseURL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15_000),
  headers: { 'Content-Type': 'application/json' },
});
