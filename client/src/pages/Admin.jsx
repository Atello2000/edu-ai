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
  const [stats, setStats]   = useState(null);
  const [tokens, setTokens] = useState(null);
  const [users, setUsers]   = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const check = await fetch('/api/admin/stats');
      if (check.status === 403) { navigate('/app'); return; }
      const [sRes, uRes, tRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/tokens'),
      ]);
      const [s, u, t] = await Promise.all([sRes.json(), uRes.json(), tRes.json()]);
      setStats(s);
      setUsers(u.users || []);
      setTokens(t);
      setLoading(false);
    })();
  }, [navigate]);

  async function setPlan(id, plan) {
    await fetch(`/api/admin/users/${id}/plan`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const [sRes, uRes] = await Promise.all([fetch('/api/admin/stats'), fetch('/api/admin/users')]);
    const [s, u] = await Promise.all([sRes.json(), uRes.json()]);
    setStats(s);
    setUsers(u.users || []);
  }

  async function deleteUser(id, name) {
    if (!confirm(`Supprimer le compte de "${name}" ? Cette action est irréversible.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const [sRes, uRes] = await Promise.all([fetch('/api/admin/stats'), fetch('/api/admin/users')]);
    const [s, u] = await Promise.all([sRes.json(), uRes.json()]);
    setStats(s);
    setUsers(u.users || []);
  }

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="admin-loading">Chargement…</div>;

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
                    {fmtTokens((p.input||0)+(p.output||0))}{' '}
                    <span style={{fontWeight:400,color:'var(--muted)',fontSize:'.76rem'}}>(↑{fmtTokens(p.input||0)} ↓{fmtTokens(p.output||0)})</span>
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
              <th>Quota aujourd&apos;hui</th><th>Inscrit le</th><th>Actions</th>
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
    </div>
  );
}
