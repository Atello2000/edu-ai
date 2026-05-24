// ConfirmModal — remplace les confirm() natifs
// Usage : import { useConfirm } from './ConfirmModal';
//         const confirm = useConfirm();
//         if (await confirm('Supprimer ?')) { ... }

import { useState, useCallback, useContext, createContext } from 'react';

const Ctx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, resolve }

  const confirm = useCallback((message, opts = {}) => new Promise(resolve => {
    setState({ message, resolve, confirmLabel: opts.confirmLabel || 'Confirmer', danger: opts.danger ?? false });
  }), []);

  function handleClose(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => handleClose(false)}>
          <div className="modal-box modal-sm confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-body">
              <div className="confirm-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
                </svg>
              </div>
              <p className="confirm-modal-msg">{state.message}</p>
            </div>
            <div className="folder-modal-actions">
              <button className="ghost-btn" onClick={() => handleClose(false)}>Annuler</button>
              <button
                className={`act-btn ${state.danger ? 'rose' : 'blue'}`}
                onClick={() => handleClose(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  return useContext(Ctx);
}
