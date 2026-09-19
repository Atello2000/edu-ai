import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n';
import Logo from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Landing.css';

function useFadeUp() {
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function useCounterAnim() {
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting || !e.target.dataset.count) return;
        const target = parseInt(e.target.dataset.count);
        const suffix = e.target.dataset.suffix || '';
        const duration = 1800;
        const start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          const val = Math.floor(ease * target);
          e.target.textContent = val >= 100000 ? Math.floor(val / 1000) + 'k' + suffix : val >= 1000 ? val.toLocaleString('fr-FR') + suffix : val + suffix;
          if (p < 1) requestAnimationFrame(step);
          else e.target.textContent = target >= 100000 ? Math.floor(target / 1000) + 'k' + suffix : target.toLocaleString('fr-FR') + suffix;
        }
        requestAnimationFrame(step);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="faq-q"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >{q}</button>
      <div className="faq-a" hidden={!open}>{a}</div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { t } = useT();
  useTheme();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/app'); }, [user, navigate]);
  useFadeUp();
  useCounterAnim();

  return (
    <>
      <nav>
        <Link to="/" className="nav-logo"><Logo size={28} /></Link>
        <div className="nav-links">
          <a href="#features">{t('landing.nav.features')}</a>
          <a href="#pricing">{t('landing.nav.pricing')}</a>
          <a href="#faq">{t('landing.nav.faq')}</a>
        </div>
        <div className="nav-actions">
          <LanguageSwitcher />
          <Link to="/login" className="btn-outline">{t('landing.nav.login')}</Link>
          <Link to="/login?tab=register" className="btn-primary">{t('landing.nav.start')}</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow fade-up">{t('landing.hero.eyebrow')}</div>
        <h1 className="fade-up fade-up-delay-1">{t('landing.hero.title1')}<br />{t('landing.hero.title2')}<em>{t('landing.hero.titleEm')}</em></h1>
        <p className="fade-up fade-up-delay-2">
          {t('landing.hero.subtitle')}
        </p>
        <div className="hero-btns fade-up fade-up-delay-3">
          <Link to="/login?tab=register" className="btn-hero">{t('landing.hero.ctaPrimary')}</Link>
          <a href="#how-it-works" className="btn-hero-outline">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg> {t('landing.hero.ctaSecondary')}
          </a>
        </div>
        <p className="hero-social-proof fade-up fade-up-delay-4">{t('landing.hero.socialProof')}</p>
      </section>


      <div className="mockup-section">
        <div className="section-label fade-up">{t('landing.mockup.label')}</div>
        <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '2.5rem' }}>{t('landing.mockup.title')}<em>{t('landing.mockup.titleEm')}</em></h2>
        <div className="app-mockup fade-up fade-up-delay-2">
          <div className="mockup-bar">
            <div className="mockup-dot red"/><div className="mockup-dot yellow"/><div className="mockup-dot green"/>
            <div className="mockup-url">{t('landing.mockup.url')}</div>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-title">{t('landing.mockup.myCourses')}</div>
              <div className="mockup-file active"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span> {t('landing.mockup.file1')}</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span> {t('landing.mockup.file2')}</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span> {t('landing.mockup.file3')}</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/><path d="M14 13h2a2 2 0 0 1 0 4h-2"/></svg></span> {t('landing.mockup.file4')}</div>
              <div style={{ marginTop: '1.5rem', padding: '.5rem .6rem', background: 'var(--blue-bg)', border: '1px dashed rgba(61,126,255,.3)', borderRadius: '8px', fontSize: '.72rem', color: 'var(--blue)', textAlign: 'center' }}>{t('landing.mockup.addCourse')}</div>
            </div>
            <div className="mockup-main">
              <div className="mockup-tabs">
                <div className="mockup-tab">{t('landing.mockup.tabSummary')}</div>
                <div className="mockup-tab">{t('landing.mockup.tabQuiz')}</div>
                <div className="mockup-tab active">{t('landing.mockup.tabFlashcards')}</div>
                <div className="mockup-tab">{t('landing.mockup.tabChat')}</div>
                <div className="mockup-tab">{t('landing.mockup.tabExam')}</div>
                <div className="mockup-tab">{t('landing.mockup.tabMindmap')}</div>
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.75rem' }}>{t('landing.mockup.cardCounter')}</div>
              <div className="mockup-card-preview">
                <div className="mockup-card-q">{t('landing.mockup.cardQ')}</div>
                <div className="mockup-card-a">{t('landing.mockup.cardA')}</div>
                <div className="mockup-card-footer">
                  <div className="mockup-btn hard">{t('landing.mockup.btnHard')}</div>
                  <div className="mockup-btn ok">{t('landing.mockup.btnOk')}</div>
                  <div className="mockup-btn easy">{t('landing.mockup.btnEasy')}</div>
                </div>
              </div>
              <div className="mockup-progress">
                <span>{t('landing.mockup.progress')}</span>
                <div className="mockup-progress-bar"><div className="mockup-progress-fill"/></div>
                <span>68%</span>
                <span style={{ marginLeft: 'auto', color: 'var(--teal)', display:'inline-flex', alignItems:'center', gap:'.25rem' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z"/><path d="M10 17.5a2.5 2.5 0 0 0 4 0c.5-1-1-2.5-2-3-1 .5-2.5 2-2 3z"/></svg> {t('landing.mockup.streak')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="how-it-works">
        <div className="section-label fade-up">{t('landing.how.label')}</div>
        <h2 className="fade-up fade-up-delay-1">{t('landing.how.title')}<em>{t('landing.how.titleEm')}</em></h2>
        <div className="steps-grid">
          <div className="step-card fade-up fade-up-delay-1"><div className="step-number">01</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><h3>{t('landing.how.step1Title')}</h3><p>{t('landing.how.step1Desc')}</p></div>
          <div className="step-card fade-up fade-up-delay-2"><div className="step-number">02</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><h3>{t('landing.how.step2Title')}</h3><p>{t('landing.how.step2Desc')}</p></div>
          <div className="step-card fade-up fade-up-delay-3"><div className="step-number">03</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div><h3>{t('landing.how.step3Title')}</h3><p>{t('landing.how.step3Desc')}</p></div>
        </div>
      </div>

      <div className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="section-label fade-up">{t('landing.features.label')}</div>
        <h2 className="fade-up fade-up-delay-1">{t('landing.features.title')}<em>{t('landing.features.titleEm')}</em></h2>
        <div className="features-grid">
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><h3>{t('landing.features.f1Title')}</h3><p>{t('landing.features.f1Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></div><h3>{t('landing.features.f2Title')}</h3><p>{t('landing.features.f2Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><h3>{t('landing.features.f3Title')}</h3><p>{t('landing.features.f3Desc')}</p></div>
          
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg></div><h3>{t('landing.features.f4Title')}</h3><p>{t('landing.features.f4Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg></div><h3>{t('landing.features.f5Title')}</h3><p>{t('landing.features.f5Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>{t('landing.features.f6Title')}</h3><p>{t('landing.features.f6Desc')}</p></div>
          
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h3>{t('landing.features.f7Title')}</h3><p>{t('landing.features.f7Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="13" x2="5" y2="17"/><line x1="12" y1="13" x2="19" y2="17"/></svg></div><h3>{t('landing.features.f8Title')}</h3><p>{t('landing.features.f8Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><h3>{t('landing.features.f9Title')}</h3><p>{t('landing.features.f9Desc')}</p></div>
          
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg></div><h3>{t('landing.features.f10Title')}</h3><p>{t('landing.features.f10Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg></div><h3>{t('landing.features.f11Title')}</h3><p>{t('landing.features.f11Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg></div><h3>{t('landing.features.f12Title')}</h3><p>{t('landing.features.f12Desc')}</p></div>
          
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h3>{t('landing.features.f13Title')}</h3><p>{t('landing.features.f13Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg></div><h3>{t('landing.features.f14Title')}</h3><p>{t('landing.features.f14Desc')}</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h3>{t('landing.features.f15Title')}</h3><p>{t('landing.features.f15Desc')}</p></div>
        </div>
      </div>


      <div className="pricing-section" id="pricing">
        <div className="pricing-inner">
          <div className="section-label fade-up">{t('landing.pricing.label')}</div>
          <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '.75rem' }}>{t('landing.pricing.title')}<em>{t('landing.pricing.titleEm')}</em></h2>
          <p className="fade-up fade-up-delay-2" style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: '2.5rem' }}>{t('landing.pricing.subtitle')}</p>
          <div className="pricing-grid">
            <div className="price-card fade-up fade-up-delay-1">
              <div className="plan-name">{t('landing.pricing.freeName')}</div>
              <div className="plan-price">{t('landing.pricing.freePrice')}</div>
              <div className="plan-desc">{t('landing.pricing.freeDesc')}</div>
              <div className="plan-features">
                <div className="plan-feat"><strong>{t('landing.pricing.freeJetons')}</strong>{t('landing.pricing.freeJetonsRest')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF2')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF3')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF4')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF5')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF6')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF7')}</div>
                <div className="plan-feat">{t('landing.pricing.freeF8')}</div>
              </div>
              <Link to="/login"><button className="plan-cta">{t('landing.pricing.freeCta')}</button></Link>
            </div>

            {/* ── Recharge ponctuelle ── */}
            <div className="price-card price-card-topup fade-up fade-up-delay-2">
              <div className="plan-name">{t('landing.pricing.topupName')}</div>
              <div className="plan-price topup-price">{t('landing.pricing.topupPrice')} <span>{t('landing.pricing.topupCurrency')}</span></div>
              <div className="plan-desc">{t('landing.pricing.topupDesc')}</div>
              <div className="plan-features">
                <div className="plan-feat"><strong>{t('landing.pricing.topupJetons')}</strong>{t('landing.pricing.topupJetonsRest')}</div>
                <div className="plan-feat">{t('landing.pricing.topupF2')}</div>
                <div className="plan-feat">{t('landing.pricing.topupF3')}</div>
                <div className="plan-feat">{t('landing.pricing.topupF4')}</div>
                <div className="plan-feat">{t('landing.pricing.topupF5')}</div>
              </div>
              <Link to="/login?tab=register"><button className="plan-cta plan-cta-topup">{t('landing.pricing.topupCta')}</button></Link>
            </div>

            <div className="price-card featured fade-up fade-up-delay-3">
              <div className="plan-name">{t('landing.pricing.proName')}</div>
              <div className="plan-price">{t('landing.pricing.proPrice')} <span>{t('landing.pricing.perMonth')}</span></div>
              <div className="plan-desc">{t('landing.pricing.proDesc')}</div>
              <div className="plan-features">
                <div className="plan-feat"><strong>{t('landing.pricing.proJetons')}</strong>{t('landing.pricing.proJetonsRest')}</div>
                <div className="plan-feat">{t('landing.pricing.proF2')}</div>
                <div className="plan-feat">{t('landing.pricing.proF3')}</div>
                <div className="plan-feat">{t('landing.pricing.proF4')}</div>
                <div className="plan-feat">{t('landing.pricing.proF5')}</div>
                <div className="plan-feat">{t('landing.pricing.proF6')}</div>
                <div className="plan-feat">{t('landing.pricing.proF7')}</div>
                <div className="plan-feat">{t('landing.pricing.proF8')}</div>
              </div>
              <Link to="/login"><button className="plan-cta">{t('landing.pricing.proCta')}</button></Link>
            </div>
            <div className="price-card fade-up fade-up-delay-4">
              <div className="plan-name">{t('landing.pricing.maxName')}</div>
              <div className="plan-price">{t('landing.pricing.maxPrice')} <span>{t('landing.pricing.perMonth')}</span></div>
              <div className="plan-desc">{t('landing.pricing.maxDesc')}</div>
              <div className="plan-features">
                <div className="plan-feat"><strong>{t('landing.pricing.maxJetons')}</strong>{t('landing.pricing.maxJetonsRest')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF2')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF3')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF4')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF5')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF6')}</div>
                <div className="plan-feat">{t('landing.pricing.maxF7')}</div>
              </div>
              <Link to="/login"><button className="plan-cta">{t('landing.pricing.maxCta')}</button></Link>
            </div>
          </div>

        </div>
      </div>
 
      <div className="section" id="faq">
        <div className="section-label fade-up">{t('landing.faq.label')}</div>
        <h2 className="fade-up fade-up-delay-1">{t('landing.faq.title')}<em>{t('landing.faq.titleEm')}</em></h2>
        <div className="faq fade-up fade-up-delay-2">
          <FaqItem q={t('landing.faq.q1')} a={t('landing.faq.a1')} />
          <FaqItem q={t('landing.faq.q2')} a={t('landing.faq.a2')} />
          <FaqItem q={t('landing.faq.q3')} a={t('landing.faq.a3')} />
          <FaqItem q={t('landing.faq.q4')} a={t('landing.faq.a4')} />
          <FaqItem q={t('landing.faq.q5')} a={t('landing.faq.a5')} />
          <FaqItem q={t('landing.faq.q6')} a={t('landing.faq.a6')} />
          <FaqItem q={t('landing.faq.q7')} a={t('landing.faq.a7')} />
          <FaqItem q={t('landing.faq.q8')} a={t('landing.faq.a8')} />
          <FaqItem q={t('landing.faq.q9')} a={t('landing.faq.a9')} />
          <FaqItem q={t('landing.faq.q10')} a={t('landing.faq.a10')} />
          <FaqItem q={t('landing.faq.q11')} a={t('landing.faq.a11')} />
        </div>
      </div>

      <div className="cta-section">
        <h2 className="fade-up">{t('landing.cta.title1')}<br /><em>{t('landing.cta.titleEm')}</em></h2>
        <p className="fade-up fade-up-delay-1">{t('landing.cta.subtitle')}</p>
        <Link to="/login?tab=register" className="btn-hero fade-up fade-up-delay-2" style={{ display: 'inline-flex' }}>{t('landing.cta.button')}</Link>
        <div className="cta-note fade-up fade-up-delay-3">{t('landing.cta.note')}</div>
      </div>

      <footer>
        <div className="footer-brand"><Logo size={24} /></div>
        <div className="footer-links">
          <a href="#features">{t('landing.footer.features')}</a>
          <a href="#pricing">{t('landing.footer.pricing')}</a>
          <a href="#faq">{t('landing.footer.faq')}</a>
          <Link to="/login">{t('landing.footer.login')}</Link>
          <Link to="/login?tab=register" className="footer-cta-link">{t('landing.footer.register')}</Link>
          <Link to="/cgu">{t('landing.footer.cgu')}</Link>
          <Link to="/confidentialite">{t('landing.footer.privacy')}</Link>
        </div>
        <div>{t('landing.footer.copyright')}</div>
      </footer>
    </>
  );
}
