import { useState } from 'react';

const TYPE_COLORS = {
  weak_topic: '#e53935',
  srs: '#5a98f6',
  quiz: '#f5a623',
  review: '#4caf50',
  rest: '#9e9e9e',
};

const TYPE_LABELS = {
  weak_topic: 'Point faible',
  srs: 'Révision SRS',
  quiz: 'Quiz',
  review: 'Révision',
  rest: 'Repos',
};

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function StudyPlanSection({ plan, loading, error, onGenerate, onReset }) {
  const [examDate, setExamDate] = useState('');

  return (
    <div className="study-plan-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Planification</div>
          <h2 className="panel-title">Plan de <em>révision</em></h2>
        </div>
        {plan && <button className="ghost-btn" onClick={onReset}>Nouveau plan</button>}
      </div>

      {error && <div className="error-notice">{error}</div>}

      {!plan && !loading && (
        <div className="study-plan-form">
          <p style={{color:'var(--muted)',fontSize:'.88rem',marginBottom:'1rem'}}>
            Entrez la date de votre examen. Jangalai génère un planning personnalisé basé sur vos points faibles et vos révisions SRS.
          </p>
          <div style={{display:'flex',gap:'.75rem',alignItems:'center',flexWrap:'wrap'}}>
            <label style={{fontSize:'.85rem',color:'var(--muted)'}}>Date d&apos;examen :</label>
            <input
              type="date"
              className="input-field"
              value={examDate}
              min={tomorrow()}
              onChange={e => setExamDate(e.target.value)}
              style={{width:'auto'}}
            />
            <button
              className="act-btn blue"
              disabled={!examDate}
              onClick={() => onGenerate(examDate)}
            >
              Générer mon plan
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loader-inline">
          <div className="spinner" style={{width:16,height:16}} />
          <span>Génération de votre plan personnalisé…</span>
        </div>
      )}

      {plan && (
        <div className="study-plan-content">
          {plan.advice && (
            <div className="study-plan-advice">
              💡 {plan.advice}
            </div>
          )}
          <div className="study-plan-days">
            {(plan.days || []).map((day, i) => (
              <div key={i} className="study-plan-day">
                <div className="study-plan-day-header">
                  <strong>{day.label}</strong>
                  {day.total_minutes > 0 && (
                    <span className="study-plan-duration">{day.total_minutes} min</span>
                  )}
                </div>
                <div className="study-plan-tasks">
                  {(day.tasks || []).map((task, j) => (
                    <div key={j} className="study-plan-task">
                      <span
                        className="study-plan-task-dot"
                        style={{ background: TYPE_COLORS[task.type] || '#999' }}
                      />
                      <span className="study-plan-task-label">
                        <strong>{TYPE_LABELS[task.type] || task.type}</strong>
                        {task.topic && <> · {task.topic}</>}
                      </span>
                      <span className="study-plan-task-action">{task.action}</span>
                      {task.duration > 0 && (
                        <span className="study-plan-task-dur">{task.duration} min</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
