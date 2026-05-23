import { useState, useEffect, useCallback } from 'react';

const SRS_KEY = 'jangalai-srs';

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePush() {
  const [subscribed, setSubscribed] = useState(
    () => localStorage.getItem('jangalai-push') === '1'
  );

  // Notify due SRS cards on mount
  useEffect(() => {
    if (localStorage.getItem('jangalai-push') !== '1') return;
    const srsData = JSON.parse(localStorage.getItem(SRS_KEY) || '{}');
    const now = Date.now();
    const dueCount = Object.values(srsData).filter(c => !c.nextReview || c.nextReview <= now).length;
    if (dueCount > 0) {
      fetch('/api/push/notify-due', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueCount }),
      }).catch(() => {});
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    try {
      const r = await fetch('/api/push/vapid-public-key');
      const d = await r.json();
      if (!d.publicKey) return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(d.publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
      localStorage.setItem('jangalai-push', '1');
      setSubscribed(true);
      return true;
    } catch { return false; }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch {
      // Browser subscription cleanup can fail if the service worker is stale.
    }
    localStorage.removeItem('jangalai-push');
    setSubscribed(false);
  }, []);

  return { subscribed, subscribe, unsubscribe };
}
