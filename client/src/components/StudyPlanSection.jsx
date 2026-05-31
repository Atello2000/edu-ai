import { useState, useMemo } from 'react';

/* ── Icônes par type de tâche ────────────────────────────────────────────── */
const IcoWeak   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".6" fill="currentColor"/></svg>;
const IcoSRS    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const IcoQuiz   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>;
const IcoReview = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const IcoRest   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcoCheck  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoChevron = ({ open }) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><polyline points="9 18 15 12 9 6"/></svg>;

const TYPE_META = {
  weak_topic: { Icon: IcoWeak,   label: 'Point faible', color: 'rose'   },
  srs:        { Icon: IcoSRS,    label: 'SRS',          color: 'blue'   },
  quiz:       { Icon: IcoQuiz,   label: 'Quiz',         color: 'gold'   },
  review:     { Icon: IcoReview, label: 'Révision',     color: 'teal'   },
  rest:       { Icon: IcoRest,   label: 'Repos',        color: 'muted'  },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.ceil(diff / 86400000);
}

function today() { return new Date().toISOString().slice(0, 10); }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function loadTopicsPreview() {
  try {
    const raw = JSON.parse(localStorage.getItem('jangalai-topic-stats') || '{}');
    return Object.entries(raw)
      .map(([name, { sessions }]) => ({
        name: name.replace(/\.[^.]+$/, ''),
        avg: Math.round(sessions.reduce((s, x) => s + x.pct, 0) / sessions.length),
      }))
      .filter(t => t.avg < 70)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);
  } catch { return []; }
}
function loadSrsPreview() {
  try {
    const data = JSON.parse(localStorage.getItem('jangalai-srs') || '{}');
    return Object.values(data).filter(c => c.nextReview <= Date.now()).length;
  } catch { return 0; }
}

const DONE_KEY = 'jangalai-study-done';
function loadDone() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); }
  catch { return {}; }
}
function saveDone(d) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* best-effort */ }
}

/* ── Composant jour ──────────────────────────────────────────────────────── */
function DayCard({ day, dayIdx, done, onToggle, isToday, isPast }) {
  const [open, setOpen] = useState(!isPast);
  const tasks = day.tasks || [];
  const completedCount = tasks.filter((_, j) => done[`${dayIdx}-${j}`]).length;
  const allDone = tasks.length > 0 && completedCount === tasks.length;

  return (
    <div className={`sp-day${isToday ? ' sp-day-today' : ''}${isPast ? ' sp-day-past' : ''}${allDone ? ' sp-day-done' : ''}`}>
      <button
        type="button"
        className="sp-day-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="sp-day-left">
          {isToday && <span className="sp-today-badge">Aujourd'hui</span>}
          <span className="sp-day-label">{day.label}</span>
        </span>
        <span className="sp-day-right">
          {tasks.length > 0 && (
            <span className="sp-day-progress">
              <span className="sp-day-frac">{completedCount}/{tasks.length}</span>
              {day.total_minutes > 0 && <span className="sp-day-dur">{day.total_minutes} min</span>}
            </span>
          )}
          <IcoChevron open={open} />
        </span>
      </button>

      {open && (
        <div className="sp-day-tasks">
          {tasks.length === 0 ? (
            <p className="sp-no-tasks">Aucune tâche</p>
          ) : (
            tasks.map((task, j) => {
              const key = `${dayIdx}-${j}`;
              const isDone = !!done[key];
              const meta = TYPE_META[task.type] || { Icon: IcoReview, label: task.type, color: 'muted' };
              const { Icon } = meta;
              return (
                <div
                  key={j}
                  className={`sp-task${isDone ? ' sp-task-done' : ''}`}
                  onClick={() => onToggle(key)}
                  role="checkbox"
                  aria-checked={isDone}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(key); } }}
                >
                  <span className={`sp-task-check${isDone ? ' checked' : ''}`}>
                    {isDone && <IcoCheck />}
                  </span>
                  <span className={`sp-task-type sp-type-${meta.color}`}>
                    <Icon /> {meta.label}
                  </span>
                  <span className="sp-task-body">
                    {task.topic && <strong className="sp-task-topic">{task.topic}</strong>}
                    {task.action && <span className="sp-task-action">{task.action}</span>}
                  </span>
                  {task.duration > 0 && (
                    <span className="sp-task-dur">{task.duration} min</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function StudyPlanSection({ plan, loading, progress, error, files = [], onGenerate, onReset }) {
  const [examDate, setExamDate] = useState('');
  const [done, setDone] = useState(loadDone);

  const dLeft = daysUntil(examDate);

  // Filtrer les topics par fichiers chargés
  const weakTopics = useMemo(() => {
    if (!files.length) return loadTopicsPreview();
    try {
      const raw = JSON.parse(localStorage.getItem('jangalai-topic-stats') || '{}');
      const fileKeys = files.map(f => f.name.replace(/\.[^.]+$/, '').toLowerCase());
      return Object.entries(raw)
        .filter(([name]) => {
          const k = name.replace(/\.[^.]+$/, '').toLowerCase();
          return fileKeys.some(fk => k === fk || k.includes(fk) || fk.includes(k));
        })
        .map(([name, { sessions }]) => ({
          name: name.replace(/\.[^.]+$/, ''),
          avg:  Math.round(sessions.reduce((s, x) => s + x.pct, 0) / sessions.length),
        }))
        .filter(t => t.avg < 70)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 3);
    } catch { return []; }
  }, [files]);

  const srsCount = useMemo(() => loadSrsPreview(), []);

  function toggleTask(key) {
    const next = { ...done, [key]: !done[key] };
    setDone(next);
    saveDone(next);
  }

  /* Stats globales du plan */
  const planStats = useMemo(() => {
    if (!plan?.days) return null;
    const allTasks = plan.days.flatMap(d => d.tasks || []);
    const totalMin = plan.days.reduce((s, d) => s + (d.total_minutes || 0), 0);
    const doneCount = Object.values(done).filter(Boolean).length;
    return { total: allTasks.length, totalMin, doneCount };
  }, [plan, done]);

  const todayStr = today();

  return (
    <div className="study-plan-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Planification</div>
          <h2 className="panel-title">Plan de <em>révision</em></h2>
        </div>
        {plan && (
          <button className="ghost-btn" onClick={() => { onReset(); setDone({}); saveDone({}); }}>
            Nouveau plan
          </button>
        )}
      </div>

      {error && <div className="error-notice">{error}</div>}

      {/* ── Formulaire ──────────────────────────────────────────────────── */}
      {!plan && !loading && (
        <div className="study-plan-form">
          <p className="sp-form-intro">
            Jangalai génère un planning jour par jour <strong>basé sur les cours que vous avez chargés</strong>.
            Les points faibles (quiz) et les révisions SRS liés à ces cours sont automatiquement intégrés.
          </p>

          <div className="sp-form-row">
            <label className="sp-form-label" htmlFor="sp-date">Date d&apos;examen</label>
            <input
              id="sp-date"
              type="date"
              className="input-field sp-date-input"
              value={examDate}
              min={tomorrow()}
              onChange={e => setExamDate(e.target.value)}
            />
            {dLeft !== null && dLeft > 0 && (
              <span className="sp-countdown">
                <span className="sp-countdown-val">{dLeft}</span> jour{dLeft > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Contexte pris en compte */}
          <div className="sp-context">
            {/* Fichiers chargés (source principale) */}
            <div className="sp-ctx-item">
              <span className="sp-ctx-icon sp-ctx-files">
                <IcoReview />
              </span>
              {files.length > 0 ? (
                <span>
                  <strong>{files.length}</strong> cours chargé{files.length > 1 ? 's' : ''}{' '}
                  <em>({files.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ')})</em>
                </span>
              ) : (
                <span className="sp-ctx-warn">
                  ⚠ Aucun cours chargé — chargez un fichier d&apos;abord pour un plan personnalisé
                </span>
              )}
            </div>

            {/* Points faibles filtrés */}
            <div className="sp-ctx-item">
              <span className="sp-ctx-icon sp-ctx-weak">
                <IcoWeak />
              </span>
              <span>
                {weakTopics.length > 0
                  ? <><strong>{weakTopics.length}</strong> point{weakTopics.length > 1 ? 's' : ''} faible{weakTopics.length > 1 ? 's' : ''}{' '}
                    détecté{weakTopics.length > 1 ? 's' : ''}{' '}
                    <em>({weakTopics.map(t => `${t.name} ${t.avg}%`).join(', ')})</em></>
                  : <span style={{ color: 'var(--muted)' }}>
                    {files.length > 0
                      ? 'Aucun quiz fait sur ces cours — le plan utilisera le contenu directement'
                      : 'Aucun point faible détecté'}
                  </span>
                }
              </span>
            </div>

            {/* SRS */}
            <div className="sp-ctx-item">
              <span className="sp-ctx-icon sp-ctx-srs">
                <IcoSRS />
              </span>
              <span>
                {srsCount > 0
                  ? <><strong>{srsCount}</strong> carte{srsCount > 1 ? 's' : ''} SRS due{srsCount > 1 ? 's' : ''} —{' '}
                    <em>seules celles liées aux cours chargés seront planifiées</em></>
                  : <span style={{ color: 'var(--muted)' }}>Aucune carte SRS en attente</span>
                }
              </span>
            </div>
          </div>

          <button
            className="act-btn blue sp-generate-btn"
            disabled={!examDate}
            onClick={() => onGenerate(examDate, files)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Générer mon plan
          </button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="sp-loading">
          <div className="sp-loading-spinner">
            <div className="spinner" style={{ width: 18, height: 18 }} />
          </div>
          <span>{progress || 'Génération de votre plan personnalisé…'}</span>
        </div>
      )}

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      {plan && planStats && (
        <div className="study-plan-content">

          {/* Récap */}
          <div className="sp-recap">
            <div className="sp-recap-stat">
              <span className="sp-recap-val">{plan.days?.length ?? 0}</span>
              <span className="sp-recap-lbl">jours</span>
            </div>
            <div className="sp-recap-stat">
              <span className="sp-recap-val">{Math.round(planStats.totalMin / 60 * 10) / 10}h</span>
              <span className="sp-recap-lbl">de travail</span>
            </div>
            <div className="sp-recap-stat">
              <span className="sp-recap-val">{planStats.total}</span>
              <span className="sp-recap-lbl">tâches</span>
            </div>
            <div className="sp-recap-progress">
              <div className="sp-recap-bar-track">
                <div
                  className="sp-recap-bar-fill"
                  style={{ width: planStats.total ? `${Math.round(planStats.doneCount / planStats.total * 100)}%` : '0%' }}
                />
              </div>
              <span className="sp-recap-pct">
                {planStats.total ? Math.round(planStats.doneCount / planStats.total * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Conseil */}
          {plan.advice && (
            <div className="study-plan-advice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--blue)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5"/></svg>
              {plan.advice}
            </div>
          )}

          {/* Jours */}
          <div className="sp-days">
            {(plan.days || []).map((day, i) => {
              const isToday = day.date === todayStr;
              const isPast  = day.date && day.date < todayStr;
              return (
                <DayCard
                  key={i}
                  day={day}
                  dayIdx={i}
                  done={done}
                  onToggle={toggleTask}
                  isToday={isToday}
                  isPast={isPast}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
