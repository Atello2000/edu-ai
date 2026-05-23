import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import './Admin.css';

const ACTION_LABELS = {
  summarize: '📄 Résumés', quiz: '❓ Quiz', flashcards: '🃏 Flashcards',
  chat: '💬 Chat', 'exam-sheet': '📝 Fiches examen',
};

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats]       = useState(null);
  const [tokens, setTokens]     = useState(null);
  const [users, setUsers]       = useState([]);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread]     = useState(0);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const check = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!check.ok) {
          const body = await check.json().catch(() => ({}));
          setAccessError(`Erreur ${check.status} — ${body.error || 'Accès refusé'}`);
          setLoading(false);
          return;
        }
        const [sRes, uRes, tRes, mRes] = await Promise.all([
          fetch('/api/admin/stats',    { credentials: 'include' }),
          fetch('/api/admin/users',    { credentials: 'include' }),
          fetch('/api/admin/tokens',   { credentials: 'include' }),
          fetch('/api/admin/messages', { credentials: 'include' }),
        ]);
        const [s, u, t, m] = await Promise.all([sRes.json(), uRes.json(), tRes.json(), mRes.json()]);
        setStats(s);
        setUsers(u.users || []);
        setTokens(t);
        setMessages(m.messages || []);
        setUnread(m.unread || 0);
        setLoading(false);
      } catch (err) {
        setAccessError('Erreur réseau : ' + err.message);
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function setPlan(id, plan) {
    await fetch(`/api/admin/users/${id}/plan`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const [sRes, uRes] = await Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
    ]);
    const [s, u] = await Promise.all([sRes.json(), uRes.json()]);
    setStats(s);
    setUsers(u.users || []);
  }

  async function deleteUser(id, name) {
    if (!confirm(`Supprimer le compte de "${name}" ? Cette action est irréversible.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    const [sRes, uRes] = await Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
    ]);
    const [s, u] = await Promise.all([sRes.json(), uRes.json()]);
    setStats(s);
    setUsers(u.users || []);
  }

  async function markRead(id) {
    await fetch(`/api/admin/messages/${id}/read`, { method: 'PATCH', credentials: 'include' });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function deleteMessage(id) {
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    const deleted = messages.find(m => m.id === id);
    setMessages(prev => prev.filter(m => m.id !== id));
    if (deleted && !deleted.is_read) setUnread(prev => Math.max(0, prev - 1));
  }

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="admin-loading">Chargement…</div>;
  if (accessError) return (
    <div className="admin-loading" style={{flexDirection:'column',gap:'1rem'}}>
      <strong style={{color:'var(--red,#e55)'}}>Accès bloqué</strong>
      <code style={{background:'var(--bg)',padding:'.5rem 1rem',borderRadius:8,fontSize:'.85rem'}}>{accessError}</code>
      <a href="/app" style={{color:'var(--blue)',fontSize:'.85rem'}}>← Retour à l'app</a>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1><Logo /> — Admin</h1>
        <div className="top-actions">
          <input
            className="search-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
          />
          <Link to="/app" className="back-btn">← App</Link>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card blue"><div className="stat-val">{stats.total}</div><div className="stat-lbl">Inscrits total</div></div>
          <div className="stat-card gold"><div className="stat-val">{stats.pro}</div><div className="stat-lbl">Comptes Pro</div></div>
          <div className="stat-card muted"><div className="stat-val">{stats.free}</div><div className="stat-lbl">Comptes Gratuit</div></div>
          <div className="stat-card teal"><div className="stat-val">{stats.active_today}</div><div className="stat-lbl">Actifs aujourd&apos;hui</div></div>
        </div>
      )}

      <div className="section-title">Consommation tokens IA</div>

      {tokens && (
        <>
          <div className="token-grid">
            <div className="stat-card blue"><div className="stat-val">{fmtTokens(tokens.today?.total || 0)}</div><div className="stat-lbl">Tokens aujourd&apos;hui</div></div>
            <div className="stat-card green"><div className="stat-val">{fmtTokens(tokens.allTime?.total || 0)}</div><div className="stat-lbl">Tokens total</div></div>
            <div className="stat-card teal"><div className="stat-val">{fmtTokens(tokens.allTime?.input || 0)}</div><div className="stat-lbl">Input (contexte)</div></div>
            <div className="stat-card purple"><div className="stat-val">{fmtTokens(tokens.allTime?.output || 0)}</div><div className="stat-lbl">Output (généré)</div></div>
          </div>
          <div className="breakdown-row">
            <div className="breakdown-card">
              <h4>Par provider</h4>
              {tokens.byProvider?.length ? tokens.byProvider.map(p => (
                <div className="breakdown-item" key={p.provider}>
                  <span className={p.provider === 'Groq' ? 'provider-groq' : p.provider === 'DeepSeek' ? 'provider-deepseek' : ''} style={{fontWeight:600}}>
                    {p.provider || 'Inconnu'}
                  </span>
                  <span className="breakdown-val">
                    {fmtTokens(Number(p.input||0)+Number(p.output||0))}{' '}
                    <span style={{fontWeight:400,color:'var(--muted)',fontSize:'.76rem'}}>(↑{fmtTokens(Number(p.input||0))} ↓{fmtTokens(Number(p.output||0))})</span>
                  </span>
                </div>
              )) : <span style={{color:'var(--muted)',fontSize:'.82rem'}}>Aucune donnée</span>}
            </div>
            <div className="breakdown-card">
              <h4>Par action</h4>
              {tokens.byAction?.length ? tokens.byAction.map(a => (
                <div className="breakdown-item" key={a.action}>
                  <span>{ACTION_LABELS[a.action] || a.action}</span>
                  <span className="breakdown-val">{fmtTokens(a.total || 0)}</span>
                </div>
              )) : <span style={{color:'var(--muted)',fontSize:'.82rem'}}>Aucune donnée</span>}
            </div>
          </div>
        </>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Nom</th><th>Email</th><th>Plan</th>
              <th>Tokens (total)</th><th>Quota aujourd&apos;hui</th><th>Inscrit le</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" className="empty">Aucun utilisateur.</td></tr>
            ) : filtered.map(u => {
              const planLabel = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' }[u.plan] || u.plan;
              const date = new Date(u.created_at).toLocaleDateString('fr-FR');
              return (
                <tr key={u.id}>
                  <td style={{color:'var(--muted)',fontSize:'.8rem'}}>{u.id}</td>
                  <td><strong dangerouslySetInnerHTML={{__html: esc(u.name)}} /></td>
                  <td style={{color:'var(--muted)',fontSize:'.83rem'}} dangerouslySetInnerHTML={{__html: esc(u.email)}} />
                  <td><span className={`plan-badge plan-${u.plan}`}>{planLabel}</span></td>
                  <td className="token-cell">
                    <span className="token-total">{fmtTokens(Number(u.total_tokens||0))}</span>
                    {Number(u.total_tokens||0) > 0 && (
                      <span className="token-breakdown">↑{fmtTokens(Number(u.input_tokens||0))} ↓{fmtTokens(Number(u.output_tokens||0))}</span>
                    )}
                  </td>
                  <td className="quota-mini">
                    📄 {u.q_summarize} résumés &nbsp;
                    ❓ {u.q_quiz} quiz &nbsp;
                    🃏 {u.q_flashcards} flashcards &nbsp;
                    💬 {u.q_chat} chat
                  </td>
                  <td style={{color:'var(--muted)',fontSize:'.82rem'}}>{date}</td>
                  <td style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                    {u.plan === 'free' && <>
                      <button className="btn-sm promote" onClick={() => setPlan(u.id,'pro')}>↑ Pro</button>
                      <button className="btn-sm promote" style={{color:'var(--purple)',borderColor:'var(--purple)'}} onClick={() => setPlan(u.id,'max')}>↑ Max</button>
                    </>}
                    {u.plan === 'pro' && <>
                      <button className="btn-sm demote" onClick={() => setPlan(u.id,'free')}>↓ Gratuit</button>
                      <button className="btn-sm promote" style={{color:'var(--purple)',borderColor:'var(--purple)'}} onClick={() => setPlan(u.id,'max')}>↑ Max</button>
                    </>}
                    {u.plan === 'max' && <>
                      <button className="btn-sm demote" onClick={() => setPlan(u.id,'free')}>↓ Gratuit</button>
                      <button className="btn-sm demote" onClick={() => setPlan(u.id,'pro')}>↓ Pro</button>
                    </>}
                    <button className="btn-sm danger" onClick={() => deleteUser(u.id, u.name)}>Supprimer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Messages utilisateurs ─────────────────────────────────────────── */}
      <div className="section-title" style={{marginTop:'2rem'}}>
        Messages utilisateurs
        {unread > 0 && <span className="msg-unread-badge">{unread} non lu{unread > 1 ? 's' : ''}</span>}
      </div>

      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="messages-empty">Aucun message pour l&apos;instant.</div>
        ) : messages.map(m => (
          <div key={m.id} className={`msg-card${m.is_read ? ' msg-read' : ' msg-unread'}`}>
            <div className="msg-meta">
              <span className="msg-author">
                <strong dangerouslySetInnerHTML={{__html: esc(m.user_name)}} />
                <span className={`plan-badge plan-${m.user_plan}`} style={{marginLeft:'.4rem'}}>
                  {m.user_plan}
                </span>
              </span>
              <span className="msg-email" dangerouslySetInnerHTML={{__html: esc(m.user_email)}} />
              <span className="msg-date">{new Date(m.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
              <div className="msg-actions">
                {!m.is_read && (
                  <button className="btn-sm promote" title="Marquer comme lu" onClick={() => markRead(m.id)}>✓ Lu</button>
                )}
                <button className="btn-sm danger" title="Supprimer" onClick={() => deleteMessage(m.id)}>✕</button>
              </div>
            </div>
            <div className="msg-body">{m.message}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
