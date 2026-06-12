import axios from 'axios';
import { API_DOMAIN } from './index';
import { getToken, getRefresh, setToken, setRefresh, removeAuth } from './auth';

let isRefreshing = false;
let failedQueue: any[] = [];

const api = axios.create({
  baseURL: API_DOMAIN,
  headers: {
    'Content-Type': 'application/json',
  },
});

const processQueue = (error: any, token = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.request.use((config: any) => {
  const newConfig = { ...config };
  newConfig.headers.Authorization = `Bearer ${getToken()}`;
  return newConfig;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isCancel(error)) {
      const originalRequest = error.config;
      const handleError = (): void => {
        // TODO: Check total of url paths that will privates.
        if (
          window.location.pathname.includes('curso') ||
          window.location.pathname.includes('prueba')
        ) {
          window.location.href = '/login';
        }
      };

      if (!originalRequest._retry && error?.response?.status === 401) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(async (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return await api(originalRequest);
            })
            .catch(async (err) => await Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        return new Promise((resolve, reject) => {
          axios
            .post(`${API_DOMAIN}/api/auth/refresh/`, {
              refresh: getRefresh(),
            })
            .then((response: any) => {
              originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
              setToken(response.data.access);
              // ROTATE_REFRESH_TOKENS is on server-side: each refresh returns
              // a NEW refresh token and blacklists the old one. Store the
              // rotated token or the next silent refresh gets a 401. If the
              // response unexpectedly has no refresh field, keep the current one.
              if (response.data.refresh) {
                setRefresh(response.data.refresh);
              }
              processQueue(null, response.data.access);
              resolve(api(originalRequest));
            })
            .catch((err) => {
              console.log('~~~ERROR API_DOMAIN', err.response.data.code);
              if (err.response.data.code === 'token_not_valid') {
                removeAuth();
                window.location.href = '/login';
              }
              processQueue(err, null);
              handleError();
              reject(err);
            })
            .finally(() => {
              isRefreshing = false;
            });
        });
      }
      return error?.response;
    }
    return null;
  },
);

/**
 * Best-effort server-side logout: blacklists the current refresh token via
 * POST /api/auth/logout/ so it cannot be reused after the user logs out.
 * Never throws — local token cleanup must proceed even if revocation fails
 * (network error, token already expired/blacklisted).
 */
export const revokeRefreshToken = async (): Promise<void> => {
  const refresh = getRefresh();
  if (!refresh) return;
  try {
    await api.post('/api/auth/logout/', { refresh });
  } catch {
    // Best-effort only — the caller clears local tokens regardless.
  }
};

export default api;
