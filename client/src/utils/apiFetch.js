/**
 * apiFetch — fetch avec token CSRF automatique sur toutes les mutations.
 *
 * Lit le cookie `jangalai-csrf`. Si absent (session existante après rechargement),
 * appelle /api/csrf-token pour le récupérer avant d'envoyer la requête.
 */

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function ensureCsrfToken() {
  const existing = getCsrfToken();
  if (existing) return existing;
  try {
    const res = await fetch('/api/csrf-token');
    if (res.ok) {
      const data = await res.json();
      return data.token ?? getCsrfToken();
    }
  } catch { /* silencieux */ }
  return null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const pendingRequests = new Map();

export async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  const credentials = options.credentials || 'include';

  if (!SAFE_METHODS.has(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    return fetch(url, { ...options, headers, credentials });
  }

  // GET / HEAD / OPTIONS request deduplication
  const cacheKey = `${method}:${url}:${JSON.stringify(headers)}:${credentials}`;
  if (pendingRequests.has(cacheKey)) {
    const promise = pendingRequests.get(cacheKey);
    const res = await promise;
    return res.clone();
  }

  const promise = fetch(url, { ...options, headers, credentials });
  pendingRequests.set(cacheKey, promise);

  try {
    const res = await promise;
    pendingRequests.delete(cacheKey);
    return res.clone();
  } catch (err) {
    pendingRequests.delete(cacheKey);
    throw err;
  }
}
