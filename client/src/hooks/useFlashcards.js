import { useState, useCallback } from 'react';
import toast from '../utils/toast';
import eventBus from '../utils/eventBus';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

/* ── SM-2 / SRS ─────────────────────────────────────────────────────────────── */
const SRS_KEY = 'jangalai-srs';

function cardHash(front) {
  let h = 0;
  for (let i = 0; i < front.length; i++) h = Math.imul(31, h) + front.charCodeAt(i) | 0;
  return h.toString(36);
}
function getSRSData()  { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}'); }
function setSRSData(d) { localStorage.setItem(SRS_KEY, JSON.stringify(d)); }

export function sm2Update(key, quality) {
  const data = getSRSData();
  const c = data[key] || { interval: 1, easeFactor: 2.5, repetitions: 0 };
  if (quality >= 3) {
    c.interval = c.repetitions === 0 ? 1 : c.repetitions === 1 ? 6 : Math.round(c.interval * c.easeFactor);
    c.repetitions++;
  } else { c.interval = 1; c.repetitions = 0; }
  c.easeFactor = Math.max(1.3, c.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  c.nextReview = Date.now() + c.interval * 86400000;
  data[key] = c; setSRSData(data); return c;
}

export function getSRSStatus(front) {
  const c = getSRSData()[cardHash(front)];
  if (!c) return null;
  if (c.nextReview <= Date.now()) return 'due';
  return (c.nextReview - Date.now()) < 86400000 ? 'soon' : 'learned';
}

export function getSRSLabel(front) {
  const c = getSRSData()[cardHash(front)];
  if (!c) return '';
  if (c.nextReview <= Date.now()) return '● dû';
  const h = Math.round((c.nextReview - Date.now()) / 3600000);
  return h < 24 ? `● ${h}h` : `● ${Math.round(h / 24)}j`;
}

export { cardHash };

/* ── Hook ────────────────────────────────────────────────────────────────────── */

/**
 * Gère la génération et l'état des flashcards.
 *
 * decks        : [{ name, cards: [{ front, back }] }]
 * deckIdx      : index du deck courant
 * cards        : cartes du deck courant (peut être mélangées)
 * cardStates   : { [cardIdx]: 'known'|'review' }
 * srsOnlyDue   : bool
 */
export function useFlashcards() {
  const [decks,      setDecks]      = useState([]);
  const [deckIdx,    setDeckIdx]    = useState(0);
  const [cards,      setCards]      = useState([]);
  const [cardStates, setCardStates] = useState({});
  const [srsOnlyDue, setSrsOnlyDue] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [model,      setModel]      = useState('');

  function reset() {
    setDecks([]); setDeckIdx(0); setCards([]); setCardStates({});
    setSrsOnlyDue(false); setError(null); setModel('');
  }

  function loadDeck(idx, allDecks) {
    const src = allDecks ?? decks;
    if (!src.length) return;
    const i = Math.max(0, Math.min(idx, src.length - 1));
    setDeckIdx(i);
    setCards([...src[i].cards]);
    setCardStates({});
  }

  function restoreFrom(results) {
    const d = results.map(r => ({ name: r.name, cards: r.flashcards || [] }));
    setDecks(d);
    setDeckIdx(0);
    setCards([...(d[0]?.cards || [])]);
    setCardStates({});
  }

  const generate = useCallback(async (files, { count = 10 } = {}) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    try {
      const res = await fetch('/api/flashcards', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, count, lang: getLang() }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      const allDecks   = [];
      const allResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }

          if (data.type === 'done') {
            // Cartes d'un fichier prêtes — créer le deck et l'ajouter
            const deck = { name: data.name, cards: data.cards || [] };
            allDecks.push(deck);
            allResults.push({ name: data.name, flashcards: data.cards || [] });
            setDecks([...allDecks]);
            if (allDecks.length === 1) loadDeck(0, allDecks); // charger le 1er deck dès qu'il arrive
          } else if (data.type === 'end') {
            if (data.model) setModel(data.model);
            if (!allDecks.length) throw new Error('Aucune flashcard générée');
            window.__saveSession?.({ flashcards: allResults });
            eventBus.emit('quota:refresh');
            eventBus.emit('nav:section', 'flashcard-section');
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function markCard(cardIdx, state) {
    setCardStates(prev => ({ ...prev, [cardIdx]: state }));
    const front = cards[cardIdx]?.front;
    if (front) sm2Update(cardHash(front), state === 'known' ? 4 : 1);
  }

  function shuffle() {
    setCards(prev => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    setCardStates({});
  }

  function restart()   { setCardStates({}); }

  function redoWrong() {
    const wrongIdxs = Object.entries(cardStates)
      .filter(([, s]) => s === 'review').map(([i]) => +i);
    if (!wrongIdxs.length) { toast.info('Aucune carte à revoir !'); return; }
    setCards(wrongIdxs.map(i => cards[i]));
    setCardStates({});
  }

  function switchDeck(i) { loadDeck(i, decks); }

  function toggleSrs() { setSrsOnlyDue(v => !v); }

  return {
    decks, deckIdx, cards, cardStates, srsOnlyDue,
    loading, error, model,
    generate, reset, restoreFrom,
    markCard, shuffle, restart, redoWrong, switchDeck, toggleSrs,
  };
}
