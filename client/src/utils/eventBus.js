// EventBus — remplace les window.__refresh* bridges
// Usage :
//   emit  : eventBus.emit('dashboard:refresh')
//   listen: const off = eventBus.on('dashboard:refresh', fn); return off;

const _listeners = {};

const eventBus = {
  on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
    return () => eventBus.off(event, fn);
  },
  off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  },
  emit(event, data) {
    (_listeners[event] || []).forEach(fn => fn(data));
  },
};

export default eventBus;
