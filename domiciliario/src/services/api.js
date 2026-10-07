import axios from 'axios';

const CACHE_PREFIX = 'api_cache_';
const CACHE_TTL = 120000;

function getCacheKey(url, params) {
  return CACHE_PREFIX + url + JSON.stringify(params || {});
}

const inflight = new Map();

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL }));
  } catch {}
}

export function clearCache(pattern) {
  const keys = Object.keys(localStorage).filter(k =>
    k.startsWith(CACHE_PREFIX) && (!pattern || k.includes(pattern))
  );
  keys.forEach(k => localStorage.removeItem(k));
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('domiciliario_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

function cerrarSesion() {
  localStorage.removeItem('domiciliario_token');
  localStorage.removeItem('domiciliario_user');
  window.location.href = '/login';
}

api.interceptors.response.use(
  response => {
    if (response.config?.method !== 'get') {
      clearCache();
    }
    return response;
  },
  async error => {
    if (error.response?.status === 401) {
      const original = error.config || {};
      const url = original.url || '';
      if (!original._retry && !url.includes('/auth/')) {
        original._retry = true;
        try {
          if (!refreshPromise) {
            refreshPromise = axios.post('/api/auth/refresh').finally(() => { refreshPromise = null; });
          }
          await refreshPromise;
          return api(original);
        } catch {
          cerrarSesion();
        }
      } else {
        cerrarSesion();
      }
    }
    if (error.response?.status === 429) {
      console.warn('Demasiadas solicitudes. Intente más tarde.');
    }
    return Promise.reject(error);
  }
);

const origGet = api.get;
api.get = async function(url, config) {
  const cacheKey = getCacheKey(url, config?.params);

  const cached = getCached(cacheKey);
  if (cached) return { data: cached, status: 200, statusText: 'OK', headers: {}, config };

  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const promise = origGet.call(this, url, config).then(res => {
    setCache(cacheKey, res.data);
    return res;
  });
  inflight.set(cacheKey, promise);
  promise.finally(() => { if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey); });
  return promise;
};

export const auth = {
  login: (data) => api.post('/auth/login', data),
  updateFcmToken: (fcmToken) => api.put('/auth/fcm-token', { fcmToken }),
  recoverPassword: (email, turnstileToken) => api.post('/auth/recover-password', { email, turnstileToken }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
};

export const mandados = {
  getAll: () => api.get('/mandados', { noCache: true }),
  tomar: (id) => api.put(`/mandados/${id}/tomar`),
  entregar: (id) => api.put(`/mandados/${id}/entregar`),
};

export default api;
