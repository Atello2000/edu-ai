/**
 * CSRF client-side utilities
 *
 * - getCsrfToken()          → lit le cookie jangalai-csrf
 * - fetchCsrfToken()        → appelle GET /api/csrf-token pour (re)générer le token
 * - setupCsrfInterceptors() → patche fetch + XHR pour injecter X-CSRF-Token automatiquement
 */

export function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/** Appelle le serveur pour obtenir/renouveler le token CSRF */
export async function fetchCsrfToken() {
  try {
    const res = await window._origFetch('/api/csrf-token');
    const { token } = await res.json();
    return token;
  } catch {
    return '';
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Installe des intercepteurs globaux sur fetch et XMLHttpRequest.
 * Tout appel vers /api avec une méthode mutante reçoit automatiquement
 * l'en-tête X-CSRF-Token. À appeler UNE SEULE FOIS au démarrage de l'app.
 */
export function setupCsrfInterceptors() {
  // ── Patch fetch ────────────────────────────────────────────────────────
  const origFetch = window.fetch.bind(window);
  window._origFetch = origFetch; // conserve la référence non-patchée pour fetchCsrfToken

  window.fetch = (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (MUTATING_METHODS.has(method) && String(url).startsWith('/api')) {
      opts = {
        ...opts,
        headers: {
          'X-CSRF-Token': getCsrfToken(),
          ...opts.headers, // les headers explicites de l'appelant ont priorité
        },
      };
    }
    return origFetch(url, opts);
  };

  // ── Patch XMLHttpRequest ────────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._csrfMethod = method;
    this._csrfUrl    = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (
      MUTATING_METHODS.has((this._csrfMethod || '').toUpperCase()) &&
      String(this._csrfUrl).startsWith('/api')
    ) {
      origSetHeader.call(this, 'X-CSRF-Token', getCsrfToken());
    }
    return origSend.call(this, body);
  };
}
