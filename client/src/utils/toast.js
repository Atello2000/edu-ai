// Singleton toast — utilisable partout sans context
// Usage : import toast from '../utils/toast'; toast.success('Ok !'); toast.error('Erreur');

let _setState = null;
let _id = 0;

export function _registerToast(fn) { _setState = fn; }

function push(type, message, duration = 3500) {
  if (!_setState) return;
  const id = ++_id;
  _setState(prev => [...prev, { id, type, message }]);
  setTimeout(() => _setState(prev => prev.filter(t => t.id !== id)), duration);
}

const toast = {
  success: (msg, dur) => push('success', msg, dur),
  error:   (msg, dur) => push('error',   msg, dur ?? 5000),
  info:    (msg, dur) => push('info',    msg, dur),
  warn:    (msg, dur) => push('warn',    msg, dur),
};

export default toast;
