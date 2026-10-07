export function getCsrfToken() {
  const name = 'csrf_token=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
  }
  return '';
}

export function useApi() {
  const baseUrl = import.meta.env.VITE_API_URL || '/api';

  async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'X-CSRF-Token': getCsrfToken(),
      ...options.headers,
    };

    const res = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    });

    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch {
        errorData = { error: `Error ${res.status}` };
      }
      const error = new Error(errorData.error || `HTTP ${res.status}`);
      error.status = res.status;
      error.data = errorData;
      throw error;
    }

    if (res.status === 204) return null;
    return res.json();
  }

  return {
    get: (url) => request(url),
    post: (url, data) => request(url, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    put: (url, data) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
    patch: (url, data) => request(url, { method: 'PATCH', body: JSON.stringify(data) }),
    del: (url) => request(url, { method: 'DELETE' }),
  };
}