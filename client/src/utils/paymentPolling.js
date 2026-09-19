// The plan is not proof of payment. Only this purchase's server status is.
export function watchPayment(reference, { fetchStatus, onPaid, onMissing, onTimeout,
  schedule = setTimeout, cancel = clearTimeout, now = Date.now }) {
  let stopped = false;
  let timer;
  const started = now();
  const stop = () => { stopped = true; cancel(timer); };
  async function check() {
    if (stopped) return;
    if (now() - started >= 15 * 60 * 1000) { stop(); onTimeout(); return; }
    try {
      const response = await fetchStatus(reference);
      if (stopped) return;
      if (response.status === 404) { stop(); onMissing(); return; }
      if (response.ok) {
        const payment = await response.json();
        if (stopped) return;
        if (payment.reference === reference && payment.status === 'paid') {
          stop(); onPaid(payment.plan); return;
        }
      }
    } catch { /* retry temporary network failures */ }
    if (!stopped) timer = schedule(check, 15000);
  }
  timer = schedule(check, 0);
  return stop;
}
