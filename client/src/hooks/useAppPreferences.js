import { useState, useEffect } from 'react';
import eventBus from '../utils/eventBus';

const PREFS_KEY = 'jangalai-prefs';
function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
  catch { return {}; }
}

export function useAppPreferences() {
  const [quizCount,      setQuizCount]      = useState(() => Number(getPrefs().quizCount)  || 5);
  const [quizDifficulty, setQuizDifficulty] = useState(() => getPrefs().quizDifficulty     || 'moyen');
  const [fcCount,        setFcCount]        = useState(() => Number(getPrefs().fcCount)    || 10);
  const [examMode,       setExamMode]       = useState(false);
  const [examMins,       setExamMins]       = useState(10);

  useEffect(() => {
    return eventBus.on('prefs:changed', () => {
      const p = getPrefs();
      if (p.quizCount)      setQuizCount(Number(p.quizCount));
      if (p.quizDifficulty) setQuizDifficulty(p.quizDifficulty);
      if (p.fcCount)        setFcCount(Number(p.fcCount));
      if (p.reduceMotion)   document.documentElement.classList.add('reduce-motion');
      else                  document.documentElement.classList.remove('reduce-motion');
    });
  }, []);

  return {
    quizCount,      setQuizCount,
    quizDifficulty, setQuizDifficulty,
    fcCount,        setFcCount,
    examMode,       setExamMode,
    examMins,       setExamMins,
  };
}
