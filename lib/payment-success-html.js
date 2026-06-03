/**
 * lib/payment-success-html.js
 * Génère le HTML de la page de succès de paiement mobile.
 * Le paramètre `plan` est whitlisté en amont — cette fonction lui fait confiance.
 */
'use strict';

const PLAN_LABELS = { pro: 'PRO', max: 'MAX' };
const PLAN_JETONS = { pro: '150', max: '400' };

const COLORS = {
  pro: {
    accent:    '#f5a623',
    accent2:   '#f76b1c',
    bg:        'rgba(245,166,35,0.1)',
    border:    'rgba(245,166,35,0.3)',
    shadow:    'rgba(245,166,35,0.2)',
    btnShadow: 'rgba(245,166,35,0.4)',
    check:     '#f5a623',
    stop1:     '#ffb703',
    stop2:     '#fb8500',
  },
  max: {
    accent:    '#a855f7',
    accent2:   '#ec4899',
    bg:        'rgba(168,85,247,0.1)',
    border:    'rgba(168,85,247,0.3)',
    shadow:    'rgba(168,85,247,0.2)',
    btnShadow: 'rgba(168,85,247,0.4)',
    check:     '#a855f7',
    stop1:     '#c084fc',
    stop2:     '#db2777',
  },
};

function buildPaymentSuccessHtml(plan, hasToken) {
  const c = COLORS[plan] || COLORS.pro;
  const label  = PLAN_LABELS[plan] || plan.toUpperCase();
  const jetons = PLAN_JETONS[plan] || '150';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Abonnement activé - Jangalai</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: #0b0f19; color: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 24px 16px;
      text-align: center; overflow-x: hidden;
    }
    .card {
      background: rgba(17,24,39,0.7);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 28px; padding: 40px 24px;
      max-width: 420px; width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px ${c.shadow};
      backdrop-filter: blur(16px);
      position: relative;
      animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
    }
    .glow {
      position: absolute; top: -10%; left: 50%; transform: translateX(-50%);
      width: 180px; height: 180px;
      background: radial-gradient(circle, ${c.bg.replace('0.1', '0.3')} 0%, transparent 70%);
      pointer-events: none; z-index: 0;
    }
    .icon-wrap {
      position: relative; z-index: 1;
      width: 84px; height: 84px; border-radius: 50%;
      background: ${c.bg}; border: 1.5px solid ${c.border};
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 0 20px ${c.shadow};
      animation: pop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) both;
    }
    .star-icon { width: 44px; height: 44px; }
    h1 {
      font-size: clamp(22px,6.5vw,28px); margin: 0 0 12px; font-weight: 800;
      background: linear-gradient(135deg, ${c.accent} 0%, ${c.accent2} 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin: 0 0 28px; padding: 0 8px; }
    .benefits-box {
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px; padding: 16px; margin-bottom: 32px; text-align: left;
    }
    .benefits-title { margin: 0 0 10px; font-size: 12px; text-transform: uppercase;
      color: #64748b; letter-spacing: 0.05em; font-weight: 700; }
    .benefits-list { list-style: none; padding: 0; margin: 0; }
    .benefits-item { display: flex; align-items: center; gap: 10px;
      font-size: 13.5px; color: #fff; margin-bottom: 8px; }
    .benefits-item:last-child { margin-bottom: 0; }
    .benefits-check { color: ${c.check}; font-weight: bold; }
    .btn-close {
      background: linear-gradient(135deg, ${c.accent} 0%, ${c.accent2} 100%);
      color: white; border: none; padding: 16px 28px; font-weight: 600;
      border-radius: 16px; font-size: 15px; cursor: pointer; width: 100%;
      box-shadow: 0 10px 20px -5px ${c.btnShadow};
      transition: opacity 0.2s, transform 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-close:active { transform: scale(0.98); opacity: 0.95; }
    .btn-secondary {
      background: rgba(255,255,255,0.06) !important; box-shadow: none !important;
      color: #94a3b8 !important; border: 1px solid rgba(255,255,255,0.1) !important;
    }
    @keyframes slideUp { 0%{transform:translateY(20px);opacity:0} 100%{transform:translateY(0);opacity:1} }
    @keyframes pop     { 0%{transform:scale(0)} 100%{transform:scale(1)} }
    @media (prefers-reduced-motion: reduce) {
      .card, .icon-wrap { animation: none; }
      .btn-close:active { transform: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="icon-wrap">
      <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          fill="url(#sg)" stroke="${c.accent}" stroke-width="1.5"/>
        <defs>
          <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="${c.stop1}"/>
            <stop offset="100%" stop-color="${c.stop2}"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h1>Abonnement activé</h1>
    <p>Votre compte a été mis à niveau vers le plan <strong>${label}</strong> avec succès.</p>
    <div class="benefits-box">
      <h4 class="benefits-title">Vos avantages débloqués</h4>
      <ul class="benefits-list">
        <li class="benefits-item"><span class="benefits-check">✓</span><strong>${jetons} jetons</strong> alloués pour ce mois</li>
        <li class="benefits-item"><span class="benefits-check">✓</span>Outils IA avancés activés</li>
        <li class="benefits-item"><span class="benefits-check">✓</span>Taille maximale des fichiers augmentée</li>
      </ul>
    </div>
    ${hasToken
      ? `<button class="btn-close" onclick="window.location.href='/app'">Accéder à l'application →</button>`
      : `<button class="btn-close btn-secondary" onclick="window.location.href='/'">Retour au site</button>
         <p style="font-size:13px;color:#475569;margin:16px 0 0;line-height:1.6;padding:0 4px;">
           Votre plan est déjà actif.<br>Retournez sur l'onglet de votre PC —<br>l'application s'est débloquée automatiquement.
         </p>
         <a href="/login" style="display:inline-block;margin-top:14px;font-size:12.5px;color:#64748b;text-decoration:underline;">
           Se connecter sur ce mobile
         </a>`
    }
  </div>
</body>
</html>`;
}

module.exports = { buildPaymentSuccessHtml };
