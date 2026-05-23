import { useState, useEffect } from 'react';

const ITEMS = [
  { k: 'summarize',  label: 'Résumés' },
  { k: 'quiz',       label: 'Quiz' },
  { k: 'flashcards', label: 'Flashcards' },
  { k: 'chat',       label: 'Chat' },
];

export default function QuotaBar() {
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res  = await fetch('/api/quota');
        const data = await res.json();
        if (active) setQuota(data);
      } catch {
        if (active) setQuota(null);
      }
    }

    load();
    // Exposé comme bridge pour que les hooks AI déclenchent un refresh
    window.__fetchQuota = load;
    return () => {
      active = false;
      delete window.__fetchQuota;
    };
  }, []);

  if (!quota || quota.unlimited) return null;

  return (
    <div className="quota-bar">
      {ITEMS.map(({ k, label }) => {
        const { used = 0, limit = 0 } = quota[k] || {};
        const left = limit - used;
        const cls  = left === 0 ? 'quota-empty' : left <= Math.max(1, Math.floor(limit * 0.2)) ? 'quota-low' : 'quota-ok';
        return (
          <span key={k} className={`quota-item ${cls}`}>
            {label} <strong>{left}/{limit}</strong>
          </span>
        );
      })}
    </div>
  );
}
