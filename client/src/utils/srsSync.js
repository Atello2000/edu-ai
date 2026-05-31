/**
 * srsSync — synchronisation bidirectionnelle localStorage ↔ PostgreSQL
 *
 * Stratégie :
 *  - localStorage = cache local immédiat (lectures rapides, offline)
 *  - PostgreSQL = source de vérité persistante (multi-appareil, anti-perte)
 *  - Résolution de conflits : updated_at le plus récent gagne
 *
 * API :
 *  initSrsSync()             → charge le DB au login, fusionne avec localStorage
 *  queueSrsUpdate(hash, data) → ajoute une mise à jour à la file, sync debounced
 *  flushSrsSync()            → sync immédiate (avant navigation/fermeture)
 *  getDbDueCount()           → nb de cartes dues selon le DB (> localStorage)
 */

const SRS_KEY = 'jangalai-srs';
const DEBOUNCE_MS = 3000;

let syncTimer     = null;
const pendingUpdates = new Map(); // hash → cardData

// ── Lecture / écriture localStorage ──────────────────────────────────────────

function getLocal() {
  try { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}'); } catch { return {}; }
}
function setLocal(data) {
  try { localStorage.setItem(SRS_KEY, JSON.stringify(data)); } catch { /* best-effort */ }
}

// ── Initialisation : DB → localStorage (au login) ────────────────────────────

export async function initSrsSync() {
  try {
    const res = await fetch('/api/srs');
    if (!res.ok) return;
    const { cards } = await res.json();
    if (!cards?.length) return;

    const local = getLocal();
    let changed = false;

    for (const card of cards) {
      const lc = local[card.hash];
      // Le DB gagne si son updated_at est plus récent OU si la carte est absente en local
      if (!lc || (card.updatedAt || 0) > (lc.updatedAt || 0)) {
        local[card.hash] = {
          interval:    card.interval,
          easeFactor:  card.easeFactor,
          repetitions: card.repetitions,
          nextReview:  card.nextReview,
          front:       card.front,
          back:        card.back,
          updatedAt:   card.updatedAt,
        };
        changed = true;
      }
    }
    if (changed) setLocal(local);
  } catch {
    // Silencieux — localStorage reste la source si le réseau est absent
  }
}

// ── File d'attente + debounce ─────────────────────────────────────────────────

export function queueSrsUpdate(hash, cardData) {
  pendingUpdates.set(hash, { ...cardData, updatedAt: Date.now() });

  // Mettre à jour updated_at dans localStorage aussi
  const local = getLocal();
  if (local[hash]) {
    local[hash].updatedAt = Date.now();
    setLocal(local);
  }

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSrsSync, DEBOUNCE_MS);
}

export async function flushSrsSync() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (!pendingUpdates.size) return;

  const cards = Array.from(pendingUpdates.entries()).map(([hash, data]) => ({
    hash,
    interval:    data.interval    || 1,
    easeFactor:  data.easeFactor  || 2.5,
    repetitions: data.repetitions || 0,
    nextReview:  data.nextReview  || 0,
    front:       data.front       || '',
    back:        data.back        || '',
    updatedAt:   data.updatedAt   || Date.now(),
  }));

  pendingUpdates.clear();

  try {
    const csrf = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/)?.[1];
    await fetch('/api/srs/sync', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
      },
      body:    JSON.stringify({ cards }),
    });
  } catch {
    // Si la sync échoue, remettre dans la file pour la prochaine tentative
    for (const c of cards) pendingUpdates.set(c.hash, c);
  }
}

// ── Nombre de cartes dues depuis le DB ───────────────────────────────────────

export async function getDbDueCount() {
  try {
    const res = await fetch('/api/srs/due-count');
    if (!res.ok) return null;
    const { count } = await res.json();
    return count;
  } catch {
    return null; // fallback sur localStorage dans useStudyPlan
  }
}

// Flush automatique avant fermeture de l'onglet
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushSrsSync());
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSrsSync();
  });
}
