import axios, { AxiosError, AxiosRequestHeaders, InternalAxiosRequestConfig } from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore';
import { buildFriendlyApiErrorMessage } from '../utils/formatters';
import { getLocale } from '../i18n';

export type ApiRequestConfig = InternalAxiosRequestConfig & {
  skipAuth?: boolean;
  _retry?: boolean;
};

const resolveBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.desktopRuntime?.isDesktop) {
    return window.desktopRuntime.getApiBaseUrl();
  }

  return import.meta.env.VITE_API_URL ?? '';
};

const baseURL = resolveBaseUrl();

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/auth/refresh')
      .then((response) => {
        const token = response?.data?.data?.token as string | undefined;
        const user = response?.data?.data?.user;
        if (!token) return null;
        setAccessToken(token);
        if (user) {
          window.dispatchEvent(new CustomEvent('auth:refresh', { detail: { token, user } }));
        }
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const cfg = config as ApiRequestConfig;
  cfg.headers = cfg.headers ?? ({} as AxiosRequestHeaders);
  cfg.headers['Accept-Language'] = getLocale();
  if (!cfg.skipAuth) {
    const token = getAccessToken();
    if (token) {
      cfg.headers = cfg.headers ?? ({} as AxiosRequestHeaders);
      cfg.headers.Authorization = `Bearer ${token}`;
    }
  }
  return cfg;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const decorateErrorMessage = (err: AxiosError): void => {
      const backendMessage =
        (err.response?.data as { error?: string } | undefined)?.error || err.message;
      const friendly = buildFriendlyApiErrorMessage(backendMessage, err.response?.status);
      err.message = friendly;
      if (err.response?.data && typeof err.response.data === 'object') {
        (err.response.data as { error?: string }).error = friendly;
      }
    };

    const originalRequest = error.config as ApiRequestConfig | undefined;
    if (!originalRequest || originalRequest._retry || originalRequest.skipAuth) {
      decorateErrorMessage(error);
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      decorateErrorMessage(error);
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const token = await refreshAccessToken();
    if (!token) {
      clearAccessToken();
      decorateErrorMessage(error);
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${token}`;
    return api(originalRequest);
  }
);

export default api;
