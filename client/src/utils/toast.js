/**
 * Toast utility — compatible avec ToastContainer.jsx
 * ToastContainer appelle _registerToast(setToasts) au montage.
 * toast.error/success/info/warn() pousse une notification dans le state React.
 */

let _setToasts = null;

export function _registerToast(setter) {
  _setToasts = setter;
}

function show(message, type = 'info', duration = 4000) {
  if (!_setToasts) {
    // Fallback si ToastContainer pas encore monté
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
  error:   (msg, d) => show(msg, 'error',   d),
  success: (msg, d) => show(msg, 'success', d),
  info:    (msg, d) => show(msg, 'info',    d),
  warn:    (msg, d) => show(msg, 'warn',    d),
};

export default toast;
