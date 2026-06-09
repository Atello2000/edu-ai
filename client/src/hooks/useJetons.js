import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';

// Coûts par défaut (fallback si l'API est indisponible)
const DEFAULT_COSTS = {
  summarize: 3, quiz: 2, flashcards: 2, chat: 1,
  'exam-sheet': 3, glossary: 2, mindmap: 2, session: 7,
  socratic: 1, predict: 2, 'study-plan': 1, 'error-analysis': 1, compare: 4,
};

export function useJetons() {
  const [balance,  setBalance]  = useState(null);
  const [monthly,  setMonthly]  = useState(null);
  const [costs,    setCosts]    = useState(DEFAULT_COSTS);
  const [chunkSizes, setChunkSizes] = useState({});
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  // Fonction stable exposée pour refresh externe (ex: eventBus, bouton manuel)
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/jetons');
      if (!res.ok) return;
      const data = await res.json();
      setBalance(data.balance ?? 0);
      setMonthly(data.monthly_allocation ?? null);
      if (data.costs) setCosts(prev => ({ ...DEFAULT_COSTS, ...data.costs, session: prev.session }));
      if (data.chunkSizes) setChunkSizes(data.chunkSizes);
      setHistory(data.history ?? []);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        // Charger les coûts publics d'abord (pas d'auth requise)
        const pricesRes = await apiFetch('/api/jetons/prices');
        if (pricesRes.ok && active) {
          const p = await pricesRes.json();
          setCosts({ ...DEFAULT_COSTS, ...p.costs, session: p.session ?? DEFAULT_COSTS.session });
          if (p.chunkSizes) setChunkSizes(p.chunkSizes);
        }
        // Puis charger le solde utilisateur
        const res  = await apiFetch('/api/jetons');
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) {
          setBalance(data.balance ?? 0);
          setMonthly(data.monthly_allocation ?? null);
          if (data.costs) setCosts(prev => ({ ...prev, ...data.costs }));
          if (data.chunkSizes) setChunkSizes(data.chunkSizes);
          setHistory(data.history ?? []);
        }
      } catch { /* silencieux */ }
      finally { if (active) setLoading(false); }
    }

    load();
    const unsub = eventBus.on('quota:refresh', refresh);
    return () => { active = false; unsub?.(); };
  }, [refresh]);

  return { balance, monthly_allocation: monthly, costs, chunkSizes, history, loading, refresh };
}
