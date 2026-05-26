import { useState, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';

export function useJetons() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/jetons');
      if (!res.ok) return;
      const data = await res.json();
      setBalance(data.balance ?? 0);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = eventBus.on('quota:refresh', refresh);
    return () => unsub?.();
  }, [refresh]);

  return { balance, loading, refresh };
}
