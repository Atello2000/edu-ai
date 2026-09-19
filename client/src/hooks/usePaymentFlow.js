import { useState, useRef, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';
import { watchPayment } from '../utils/paymentPolling';
import toast from '../utils/toast';

const STORAGE_KEY = 'jangalai.pendingPayment';
function saveReference(value) {
  try { if (value) localStorage.setItem(STORAGE_KEY, value); else localStorage.removeItem(STORAGE_KEY); } catch { /* private browsing */ }
}
function readReference() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }

export function usePaymentFlow({ refreshSession }) {
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsPlan, setCongratsPlan] = useState('');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const stopPolling = useRef(null);
  const sessionRefresh = useRef(refreshSession);
  useEffect(() => { sessionRefresh.current = refreshSession; }, [refreshSession]);

  const beginWaiting = useCallback(reference => {
    stopPolling.current?.();
    setIsWaitingPayment(true);
    saveReference(reference);
    stopPolling.current = watchPayment(reference, {
      fetchStatus: ref => apiFetch('/api/payment/status/' + encodeURIComponent(ref), { cache: 'no-store' }),
      onPaid: plan => {
        saveReference(null);
        setIsWaitingPayment(false);
        setCongratsPlan(plan);
        setShowCongratsModal(true);
        sessionRefresh.current?.();
        eventBus.emit('quota:refresh');
      },
      onMissing: () => {
        saveReference(null);
        setIsWaitingPayment(false);
        toast.warn('Paiement introuvable pour ce compte.');
      },
      onTimeout: () => {
        setIsWaitingPayment(false);
        toast.warn('Paiement pas encore confirmé. Rechargez la page pour vérifier à nouveau.');
      },
    });
  }, []);

  useEffect(() => {
    const show = () => setShowPlansModal(true);
    eventBus.on('plans:open', show);
    return () => eventBus.off('plans:open', show);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const reference = params.get('reference') || readReference();
    const timer = setTimeout(() => {
      if (payment === 'cancel') {
        saveReference(null);
        toast.warn('Paiement annulé.');
      } else if (reference) {
        beginWaiting(reference);
      } else if (payment === 'success' || payment === 'return') {
        toast.info('Vérifiez votre solde : aucune référence de paiement à confirmer.');
      }
      if (payment) window.history.replaceState({}, document.title, window.location.pathname);
    }, 0);
    return () => { clearTimeout(timer); stopPolling.current?.(); };
  }, [beginWaiting]);

  const handleCancelWaiting = useCallback(() => {
    stopPolling.current?.();
    setIsWaitingPayment(false);
    toast.info('Suivi interrompu. Le paiement sera crédité dès sa confirmation.');
  }, []);

  const handleSelectPlan = useCallback(async planKey => {
    // Open during the click event so browsers do not block the payment tab.
    const paymentTab = window.open('about:blank', '_blank');
    if (paymentTab) paymentTab.opener = null;
    try {
      const res = await apiFetch('/api/payment/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl || !data.reference) {
        paymentTab?.close();
        toast.error(data.error || 'Impossible de lancer le paiement.');
        return;
      }
      setShowPlansModal(false);
      beginWaiting(data.reference);
      if (paymentTab) paymentTab.location.replace(data.redirectUrl);
      else window.location.assign(data.redirectUrl);
    } catch {
      paymentTab?.close();
      toast.error('Erreur lors du lancement du paiement.');
    }
  }, [beginWaiting]);

  return { showPlansModal, setShowPlansModal, showCongratsModal, setShowCongratsModal,
    congratsPlan, isWaitingPayment, handleSelectPlan, handleCancelWaiting };
}
