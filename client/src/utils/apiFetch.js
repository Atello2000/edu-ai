/**
 * apiFetch — fetch avec token CSRF automatique sur toutes les mutations.
 *
 * Remplace `fetch` pour tous les appels API protégés (POST/PUT/DELETE/PATCH).
 * Lit le cookie `jangalai-csrf` (posé par le serveur à l'auth) et
 * l'envoie dans l'en-tête X-CSRF-Token requis par doubleCsrfProtection.
 */

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (!SAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return fetch(url, { ...options, headers });
}
