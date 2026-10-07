import axios from 'axios';

const CACHE_PREFIX = 'api_cache_';
const CACHE_TTL = 15000;

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
  const token = localStorage.getItem('token');
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
  localStorage.removeItem('token');
  localStorage.removeItem('user');
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
      // Renovar sesión una vez antes de sacarlo (el access dura 15 min, el refresh 7 días)
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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (payload) => api.post('/auth/google', payload),
  recoverPassword: (email, turnstileToken) => api.post('/auth/recover-password', { email, turnstileToken }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  updateFcmToken: (fcmToken) => api.put('/auth/fcm-token', { fcmToken }),
};

export const users = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  eliminarCuenta: (id) => api.delete(`/users/${id}/eliminar-cuenta`),
  verificarCodigoFirebase: (id, data) => api.post(`/users/${id}/sms/verificar-firebase`, data),
};

export const comercios = {
  getAll: () => api.get('/comercios'),
  getById: (id) => api.get(`/comercios/${id}`),
  solicitarRegistro: (data) => api.post('/solicitudes/registro-comercio', data),
  analizarCarta: (cartaImagen, turnstileToken) => api.post('/solicitudes/analizar-carta', { cartaImagen, turnstileToken }, { timeout: 60000 }),
};

export const productos = {
  getAll: () => api.get('/productos'),
  getByComercio: (comercioId) => api.get(`/productos/comercio/${comercioId}`),
};

export const categorias = {
  getAll: () => api.get('/categorias'),
};

export const subcategorias = {
  getAll: () => api.get('/subcategorias'),
  getByCategoria: (categoriaId) => api.get(`/subcategorias/categoria/${categoriaId}`),
};

export const pedidos = {
  getAll: () => api.get('/pedidos'),
  getById: (id) => api.get(`/pedidos/${id}`),
  create: (data) => api.post('/pedidos', data),
};

export const calificaciones = {
  getByComercio: (comercioId) => api.get(`/calificaciones/comercio/${comercioId}`),
  create: (data) => api.post('/calificaciones', data),
};

export const notificaciones = {
  getByUser: () => api.get('/notificaciones'),
  marcarLeida: (id) => api.put(`/notificaciones/${id}/leida`),
};

export const cupones = {
  getAll: () => api.get('/cupones'),
  validar: (data) => api.post('/cupones/validar', data),
};

export const pagos = {
  generarEnlace: (data) => api.post('/pagos/generar-enlace', data),
  crearTransaccion: (data) => api.post('/pagos/crear-transaccion', data),
  consultarTransaccion: (referencia, txId) => api.get(`/pagos/referencia/${referencia}`, { params: txId ? { tx: txId } : {} }),
};

export const promociones = {
  getAll: () => api.get('/promociones'),
};

export const servicios = {
  getAll: () => api.get('/servicios'),
  getById: (id) => api.get(`/servicios/${id}`),
  registroProveedor: (data) => api.post('/servicios/registro', data),
};

export const verificacion = {
  enviarCodigoEmail: (email) => api.post('/verificacion/email/enviar', { email }),
  confirmarCodigoEmail: (email, codigo) => api.post('/verificacion/email/confirmar', { email, codigo }),
  confirmarSms: (idToken) => api.post('/verificacion/sms/confirmar', { idToken }),
};

export const solicitudes = {
  registroDomiciliario: (data) => api.post('/solicitudes/registro-domiciliario', data),
};

export const mandados = {
  create: (data) => api.post('/mandados', data),
};

export const menuImport = {
  upload: (formData) => api.post('/comercios/menu/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  confirm: (data) => api.post('/comercios/menu/confirm', data),
  preview: (urls) => api.get('/comercios/menu/preview', { params: { tempUrls: urls } }),
};

export const uploads = {
  uploadBase64: (data) => api.post('/upload/base64', data),
};

export default api;
