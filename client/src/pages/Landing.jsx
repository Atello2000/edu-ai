import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => { if (user) navigate('/app'); }, [user]);
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
        <div className="hero-badge fade-up">Résultats visibles dès la première révision</div>
        <h1 className="fade-up fade-up-delay-1">Transformez vos cours en <em>intelligence</em></h1>
        <p className="fade-up fade-up-delay-2">
          Chargez vos PDF ou PowerPoint — l'IA génère résumés, quiz, flashcards et répond à toutes vos questions en quelques secondes.
        </p>
        <div className="hero-btns fade-up fade-up-delay-3">
          <Link to="/login" className="btn-hero">Commencer gratuitement →</Link>
          <a href="#how-it-works" className="btn-hero-outline">▶ Voir comment ça marche</a>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat-item fade-up"><div className="stat-value" data-count="4800" data-suffix="+">0</div><div className="stat-label">Étudiants actifs</div></div>
        <div className="stat-item fade-up fade-up-delay-1"><div className="stat-value" data-count="120000" data-suffix="+">0</div><div className="stat-label">Flashcards créées</div></div>
        <div className="stat-item fade-up fade-up-delay-2"><div className="stat-value" data-count="98" data-suffix="%">0</div><div className="stat-label">Satisfaction utilisateurs</div></div>
        <div className="stat-item fade-up fade-up-delay-3"><div className="stat-value" data-count="35000" data-suffix="+">0</div><div className="stat-label">Quiz générés</div></div>
      </div>

      <div className="mockup-section">
        <div className="section-label fade-up">Aperçu de l'application</div>
        <h2 className="fade-up fade-up-delay-1" style={{ marginBottom: '2.5rem' }}>Votre salle de révision <em>intelligente</em></h2>
        <div className="app-mockup fade-up fade-up-delay-2">
          <div className="mockup-bar">
            <div className="mockup-dot red"/><div className="mockup-dot yellow"/><div className="mockup-dot green"/>
            <div className="mockup-url">jangalai.app · Flashcards</div>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-title">Mes cours</div>
              <div className="mockup-file active"><span className="fi">📄</span> Biochimie S3.pdf</div>
              <div className="mockup-file"><span className="fi">📊</span> Marketing Mix.pptx</div>
              <div className="mockup-file"><span className="fi">📄</span> Droit des contrats.pdf</div>
              <div className="mockup-file"><span className="fi">📝</span> Maths Appliquées.docx</div>
              <div style={{ marginTop: '1.5rem', padding: '.5rem .6rem', background: 'var(--blue-bg)', border: '1px dashed rgba(61,126,255,.3)', borderRadius: '8px', fontSize: '.72rem', color: 'var(--blue)', textAlign: 'center' }}>+ Ajouter un cours</div>
            </div>
            <div className="mockup-main">
              <div className="mockup-tabs">
                <div className="mockup-tab">Résumé</div>
                <div className="mockup-tab">Quiz</div>
                <div className="mockup-tab active">Flashcards</div>
                <div className="mockup-tab">Chat</div>
                <div className="mockup-tab">Fiche exam</div>
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
                <span style={{ marginLeft: 'auto', color: 'var(--teal)' }}>🔥 5j de suite</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="how-it-works">
        <div className="section-label fade-up">Comment ça marche</div>
        <h2 className="fade-up fade-up-delay-1">Trois étapes vers la <em>maîtrise</em></h2>
        <div className="steps-grid">
          <div className="step-card fade-up fade-up-delay-1"><div className="step-number">01</div><div className="step-icon">📂</div><h3>Chargez votre cours</h3><p>Glissez-déposez un PDF, PowerPoint ou Word. Jangalai lit, comprend et structure votre document en quelques secondes.</p></div>
          <div className="step-card fade-up fade-up-delay-2"><div className="step-number">02</div><div className="step-icon">⚡</div><h3>L'IA génère tout</h3><p>Résumé structuré, flashcards, quiz QCM, fiche d'examen — tout est créé automatiquement et adapté au contenu de votre cours.</p></div>
          <div className="step-card fade-up fade-up-delay-3"><div className="step-number">03</div><div className="step-icon">🧠</div><h3>Révisez intelligemment</h3><p>L'algorithme de répétition espacée SM-2 planifie vos révisions au moment optimal. Vous progressez sans effort supplémentaire.</p></div>
        </div>
      </div>

      <div className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="section-label fade-up">Fonctionnalités</div>
        <h2 className="fade-up fade-up-delay-1">Tout ce dont vous avez besoin pour <em>réussir</em></h2>
        <div className="features-grid">
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon purple">📄</div><h3>Résumés structurés</h3><p>5 sections claires générées en secondes : objectifs, points clés, résumé détaillé, concepts et à retenir.</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon blue">❓</div><h3>Quiz QCM adaptatif</h3><p>Questions générées depuis vos cours, 3 niveaux de difficulté, mode examen avec chronomètre intégré.</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon teal">🃏</div><h3>Flashcards intelligentes</h3><p>Algorithme SM-2 — vous révisez ce que vous ne maîtrisez pas encore, exactement au bon moment.</p></div>
          <div className="feature-card fade-up fade-up-delay-1"><div className="feat-icon gold">💬</div><h3>Chat avec le cours</h3><p>Posez n'importe quelle question sur vos fichiers. Joignez une image ou un devoir pour le faire corriger.</p></div>
          <div className="feature-card fade-up fade-up-delay-2"><div className="feat-icon purple">📋</div><h3>Fiche d'examen</h3><p>Définitions, pièges à éviter, tableaux de synthèse et questions probables — générés en un clic.</p></div>
          <div className="feature-card fade-up fade-up-delay-3"><div className="feat-icon blue">📊</div><h3>Suivi de progression</h3><p>Tableau de bord avec scores, temps de révision, cartes maîtrisées et statistiques de session.</p></div>
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
          <p className="fade-up fade-up-delay-2" style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: '2.5rem' }}>Commencez gratuitement, passez à Pro quand vous en avez besoin.</p>
          <div className="pricing-grid">
            <div className="price-card fade-up fade-up-delay-1">
              <div className="plan-name">Gratuit</div>
              <div className="plan-price">0€ <span>/ mois</span></div>
              <div className="plan-desc">Pour découvrir Jangalai sans engagement</div>
              <div className="plan-features">
                <div className="plan-feat">3 résumés / jour</div>
                <div className="plan-feat">5 quiz / jour</div>
                <div className="plan-feat">5 flashcards / jour</div>
                <div className="plan-feat">5 messages chat / jour</div>
                <div className="plan-feat">PDF, PPT, DOCX</div>
              </div>
              <Link to="/login"><button className="plan-cta">Commencer gratuitement</button></Link>
            </div>
            <div className="price-card featured fade-up fade-up-delay-2">
              <div className="price-badge">Le plus populaire</div>
              <div className="plan-name">Pro</div>
              <div className="plan-price">4€ <span>/ mois</span></div>
              <div className="plan-desc">Pour les étudiants en période d'examen</div>
              <div className="plan-features">
                <div className="plan-feat">15 résumés / jour</div>
                <div className="plan-feat">30 quiz / jour</div>
                <div className="plan-feat">30 flashcards / jour</div>
                <div className="plan-feat">20 messages chat / jour</div>
                <div className="plan-feat">Traitement prioritaire</div>
                <div className="plan-feat">Historique illimité</div>
              </div>
              <Link to="/login"><button className="plan-cta">Choisir Pro</button></Link>
            </div>
            <div className="price-card fade-up fade-up-delay-3">
              <div className="plan-name">Max</div>
              <div className="plan-price">9€ <span>/ mois</span></div>
              <div className="plan-desc">Pour une révision intensive sans limites</div>
              <div className="plan-features">
                <div className="plan-feat">50 résumés / jour</div>
                <div className="plan-feat">100 quiz / jour</div>
                <div className="plan-feat">100 flashcards / jour</div>
                <div className="plan-feat">60 messages chat / jour</div>
                <div className="plan-feat">Traitement prioritaire</div>
                <div className="plan-feat">Historique illimité</div>
                <div className="plan-feat">Export PDF des fiches</div>
              </div>
              <Link to="/login"><button className="plan-cta">Choisir Max</button></Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="faq">
        <div className="section-label fade-up">FAQ</div>
        <h2 className="fade-up fade-up-delay-1">Questions <em>fréquentes</em></h2>
        <div className="faq fade-up fade-up-delay-2">
          <FaqItem q="Quels types de fichiers sont acceptés ?" a="PDF, PowerPoint (PPT/PPTX) et Word (DOCX) jusqu'à 20 Mo par fichier. Vous pouvez charger plusieurs fichiers simultanément." />
          <FaqItem q="Mes cours sont-ils stockés sur vos serveurs ?" a="Le contenu textuel de vos cours est conservé sur votre compte lorsque vous les classez dans une matière, ce qui vous permet de les réutiliser sans les recharger. Les fichiers originaux (PDF, PPT) ne sont pas conservés." />
          <FaqItem q="Comment organiser mes cours par matière ?" a="Après chaque import, Jangalai vous propose de classer vos fichiers dans une matière. Vous pouvez créer autant de matières que vous le souhaitez et retrouver vos cours depuis « Mes matières » sur le tableau de bord." />
          <FaqItem q="Comment fonctionne la révision espacée ?" a="L'algorithme SM-2 planifie la révision de chaque flashcard au moment optimal selon vos performances passées. Vous révisez moins mais mieux — les cartes maîtrisées reviennent moins souvent, les difficiles plus fréquemment." />
          <FaqItem q="La qualité des résumés dépend-elle du cours chargé ?" a="Oui — plus le document est structuré (titres, sections claires), meilleurs sont les résultats. Jangalai gère très bien les PDF issus de diaporamas de cours, les polys et les documents Word mis en page." />
          <FaqItem q="Puis-je annuler mon abonnement ?" a="Oui, à tout moment depuis votre compte. Votre profil repasse automatiquement en plan Gratuit à la fin de la période payée, sans frais cachés." />
        </div>
      </div>

      <div className="cta-section">
        <h2 className="fade-up">Prêt à réviser <em>différemment</em> ?</h2>
        <p className="fade-up fade-up-delay-1">Rejoignez des milliers d'étudiants qui ont transformé leur façon de préparer les examens.</p>
        <Link to="/login" className="btn-hero fade-up fade-up-delay-2" style={{ display: 'inline-flex' }}>Créer mon compte gratuit →</Link>
        <div className="cta-note fade-up fade-up-delay-3">Gratuit · Aucune carte bancaire requise · Prêt en 30 secondes</div>
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
        <div>© 2025 Jangalai</div>
      </footer>
    </>
  );
}
