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

  // ── Gestion des jetons ─────────────────────────────────────────────────────
  const [jetonUsers,   setJetonUsers]   = useState([]);
  const [jetonAmounts, setJetonAmounts] = useState({});   // { userId: string }
  const [jetonNotes,   setJetonNotes]   = useState({});   // { userId: string }
  const [jetonBusy,    setJetonBusy]    = useState({});   // { userId: bool }
  const [jetonFeedback,setJetonFeedback]= useState({});   // { userId: msg }
  const [jetonSearch,  setJetonSearch]  = useState('');

  // ── AI config ──────────────────────────────────────────────────────────────
  const [aiConfig,     setAiConfig]     = useState(null);  // { provider, model, providers }
  const [aiSaving,     setAiSaving]     = useState(false);
  const [aiSaved,      setAiSaved]      = useState(false);
  const [aiDraft,      setAiDraft]      = useState({ provider: '', model: '' });

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
        const [sRes, uRes, tRes, mRes, aRes] = await Promise.all([
          fetch('/api/admin/stats',     { credentials: 'include' }),
          fetch('/api/admin/users',     { credentials: 'include' }),
          fetch('/api/admin/tokens',    { credentials: 'include' }),
          fetch('/api/admin/messages',  { credentials: 'include' }),
          fetch('/api/admin/ai-config', { credentials: 'include' }),
        ]);
        const [s, u, t, m, a, j] = await Promise.all([
          sRes.json(), uRes.json(), tRes.json(), mRes.json(), aRes.json(),
          fetch('/api/admin/jetons', { credentials: 'include' }).then(r => r.json()),
        ]);
        setStats(s);
        setUsers(u.users || []);
        setTokens(t);
        setMessages(m.messages || []);
        setUnread(m.unread || 0);
        setAiConfig(a);
        setAiDraft({ provider: a.provider, model: a.model });
        setJetonUsers(j.users || []);
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

  async function saveAiConfig() {
    setAiSaving(true);
    await fetch('/api/admin/ai-config', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiDraft),
    });
    setAiConfig(prev => ({ ...prev, ...aiDraft }));
    setAiSaving(false);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2500);
  }

  async function refreshJetonUsers() {
    const r = await fetch('/api/admin/jetons', { credentials: 'include' });
    const d = await r.json();
    setJetonUsers(d.users || []);
  }

  async function adjustJetons(userId, signed) {
    const raw = jetonAmounts[userId];
    const n   = parseInt(raw, 10);
    if (!raw || isNaN(n) || n <= 0) return;
    const amount = signed * n;
    const note   = jetonNotes[userId] || '';
    setJetonBusy(p => ({ ...p, [userId]: true }));
    try {
      await fetch(`/api/admin/users/${userId}/jetons`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
      });
      const msg = signed > 0 ? `+${n} distribués ✓` : `-${n} débités ✓`;
      setJetonFeedback(p => ({ ...p, [userId]: msg }));
      setJetonAmounts(p => ({ ...p, [userId]: '' }));
      setTimeout(() => setJetonFeedback(p => ({ ...p, [userId]: '' })), 2500);
      await refreshJetonUsers();
    } finally {
      setJetonBusy(p => ({ ...p, [userId]: false }));
    }
  }

  async function setExactJetons(userId, balance) {
    if (balance === '' || isNaN(Number(balance))) return;
    setJetonBusy(p => ({ ...p, [userId]: true }));
    try {
      await fetch(`/api/admin/users/${userId}/jetons`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: Number(balance) }),
      });
      setJetonFeedback(p => ({ ...p, [userId]: `Solde → ${balance} ✓` }));
      setTimeout(() => setJetonFeedback(p => ({ ...p, [userId]: '' })), 2500);
      await refreshJetonUsers();
    } finally {
      setJetonBusy(p => ({ ...p, [userId]: false }));
    }
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

      <div className="admin-section-title">Consommation tokens IA</div>

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

      {/* ── Configuration IA ──────────────────────────────────────────────── */}
      <div className="admin-section-title" style={{marginTop:'2rem'}}>Ma configuration IA <span style={{fontSize:'.72rem',fontWeight:400,color:'var(--muted)',marginLeft:'.4rem'}}>(compte admin uniquement)</span></div>

      {aiConfig && (
        <div className="ai-config-card">
          <div className="ai-config-row">
            <div className="ai-config-field">
              <label className="ai-config-label">Provider</label>
              <div className="ai-provider-grid">
                {aiConfig.providers.map(p => (
                  <button
                    key={p.id}
                    className={`ai-provider-btn${aiDraft.provider === p.id ? ' active' : ''}${!p.available ? ' unavailable' : ''}`}
                    onClick={() => {
                      if (!p.available) return;
                      const firstModel = p.models[0].id;
                      setAiDraft({ provider: p.id, model: firstModel });
                    }}
                    title={!p.available ? 'Clé API non configurée dans .env' : ''}
                  >
                    <span className="ai-provider-name">{p.label}</span>
                    {!p.available && <span className="ai-provider-lock">clé manquante</span>}
                    {p.available && aiDraft.provider === p.id && (
                      <span className="ai-provider-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-config-field">
              <label className="ai-config-label">Modèle</label>
              <div className="ai-model-list">
                {(aiConfig.providers.find(p => p.id === aiDraft.provider)?.models || []).map(m => (
                  <button
                    key={m.id}
                    className={`ai-model-btn${aiDraft.model === m.id ? ' active' : ''}`}
                    onClick={() => setAiDraft(d => ({ ...d, model: m.id }))}
                  >
                    <span className="ai-model-name">{m.label}</span>
                    <span className="ai-model-id">{m.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-config-footer">
            <span className="ai-config-current">
              Actif&nbsp;: <strong>{aiConfig.provider}</strong> / <code>{aiConfig.model}</code>
            </span>
            <button
              className="ai-save-btn"
              onClick={saveAiConfig}
              disabled={aiSaving || (aiDraft.provider === aiConfig.provider && aiDraft.model === aiConfig.model)}
            >
              {aiSaving ? 'Enregistrement…' : aiSaved ? '✓ Enregistré' : 'Appliquer'}
            </button>
          </div>
        </div>
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

      {/* ── Gestion des jetons ───────────────────────────────────────────── */}
      <div className="admin-section-title" style={{marginTop:'2rem'}}>
        Gestion des jetons
        <span style={{fontSize:'.7rem',fontWeight:400,color:'var(--muted)',marginLeft:'.5rem'}}>
          — distribuer / débiter / fixer le solde
        </span>
      </div>

      <div className="jeton-admin-toolbar">
        <input
          className="search-input"
          type="text"
          value={jetonSearch}
          onChange={e => setJetonSearch(e.target.value)}
          placeholder="Filtrer un utilisateur…"
          style={{ width: 220 }}
        />
        <span className="jeton-admin-legend">
          <span className="ja-chip ja-chip-add">+ Distribuer</span>
          <span className="ja-chip ja-chip-sub">− Débiter</span>
          <span className="ja-chip ja-chip-set">= Fixer</span>
        </span>
      </div>

      <div className="jeton-admin-grid">
        {jetonUsers
          .filter(u => !jetonSearch ||
            u.name.toLowerCase().includes(jetonSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(jetonSearch.toLowerCase()))
          .map(u => {
            const planLabel = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' }[u.plan] || u.plan;
            const amt   = jetonAmounts[u.id] || '';
            const busy  = !!jetonBusy[u.id];
            const fb    = jetonFeedback[u.id] || '';
            const isAdd = fb.startsWith('+');
            const isSub = fb.startsWith('-');
            return (
              <div key={u.id} className="ja-card">
                {/* Identité */}
                <div className="ja-user">
                  <span className="ja-avatar">{u.name.charAt(0).toUpperCase()}</span>
                  <div className="ja-user-info">
                    <strong className="ja-name">{u.name}</strong>
                    <span className="ja-email">{u.email}</span>
                  </div>
                  <span className={`plan-badge plan-${u.plan}`} style={{marginLeft:'auto'}}>{planLabel}</span>
                </div>

                {/* Solde actuel */}
                <div className="ja-balance-row">
                  <span className="ja-balance-label">Solde actuel</span>
                  <span className="ja-balance-val">{u.jetons} jeton{u.jetons !== 1 ? 's' : ''}</span>
                  <span className="ja-spent">
                    {Number(u.total_spent) > 0 && `(−${u.total_spent} consommés ce mois)`}
                  </span>
                </div>

                {/* Contrôles */}
                <div className="ja-controls">
                  <input
                    className="ja-input"
                    type="number"
                    min="1"
                    value={amt}
                    placeholder="Quantité"
                    disabled={busy}
                    onChange={e => setJetonAmounts(p => ({ ...p, [u.id]: e.target.value }))}
                  />
                  <button
                    className="ja-btn ja-btn-add"
                    disabled={busy || !amt}
                    onClick={() => adjustJetons(u.id, +1)}
                    title="Distribuer des jetons"
                  >+ Don</button>
                  <button
                    className="ja-btn ja-btn-sub"
                    disabled={busy || !amt}
                    onClick={() => adjustJetons(u.id, -1)}
                    title="Débiter des jetons"
                  >− Débit</button>
                  <button
                    className="ja-btn ja-btn-set"
                    disabled={busy || !amt}
                    onClick={() => setExactJetons(u.id, amt)}
                    title="Fixer le solde exact"
                  >= Fix</button>
                </div>

                {/* Note optionnelle */}
                <input
                  className="ja-note"
                  type="text"
                  placeholder="Note (optionnel)…"
                  value={jetonNotes[u.id] || ''}
                  disabled={busy}
                  onChange={e => setJetonNotes(p => ({ ...p, [u.id]: e.target.value }))}
                />

                {/* Feedback */}
                {fb && (
                  <div className={`ja-feedback${isAdd ? ' ja-ok' : isSub ? ' ja-warn' : ' ja-ok'}`}>
                    {fb}
                  </div>
                )}
              </div>
            );
          })
        }
        {jetonUsers.length === 0 && (
          <div className="ja-empty">Aucun utilisateur à gérer.</div>
        )}
      </div>

      {/* ── Messages utilisateurs ─────────────────────────────────────────── */}
      <div className="admin-section-title" style={{marginTop:'2rem'}}>
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
