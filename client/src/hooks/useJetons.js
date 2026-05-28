import { useState, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';

export function useJetons() {
  const [balance,  setBalance]  = useState(null);
  const [monthly,  setMonthly]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Fonction stable exposée pour refresh externe (ex: eventBus, bouton manuel)
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/jetons');
      if (!res.ok) return;
      const data = await res.json();
      setBalance(data.balance ?? 0);
      setMonthly(data.monthly_allocation ?? null);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;

    // Chargement initial — fonction locale avec flag d'annulation
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch('/api/jetons');
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) {
          setBalance(data.balance ?? 0);
          setMonthly(data.monthly_allocation ?? null);
        }
      } catch { /* silencieux */ }
      finally { if (active) setLoading(false); }
    }

    load();
    const unsub = eventBus.on('quota:refresh', refresh);
    return () => { active = false; unsub?.(); };
  }, [refresh]);

  return { balance, monthly_allocation: monthly, loading, refresh };
}
