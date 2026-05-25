import { useState, useCallback } from 'react';

export function useGlossary() {
  const [terms,   setTerms]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const generate = useCallback(async (files, lang = 'fr') => {
    if (!files?.length) return;
    setLoading(true);
    setError(null);
    setTerms([]);
    try {
      const res  = await fetch('/api/glossary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setTerms(data.terms || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTerms([]);
    setError(null);
    setLoading(false);
  }, []);

  return { terms, loading, error, generate, reset };
}
