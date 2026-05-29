import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import Logo from '../components/Logo';
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
      <div className="faq-q" onClick={() => setOpen(o => !o)}>{q}</div>
      <div className="faq-a">{a}</div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
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
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <Link to="/login" className="btn-outline">Connexion</Link>
          <Link to="/login" className="btn-primary">Commencer</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow fade-up">Révision intelligente · Jangalai</div>
        <h1 className="fade-up fade-up-delay-1">Révisez plus vite,<br />apprenez <em>différemment</em></h1>
        <p className="fade-up fade-up-delay-2">
          Importez votre PDF, PPT ou DOCX et choisissez votre objectif. En quelques secondes, Jangalai génère résumé, quiz, flashcards et carte mentale — le tout adapté à votre filière.
        </p>
        <div className="hero-btns fade-up fade-up-delay-3">
          <Link to="/login" className="btn-hero">Commencer gratuitement →</Link>
          <a href="#how-it-works" className="btn-hero-outline">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg> Voir comment ça marche
          </a>
        </div>
      </section>


      <div className="mockup-section">
        <div className="section-label fade-up">Aperçu de l'application</div>
        <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '2.5rem' }}>Votre assistant de révision <em>personnalisé</em></h2>
        <div className="app-mockup fade-up fade-up-delay-2">
          <div className="mockup-bar">
            <div className="mockup-dot red"/><div className="mockup-dot yellow"/><div className="mockup-dot green"/>
            <div className="mockup-url">jangalai.app · Flashcards</div>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-title">Mes cours</div>
              <div className="mockup-file active"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span> Biochimie S3.pdf</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span> Marketing Mix.pptx</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span> Droit des contrats.pdf</div>
              <div className="mockup-file"><span className="fi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/><path d="M14 13h2a2 2 0 0 1 0 4h-2"/></svg></span> Maths Appliquées.docx</div>
              <div style={{ marginTop: '1.5rem', padding: '.5rem .6rem', background: 'var(--gold-bg)', border: '1px dashed rgba(212,169,76,.3)', borderRadius: '8px', fontSize: '.72rem', color: 'var(--gold)', textAlign: 'center' }}>+ Ajouter un cours</div>
            </div>
            <div className="mockup-main">
              <div className="mockup-tabs">
                <div className="mockup-tab">Résumé</div>
                <div className="mockup-tab">Quiz</div>
                <div className="mockup-tab active">Flashcards</div>
                <div className="mockup-tab">Chat</div>
                <div className="mockup-tab">Fiche exam</div>
                <div className="mockup-tab">Carte mentale</div>
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.75rem' }}>Carte 7 sur 24 · Biochimie S3</div>
              <div className="mockup-card-preview">
                <div className="mockup-card-q">Qu'est-ce que la phosphorylation oxydative ?</div>
                <div className="mockup-card-a">Processus métabolique dans lequel l'énergie libérée par l'oxydation des nutriments est utilisée pour synthétiser de l'ATP à partir d'ADP et de phosphate inorganique, principalement dans les mitochondries.</div>
                <div className="mockup-card-footer">
                  <div className="mockup-btn hard">Difficile</div>
                  <div className="mockup-btn ok">Correct</div>
                  <div className="mockup-btn easy">Facile</div>
                </div>
              </div>
              <div className="mockup-progress">
                <span>Progression</span>
                <div className="mockup-progress-bar"><div className="mockup-progress-fill"/></div>
                <span>68%</span>
                <span style={{ marginLeft: 'auto', color: 'var(--teal)', display:'inline-flex', alignItems:'center', gap:'.25rem' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z"/><path d="M10 17.5a2.5 2.5 0 0 0 4 0c.5-1-1-2.5-2-3-1 .5-2.5 2-2 3z"/></svg> 5j de suite</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="how-it-works">
        <div className="section-label fade-up">Comment ça marche</div>
        <h2 className="fade-up fade-up-delay-1">Trois étapes vers la <em>maîtrise</em></h2>
        <div className="steps-grid">
          <div className="step-card fade-up fade-up-delay-1"><div className="step-number">01</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><h3>Configurez votre profil</h3><p>Indiquez votre niveau d'études, vos domaines et votre spécialité. En 60 secondes, Jangalai connaît votre filière et adapte chaque contenu généré à votre contexte.</p></div>
          <div className="step-card fade-up fade-up-delay-2"><div className="step-number">02</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><h3>Définissez votre objectif</h3><p>Examen demain ? Besoin de mémoriser ? Après chaque chargement, indiquez votre objectif. Jangalai adapte la difficulté, le nombre de questions et le type de contenu — ou lancez « Préparer ma session » pour tout générer en un seul clic.</p></div>
          <div className="step-card fade-up fade-up-delay-3"><div className="step-number">03</div><div className="step-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div><h3>Révisez, corrigez, progressez</h3><p>L'algorithme SM-2 planifie vos flashcards au bon moment. Après chaque quiz, révisez vos erreurs en un clic ou convertissez-les en flashcards. Votre streak quotidien vous garde motivé jusqu'aux examens.</p></div>
        </div>
      </div>

      <div className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="section-label fade-up">Fonctionnalités</div>
        <h2 className="fade-up fade-up-delay-1">Tout ce dont vous avez besoin pour <em>réussir</em></h2>
        <div className="features-grid">
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><h3>Préparer ma session</h3><p>Un seul bouton génère simultanément résumé, quiz et flashcards — adaptés à l'objectif que vous avez choisi. Idéal la veille d'un examen.</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></div><h3>Objectif de session</h3><p>Examen demain, comprendre, mémoriser ou s'entraîner : Jangalai adapte la difficulté, le nombre de questions et le volume de cartes à votre besoin du moment.</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><h3>Résumés structurés</h3><p>5 sections claires en secondes : objectifs, points clés, résumé détaillé, concepts importants et à retenir.</p></div>
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg></div><h3>Quiz QCM & correction</h3><p>3 niveaux de difficulté, mode examen avec chronomètre. Après le score, révisez vos erreurs en un clic ou convertissez-les en flashcards.</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg></div><h3>Flashcards intelligentes</h3><p>Algorithme SM-2 — vous révisez ce que vous ne maîtrisez pas encore, exactement au bon moment. Notifications de rappel intégrées.</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3>Chat avec le cours</h3><p>Posez n'importe quelle question sur vos fichiers. Joignez une image ou un devoir pour le faire corriger par l'IA.</p></div>
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h3>Fiche d&apos;examen</h3><p>Définitions, pièges à éviter, tableaux comparatifs et questions probables générés en un clic depuis vos cours.</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="13" x2="5" y2="17"/><line x1="12" y1="13" x2="19" y2="17"/></svg></div><h3>Carte mentale</h3><p>Visualisez la structure du cours sous forme d'arbre interactif. Zoomez, naviguez et repérez les connexions entre concepts en un coup d'œil.</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><h3>Pour vous — sans fichier</h3><p>Votre espace personnalisé suggère des sujets clés de votre domaine. Générez des flashcards ou un quiz en un clic, sans rien charger.</p></div>
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg></div><h3>Suivi &amp; streak quotidien</h3><p>Historique des révisions, scores par sujet, streak de jours consécutifs. Restez motivé avec une progression visible chaque jour.</p></div>
        </div>
      </div>

      <div className="testimonials-section">
        <div className="testimonials-inner">
          <div className="section-label fade-up">Témoignages</div>
          <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '2.5rem' }}>Ce qu'en disent les <em>étudiants</em></h2>
          <div className="testimonials-grid">
            <div className="testimonial-card fade-up fade-up-delay-1">
              <div className="stars">★★★★★</div>
              <div className="testimonial-text">J'ai préparé mes partiels de biochimie avec Jangalai. Les flashcards générées automatiquement depuis mes cours m'ont fait gagner des heures. J'ai eu 16/20 alors que j'avais 11 en octobre.</div>
              <div className="testimonial-author"><div className="testimonial-avatar av-blue">A</div><div><div className="testimonial-name">Amina K.</div><div className="testimonial-role">L2 Sciences de la Vie, Paris</div></div></div>
            </div>
            <div className="testimonial-card fade-up fade-up-delay-2">
              <div className="stars">★★★★★</div>
              <div className="testimonial-text">Le chat avec le cours change tout. Je charge mon PPT et je pose mes questions directement — c'est comme avoir un prof disponible 24h/24. J'utilise Jangalai tous les soirs avant les exams.</div>
              <div className="testimonial-author"><div className="testimonial-avatar av-teal">M</div><div><div className="testimonial-name">Mamadou D.</div><div className="testimonial-role">Master Droit des Affaires, Dakar</div></div></div>
            </div>
            <div className="testimonial-card fade-up fade-up-delay-3">
              <div className="stars">★★★★★</div>
              <div className="testimonial-text">Les fiches d'examen générées en un clic sont bluffantes. En médecine on a des cours énormes — Jangalai m'extrait l'essentiel et les questions probables. Incontournable pour les concours.</div>
              <div className="testimonial-author"><div className="testimonial-avatar av-gold">S</div><div><div className="testimonial-name">Sofia R.</div><div className="testimonial-role">PACES, Université de Lyon</div></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="pricing-section" id="pricing">
        <div className="pricing-inner">
          <div className="section-label fade-up">Tarifs</div>
          <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '.75rem' }}>Simple et <em>transparent</em></h2>
          <p className="fade-up fade-up-delay-2" style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: '2.5rem' }}>Commencez gratuitement. Les offres Pro et Max arrivent bientôt.</p>
          <div className="pricing-grid">
            <div className="price-card fade-up fade-up-delay-1">
              <div className="plan-name">Gratuit</div>
              <div className="plan-price">0€ <span>/ mois</span></div>
              <div className="plan-desc">Pour découvrir Jangalai sans engagement</div>
              <div className="plan-features">
                <div className="plan-feat">5 résumés / jour</div>
                <div className="plan-feat">8 quiz / jour</div>
                <div className="plan-feat">8 flashcards / jour</div>
                <div className="plan-feat">3 messages chat / jour</div>
                <div className="plan-feat">Préparer ma session inclus</div>
                <div className="plan-feat">Carte mentale & objectif de session</div>
                <div className="plan-feat">PDF, PPT, DOCX</div>
              </div>
              <Link to="/login"><button className="plan-cta">Commencer gratuitement</button></Link>
            </div>
            <div className="price-card featured locked fade-up fade-up-delay-2">
              <div className="price-badge">Bientôt disponible</div>
              <div className="plan-name">Pro</div>
              <div className="plan-price">4€ <span>/ mois</span></div>
              <div className="plan-desc">Pour les étudiants en période d'examen</div>
              <div className="plan-features">
                <div className="plan-feat">20 résumés / jour</div>
                <div className="plan-feat">40 quiz / jour</div>
                <div className="plan-feat">40 flashcards / jour</div>
                <div className="plan-feat">20 messages chat / jour</div>
                <div className="plan-feat">Préparer ma session inclus</div>
                <div className="plan-feat">Carte mentale & objectif de session</div>
                <div className="plan-feat">Traitement prioritaire</div>
                <div className="plan-feat">Historique illimité</div>
              </div>
              <button className="plan-cta plan-cta-locked" type="button" disabled title="Les paiements ne sont pas encore disponibles">
                Paiement bientôt disponible
              </button>
            </div>
            <div className="price-card locked fade-up fade-up-delay-3">
              <div className="price-badge muted">Bientôt disponible</div>
              <div className="plan-name">Max</div>
              <div className="plan-price">9€ <span>/ mois</span></div>
              <div className="plan-desc">Pour une révision intensive sans limites</div>
              <div className="plan-features">
                <div className="plan-feat">Résumés illimités</div>
                <div className="plan-feat">Quiz illimités</div>
                <div className="plan-feat">Flashcards illimitées</div>
                <div className="plan-feat">60 messages chat / jour</div>
                <div className="plan-feat">Préparer ma session illimité</div>
                <div className="plan-feat">Carte mentale & objectif de session</div>
                <div className="plan-feat">Traitement prioritaire</div>
                <div className="plan-feat">Historique illimité</div>
                <div className="plan-feat">Export PDF des fiches</div>
              </div>
              <button className="plan-cta plan-cta-locked" type="button" disabled title="Les paiements ne sont pas encore disponibles">
                Paiement bientôt disponible
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="faq">
        <div className="section-label fade-up">FAQ</div>
        <h2 className="fade-up fade-up-delay-1">Questions <em>fréquentes</em></h2>
        <div className="faq fade-up fade-up-delay-2">
          <FaqItem q="Qu'est-ce que « Préparer ma session » ?" a="C'est le moyen le plus rapide de démarrer une révision complète. En un clic, Jangalai génère simultanément un résumé, un quiz et des flashcards à partir de vos cours — le tout adapté à l'objectif que vous avez défini (examen demain, comprendre, mémoriser ou s'entraîner). Parfait la veille d'une évaluation." />
          <FaqItem q="Comment fonctionne l'objectif de session ?" a="Juste après avoir chargé votre cours, Jangalai vous demande votre objectif du moment. « Examen demain » génère un quiz difficile court et des cartes essentielles. « Mémoriser » maximise le nombre de flashcards. « S'entraîner » crée beaucoup de questions variées. Vous pouvez toujours passer cette étape et régler les paramètres manuellement." />
          <FaqItem q="Comment fonctionne « Revoir mes erreurs » ?" a="Après avoir soumis un quiz, le score affiche un bouton « Revoir les erreurs » qui relance un quiz avec uniquement les questions manquées. Vous pouvez aussi cliquer « Erreurs → Flashcards » pour transformer ces questions en cartes de révision instantanément, sans appel à l'IA." />
          <FaqItem q="Comment l'IA s'adapte-t-elle à mon profil ?" a="Lors de l'inscription, vous renseignez votre niveau (Licence, Master, Doctorat…) et votre domaine. Ces informations sont injectées dans chaque génération — vocabulaire, exemples, niveau de détail et complexité des questions sont calibrés à votre filière. L'objectif de session affine encore davantage le contenu généré." />
          <FaqItem q="Puis-je réviser sans charger de fichier ?" a="Oui. La section « Pour vous » de votre tableau de bord propose des sujets clés de votre domaine. En un clic, vous générez des flashcards ou un quiz sur n'importe quel sujet, sans rien importer." />
          <FaqItem q="Quels types de fichiers sont acceptés ?" a="PDF, PowerPoint (PPT/PPTX) et Word (DOCX) jusqu'à 20 Mo par fichier. Vous pouvez charger plusieurs fichiers simultanément pour un résumé ou quiz multi-documents." />
          <FaqItem q="Comment fonctionne la révision espacée ?" a="L'algorithme SM-2 planifie la révision de chaque flashcard au moment optimal selon vos performances passées. Les cartes maîtrisées reviennent moins souvent, les difficiles plus fréquemment. Des notifications push vous rappellent quand des cartes sont à réviser." />
          <FaqItem q="Mes cours sont-ils stockés sur vos serveurs ?" a="Le contenu textuel est conservé lorsque vous classez un cours dans une matière, ce qui vous permet de le réutiliser sans le recharger. Les fichiers originaux (PDF, PPT) ne sont pas conservés." />
          <FaqItem q="Les plans payants sont-ils disponibles ?" a="Pas encore. Vous pouvez utiliser le plan Gratuit dès maintenant. Les offres Pro et Max seront activées quand le paiement sera configuré." />
        </div>
      </div>

      <div className="cta-section">
        <h2 className="fade-up">Votre coach de révision,<br /><em>toujours prêt</em></h2>
        <p className="fade-up fade-up-delay-1">Objectif de session, "Préparer ma session", révision des erreurs, carte mentale, flashcards SRS. Tout ce dont vous avez besoin avant un examen, en un seul endroit.</p>
        <Link to="/login" className="btn-hero fade-up fade-up-delay-2" style={{ display: 'inline-flex' }}>Créer mon compte gratuit →</Link>
        <div className="cta-note fade-up fade-up-delay-3">Gratuit · Aucune carte bancaire requise · Prêt en 60 secondes</div>
      </div>

      <footer>
        <div className="footer-brand"><Logo size={24} /></div>
        <div className="footer-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">FAQ</a>
          <Link to="/login">Connexion</Link>
          <Link to="/login" style={{ color: 'var(--blue)' }}>Inscription</Link>
        </div>
        <div>© 2026 Jangalai</div>
      </footer>
    </>
  );
}
