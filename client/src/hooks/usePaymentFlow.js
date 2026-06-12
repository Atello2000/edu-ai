import { useState, useRef, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';

export function usePaymentFlow({ refreshSession }) {
  const [showPlansModal,    setShowPlansModal]    = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsPlan,      setCongratsPlan]      = useState('');
  const [isWaitingPayment,  setIsWaitingPayment]  = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const show = () => setShowPlansModal(true);
    eventBus.on('plans:open', show);
    return () => eventBus.off('plans:open', show);
  }, []);

  useEffect(() => {
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const plan    = params.get('plan');
    if (payment === 'success') {
      setTimeout(() => { setCongratsPlan(plan || 'pro'); setShowCongratsModal(true); }, 0);
      if (typeof refreshSession === 'function') refreshSession();
      eventBus.emit('quota:refresh');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (payment === 'cancel') {
      toast.warn('Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshSession]);

  const handleCancelWaiting = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setIsWaitingPayment(false);
    toast.info('Attente du paiement annulée.');
  }, []);

  const handleSelectPlan = useCallback(async (planKey) => {
    try {
      const res  = await apiFetch('/api/payment/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      if (!data.redirectUrl) { toast.error("Impossible d'initier le paiement."); return; }

      setShowPlansModal(false);
      window.location.assign(data.redirectUrl);

      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      const start = Date.now();
      pollingIntervalRef.current = setInterval(async () => {
        if (Date.now() - start > 15 * 60 * 1000) {
          clearInterval(pollingIntervalRef.current);
          setIsWaitingPayment(false);
          toast.warn('Délai de paiement dépassé. Vous pouvez réessayer.');
          return;
        }
        try {
          const r = await fetch('/api/auth/me');
          if (!r.ok) return;
          const d = await r.json();
          if (d.user?.plan && d.user.plan !== 'free') {
            clearInterval(pollingIntervalRef.current);
            setIsWaitingPayment(false);
            setCongratsPlan(d.user.plan);
            setShowCongratsModal(true);
            if (typeof refreshSession === 'function') refreshSession();
            eventBus.emit('quota:refresh');
          }
        } catch { /* polling silencieux */ }
      }, 3000);
    } catch {
      toast.error('Erreur lors du lancement du paiement.');
    }
  }, [refreshSession]);

  return {
    showPlansModal,    setShowPlansModal,
    showCongratsModal, setShowCongratsModal,
    congratsPlan,
    isWaitingPayment,
    handleSelectPlan,
    handleCancelWaiting,
  };
}
