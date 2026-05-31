import { useState, useEffect } from 'react';
import toast from '../utils/toast';
import { useConfirm } from './ConfirmModal';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePush } from '../hooks/usePush.js';
import eventBus from '../utils/eventBus';
import Logo from './Logo.jsx';

const PREFS_KEY      = 'jangalai-prefs';
const HISTORY_KEY    = 'jangalai-sessions';
const QUIZ_STATS_KEY = 'jangalai-quiz-stats';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };

function getPrefs() { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export default function SettingsDrawer({ isOpen, onClose, onResetOnboarding }) {
  const { user } = useAuth();
  const confirm  = useConfirm();
  const { subscribed: pushSubscribed, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePush();
  const [theme,        setTheme]        = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const [reduceMotion, setReduceMotion] = useState(() => !!getPrefs().reduceMotion);
  const [lang,         setLang]         = useState(() => getPrefs().lang || 'fr');
  const [quizCount,    setQuizCount]    = useState(() => getPrefs().quizCount || 5);
  const [quizDiff,     setQuizDiff]     = useState(() => getPrefs().quizDifficulty || 'moyen');
  const [fcCount,      setFcCount]      = useState(() => getPrefs().fcCount || 10);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Sync theme from DOM in case it changed outside
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function changeTheme(t) {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('jangalai-theme', t);
  }

  function changeReduceMotion(checked) {
    setReduceMotion(checked);
    savePrefs({ reduceMotion: checked });
    if (checked) document.documentElement.classList.add('reduce-motion');
    else document.documentElement.classList.remove('reduce-motion');
  }

  function changeAIPref(patch) {
    const next = savePrefs(patch);
    setLang(next.lang || 'fr');
    setQuizCount(next.quizCount || 5);
    setQuizDiff(next.quizDifficulty || 'moyen');
    setFcCount(next.fcCount || 10);
    eventBus.emit('prefs:changed');
  }

  async function clearHistory() {
    const ok = await confirm("Effacer tout l'historique des sessions ?", { confirmLabel: 'Effacer', danger: true });
    if (!ok) return;
    localStorage.removeItem(HISTORY_KEY);
    eventBus.emit('history:refresh');
    eventBus.emit('dashboard:refresh');
    toast.success('Historique effacé.');
  }

  async function clearStats() {
    const ok = await confirm('Réinitialiser toutes les statistiques quiz ?', { confirmLabel: 'Réinitialiser', danger: true });
    if (!ok) return;
    localStorage.removeItem(QUIZ_STATS_KEY);
    eventBus.emit('stats:refresh');
    toast.success('Statistiques réinitialisées.');
  }

  function resetOnboarding() {
    localStorage.removeItem('jangalai-onboarded');
    onClose();
    onResetOnboarding?.();
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="settings-drawer">
        <div className="drawer-header">
          <h2>Paramètres</h2>
          <button className="drawer-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="drawer-body">

          <section className="settings-section">
            <h3 className="settings-section-title">Mon compte</h3>
            <div className="settings-account-card">
              <div className="sac-avatar">{user?.name?.charAt(0).toUpperCase() || '?'}</div>
              <div className="sac-info">
                <strong>{user?.name || '—'}</strong>
                <span>{user?.email || '—'}</span>
                <span className={`sac-plan plan-${user?.plan}`}>{PLAN_LABELS[user?.plan] || user?.plan}</span>
              </div>
              <a href="/profile" className="sac-edit-btn">Modifier</a>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Apparence</h3>
            <div className="settings-row">
              <div className="settings-row-label"><span>Thème</span><small>Clair ou sombre</small></div>
              <div className="theme-switch">
                <button className={`ts-btn${theme === 'light' ? ' active' : ''}`} onClick={() => changeTheme('light')}>☀️ Clair</button>
                <button className={`ts-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => changeTheme('dark')}>🌙 Sombre</button>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Réduire les animations</span><small>Désactive les transitions</small></div>
              <label className="toggle-switch">
                <input type="checkbox" checked={reduceMotion} onChange={e => changeReduceMotion(e.target.checked)} />
                <span className="toggle-track"></span>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Préférences IA</h3>
            <div className="settings-row">
              <div className="settings-row-label"><span>Langue des réponses</span><small>Langue utilisée par l'IA</small></div>
              <select className="settings-select" value={lang} onChange={e => changeAIPref({ lang: e.target.value })}>
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
                <option value="ar">🇸🇦 العربية</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Questions quiz par défaut</span><small>Nombre pré-rempli au lancement</small></div>
              <input type="number" className="settings-number" min="3" max="20" value={quizCount}
                onChange={e => changeAIPref({ quizCount: parseInt(e.target.value) || 5 })} />
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Difficulté par défaut</span><small>Niveau pré-sélectionné</small></div>
              <select className="settings-select" value={quizDiff} onChange={e => changeAIPref({ quizDifficulty: e.target.value })}>
                <option value="facile">Facile</option>
                <option value="moyen">Moyen</option>
                <option value="difficile">Difficile</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Flashcards par défaut</span><small>Nombre de cartes générées</small></div>
              <input type="number" className="settings-number" min="5" max="40" value={fcCount}
                onChange={e => changeAIPref({ fcCount: parseInt(e.target.value) || 10 })} />
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Données &amp; vie privée</h3>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Historique des sessions</span><small>Sessions sauvegardées localement</small></div>
              <button className="settings-danger-btn" onClick={clearHistory}>Effacer</button>
            </div>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Statistiques quiz</span><small>Scores et progression</small></div>
              <button className="settings-danger-btn" onClick={clearStats}>Réinitialiser</button>
            </div>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Profil d'études</span><small>Modifier votre niveau, domaine et spécialité</small></div>
              <button className="settings-neutral-btn" onClick={resetOnboarding}>Modifier</button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">Notifications</h3>
            <div className="settings-row">
              <div className="settings-row-label">
                <span>Rappels de révision</span>
                <small>Notifie quand des flashcards sont à réviser</small>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={pushSubscribed}
                  onChange={async e => {
                    if (e.target.checked) {
                      const ok = await pushSubscribe();
                      if (!ok) toast.warn('Notifications refusées ou non disponibles sur ce navigateur.');
                    } else {
                      await pushUnsubscribe();
                    }
                  }}
                />
                <span className="toggle-track"></span>
              </label>
            </div>
          </section>

          <section className="settings-section settings-section-last">
            <h3 className="settings-section-title">À propos</h3>
            <div className="settings-about">
              <span className="about-logo"><Logo /></span>
              <span className="about-version">v1.0 · Plateforme IA pédagogique</span>
              <a href="/" className="about-link">Page d'accueil ↗</a>
            </div>
          </section>

        </div>
      </aside>
    </>
  );
}
