import axios from 'axios';

const CACHE_PREFIX = 'api_cache_';
const CACHE_TTL = 120000;

// Rutas que nunca deben cachearse (tiempo real operativo)
const NO_CACHE_PATTERNS = ['/pedidos'];

function shouldBypassCache(url, noCache) {
  if (noCache) return true;
  return NO_CACHE_PATTERNS.some(p => (url || '').includes(p));
}

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
  const token = localStorage.getItem('comercio_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!['get', 'head', 'options'].includes((config.method || '').toLowerCase())) {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    if (match) config.headers['x-csrf-token'] = decodeURIComponent(match[1]);
  }
  return config;
});

let refreshPromise = null;

function cerrarSesion() {
  localStorage.removeItem('comercio_token');
  localStorage.removeItem('comercio_user');
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
  if (shouldBypassCache(url, config?.noCache)) {
    return origGet.call(this, url, config);
  }
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

export const menuImport = {
  upload: (formData) => api.post('/comercios/menu/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  confirm: (data) => api.post('/comercios/menu/confirm', data),
  preview: (urls) => api.get('/comercios/menu/preview', { params: { tempUrls: urls } }),
};

export const comercio = {
  subirLogo: (comercioId, formData) => api.post(`/comercios/${comercioId}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  eliminarLogo: (comercioId) => api.delete(`/comercios/${comercioId}/logo`),
  getIpWhitelist: (comercioId) => api.get(`/comercios/${comercioId}/ip-whitelist`),
  updateIpWhitelist: (comercioId, data) => api.put(`/comercios/${comercioId}/ip-whitelist`, data),
  testIpWhitelist: (comercioId, ip) => api.post(`/comercios/${comercioId}/ip-whitelist/test`, { ip }),
  updateHorarios: (comercioId, data) => api.put(`/comercios/${comercioId}/horarios`, data),
};

export const uploads = {
  uploadBase64: (data) => api.post('/upload/base64', data),
};

export const anuncios = {
  crear: (data) => api.post('/anuncios', data),
  mios: () => api.get('/anuncios/mios', { noCache: true }),
  consultar: (referencia) => api.get(`/anuncios/consultar/${referencia}`, { noCache: true }),
};

export default api;
