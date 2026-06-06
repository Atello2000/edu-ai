export default function GenerationCard({
  title,
  subtitle,
  phase, // 'preparing' | 'generating' | 'streaming' | 'receiving'
  steps = [],
  activeStepIndex = 0,
  step,
  total,
}) {
  return (
    <div className="quiz-generation-card" role="status" aria-live="polite">
      <div className="quiz-generation-top">
        <div className="spinner" style={{ width: 22, height: 22 }} />
        <div>
          <div className="quiz-generation-title">
            {title}
          </div>
          <div className="quiz-generation-subtitle">
            {subtitle}
          </div>
        </div>
      </div>
      
      {steps.length > 0 && (
        <div className="quiz-generation-steps">
          {steps.map((s, idx) => {
            const isActive = idx <= activeStepIndex;
            return (
              <span key={idx} className={isActive ? 'active' : ''}>
                {s}
              </span>
            );
          })}
        </div>
      )}

      {step !== undefined && total !== undefined && step > 0 && total > 0 && (
        <div className="quiz-generation-track">
          <div style={{ width: `${Math.min(100, (step / total) * 100)}%` }} />
        </div>
      )}

    </div>
  );
}
