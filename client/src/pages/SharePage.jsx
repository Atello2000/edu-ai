import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Logo from '../components/Logo.jsx';
import './SharePage.css';

export default function SharePage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/share/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ loading: false, error: data.error || 'Lien invalide ou expiré.', data: null });
          return;
        }
        setState({ loading: false, error: null, data });
      } catch {
        if (!cancelled) setState({ loading: false, error: 'Impossible de charger ce contenu.', data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const results = Array.isArray(state.data?.content) ? state.data.content : [];

  return (
    <div className="share-page">
      <header className="share-header">
        <Link to="/" className="share-logo"><Logo size={28} /></Link>
        <Link to="/login?tab=register" className="share-cta">Essayer Jangalai gratuitement →</Link>
      </header>

      <main className="share-content">
        {state.loading && <p className="share-status">Chargement…</p>}

        {state.error && (
          <div className="share-error">
            <h1>Lien indisponible</h1>
            <p>{state.error}</p>
            <p>Les liens de partage Jangalai expirent automatiquement au bout de 7 jours.</p>
            <Link to="/" className="share-btn">Découvrir Jangalai</Link>
          </div>
        )}

        {state.data && (
          <>
            <p className="share-kicker">Résumé partagé via Jangalai</p>
            <h1 className="share-title">{state.data.title || 'Résumé'}</h1>
            {results.map((r, i) => (
              <article key={i} className="share-card">
                {results.length > 1 && <h2 className="share-card-name">{(r.name || `Document ${i + 1}`).replace(/\.[^.]+$/, '')}</h2>}
                <div
                  className="share-markdown"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(window.marked?.parse(r.summary || '') ?? (r.summary || '')),
                  }}
                />
              </article>
            ))}
            <div className="share-footer-cta">
              <p>Ce résumé a été généré par IA à partir d'un cours sur <strong>Jangalai</strong>.</p>
              <Link to="/login?tab=register" className="share-btn">Créer mon compte gratuit</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
