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

async function ensureCsrfToken() {
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

export async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (!SAFE_METHODS.has(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}
