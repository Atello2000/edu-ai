/**
 * Toast utility — compatible avec ToastContainer.jsx
 * ToastContainer appelle toast._register(setToasts) au montage.
 * toast.error/success/info/warn() pousse une notification dans le state React.
 */

let _setToasts = null;

function show(message, type = 'info', duration = 4000) {
  if (!_setToasts) {
    console.warn(`[toast:${type}]`, message);
    return;
  }
  const id = Date.now() + Math.random();
  _setToasts(prev => [...prev, { id, message, type }]);
  if (duration > 0) {
    setTimeout(() => {
      _setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }
}

const toast = {
  _register: (setter) => { _setToasts = setter; },
  error:     (msg, d) => show(msg, 'error',   d),
  success:   (msg, d) => show(msg, 'success', d),
  info:      (msg, d) => show(msg, 'info',    d),
  warn:      (msg, d) => show(msg, 'warn',    d),
};

export default toast;
