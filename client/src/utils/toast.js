/**
 * Toast léger sans dépendance externe.
 * Usage : toast.error('msg') | toast.success('msg') | toast.info('msg')
 */

function show(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '.5rem',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  const colors = {
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  };
  const c = colors[type] || colors.info;

  const el = document.createElement('div');
  Object.assign(el.style, {
    background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    padding: '.65rem 1rem', borderRadius: '10px',
    fontFamily: "'Outfit', sans-serif", fontSize: '.875rem', fontWeight: '500',
    boxShadow: '0 4px 16px rgba(0,0,0,.1)',
    pointerEvents: 'auto', cursor: 'pointer',
    opacity: '0', transform: 'translateY(8px)',
    transition: 'opacity .2s, transform .2s',
    maxWidth: '320px', lineHeight: '1.4',
  });
  el.textContent = message;
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  function dismiss() {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 220);
  }

  const timer = setTimeout(dismiss, duration);
  el.onclick = () => { clearTimeout(timer); dismiss(); };
}

const toast = {
  error:   (msg, d) => show(msg, 'error',   d),
  success: (msg, d) => show(msg, 'success', d),
  info:    (msg, d) => show(msg, 'info',    d),
};

export default toast;
