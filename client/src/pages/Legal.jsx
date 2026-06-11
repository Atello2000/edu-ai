import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import './Legal.css';

const CONTACT_EMAIL = 'contact@jangalai.online';
const LAST_UPDATE   = '11 juin 2026';

function LegalLayout({ title, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-logo"><Logo size={28} /></Link>
      </header>
      <main className="legal-content">
        <h1>{title}</h1>
        <p className="legal-updated">Dernière mise à jour : {LAST_UPDATE}</p>
        {children}
      </main>
      <footer className="legal-footer">
        <Link to="/cgu">Conditions d'utilisation</Link>
        <Link to="/confidentialite">Politique de confidentialité</Link>
        <Link to="/">Accueil</Link>
      </footer>
    </div>
  );
}

export function CGU() {
  return (
    <LegalLayout title="Conditions Générales d'Utilisation">
      <section>
        <h2>1. Objet</h2>
        <p>
          Jangalai (« le Service ») est une plateforme en ligne accessible sur{' '}
          <a href="https://jangalai.online">jangalai.online</a> qui permet aux étudiants de
          transformer leurs supports de cours (PDF, PowerPoint, texte, images) en outils de
          révision générés par intelligence artificielle : résumés, quiz, flashcards, cartes
          mentales, fiches d'examen, plans de révision et tutorat conversationnel.
        </p>
        <p>
          L'utilisation du Service implique l'acceptation pleine et entière des présentes
          conditions. Si vous n'acceptez pas ces conditions, n'utilisez pas le Service.
        </p>
      </section>

      <section>
        <h2>2. Compte et accès</h2>
        <ul>
          <li>La création d'un compte nécessite une adresse e-mail valide, vérifiée par un lien de confirmation, ou une connexion via Google.</li>
          <li>Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte.</li>
          <li>Le Service est en phase de lancement : le nombre d'inscriptions peut être temporairement limité.</li>
          <li>Le Service s'adresse aux étudiants et apprenants. Si vous avez moins de 16 ans, l'accord d'un parent ou tuteur légal est requis.</li>
        </ul>
      </section>

      <section>
        <h2>3. Jetons et formules</h2>
        <ul>
          <li>Chaque action IA (résumé, quiz, flashcards, chat…) consomme des <strong>jetons</strong>. Le barème est affiché dans l'application.</li>
          <li>La formule gratuite inclut une allocation mensuelle de jetons, renouvelée chaque mois sans report du solde non utilisé.</li>
          <li>Les formules payantes <strong>Pro</strong> et <strong>Max</strong> sont des abonnements mensuels facturés en francs CFA (XOF), donnant droit à une allocation de jetons supérieure.</li>
          <li>En cas d'échec technique d'une génération IA, les jetons consommés sont automatiquement remboursés sur votre solde.</li>
        </ul>
      </section>

      <section>
        <h2>4. Paiement</h2>
        <ul>
          <li>Les paiements sont traités par <strong>PayTech</strong> (paytech.sn), prestataire de paiement agréé au Sénégal (Orange Money, Wave, carte bancaire…). Jangalai ne stocke aucune donnée de carte bancaire ni de compte mobile money.</li>
          <li>L'abonnement est activé dès confirmation du paiement par PayTech et reste valable 31 jours. Il ne se renouvelle pas automatiquement.</li>
          <li>Toute somme versée pour une période entamée reste acquise, sauf défaillance avérée du Service imputable à Jangalai, auquel cas un avoir en jetons ou un remboursement pourra être accordé après examen. Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
        </ul>
      </section>

      <section>
        <h2>5. Contenus et propriété intellectuelle</h2>
        <ul>
          <li>Vous conservez l'entière propriété des documents que vous chargez sur le Service. Vous garantissez disposer des droits nécessaires sur ces documents.</li>
          <li>Les contenus générés par l'IA à partir de vos documents vous sont destinés ; vous pouvez les utiliser librement dans le cadre de vos études.</li>
          <li>La marque, l'interface et le code de Jangalai restent la propriété exclusive de l'éditeur.</li>
        </ul>
      </section>

      <section>
        <h2>6. Usage acceptable</h2>
        <p>Il est interdit d'utiliser le Service pour :</p>
        <ul>
          <li>charger des contenus illégaux, diffamatoires ou portant atteinte aux droits de tiers ;</li>
          <li>tenter de contourner les limitations techniques (quotas, jetons, limites bêta) ;</li>
          <li>perturber le fonctionnement du Service (surcharge volontaire, extraction automatisée massive, ingénierie inverse) ;</li>
          <li>frauder à l'occasion d'examens lorsque le règlement de votre établissement l'interdit. Jangalai est un outil de <em>révision</em>, pas de triche.</li>
        </ul>
        <p>Tout manquement peut entraîner la suspension ou la suppression du compte, sans remboursement.</p>
      </section>

      <section>
        <h2>7. Nature des contenus générés par IA</h2>
        <p>
          Les résumés, quiz, explications et autres contenus sont générés automatiquement par des
          modèles d'intelligence artificielle. Malgré le soin apporté, <strong>ils peuvent contenir
          des erreurs, omissions ou approximations</strong>. Ils ne remplacent ni vos cours, ni vos
          enseignants. Vérifiez toujours les informations importantes dans vos supports officiels
          avant un examen. Jangalai ne garantit aucun résultat académique.
        </p>
      </section>

      <section>
        <h2>8. Disponibilité et responsabilité</h2>
        <ul>
          <li>Le Service est fourni « en l'état ». Jangalai s'efforce d'assurer une disponibilité maximale mais ne garantit pas un fonctionnement ininterrompu (maintenance, panne des fournisseurs d'IA tiers, force majeure).</li>
          <li>La responsabilité de Jangalai, toutes causes confondues, est limitée au montant payé par l'utilisateur au cours des 3 derniers mois.</li>
        </ul>
      </section>

      <section>
        <h2>9. Résiliation</h2>
        <p>
          Vous pouvez cesser d'utiliser le Service à tout moment et demander la suppression de
          votre compte et de vos données en écrivant à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. La suppression du compte
          entraîne l'effacement de vos documents, de votre historique et de vos données
          personnelles (voir la <Link to="/confidentialite">Politique de confidentialité</Link>).
        </p>
      </section>

      <section>
        <h2>10. Droit applicable</h2>
        <p>
          Les présentes conditions sont régies par le droit sénégalais. Tout litige sera soumis,
          à défaut de résolution amiable, aux juridictions compétentes de Dakar (Sénégal).
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Pour toute question relative aux présentes conditions :{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}

export function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des données collectées sur{' '}
          <a href="https://jangalai.online">jangalai.online</a> est l'éditeur de Jangalai,
          joignable à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          Cette politique s'applique conformément à la <strong>loi sénégalaise n° 2008-12 du
          25 janvier 2008</strong> portant sur la protection des données à caractère personnel,
          et, pour les utilisateurs concernés de l'Union européenne, au <strong>Règlement général
          sur la protection des données (RGPD)</strong>.
        </p>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <ul>
          <li><strong>Données de compte</strong> : adresse e-mail, nom, mot de passe (stocké chiffré, jamais en clair), niveau d'études, domaines d'étude, spécialité.</li>
          <li><strong>Documents de cours</strong> : les fichiers (PDF, PowerPoint, images, texte) que vous chargez pour générer des contenus de révision, et ceux que vous choisissez d'enregistrer dans votre bibliothèque.</li>
          <li><strong>Données d'utilisation</strong> : historique de vos générations (quiz, flashcards, scores), consommation de jetons, volumes de tokens IA utilisés.</li>
          <li><strong>Données de paiement</strong> : référence et montant des transactions. Les données de carte bancaire ou de mobile money sont traitées exclusivement par PayTech et ne transitent jamais par nos serveurs.</li>
          <li><strong>Données techniques</strong> : adresse IP (journaux de sécurité et limitation de débit), cookies strictement nécessaires.</li>
        </ul>
      </section>

      <section>
        <h2>3. Traitement par des fournisseurs d'intelligence artificielle</h2>
        <p>
          <strong>Point important :</strong> pour générer vos résumés, quiz et autres contenus,
          le texte de vos documents (et vos images dans le cas de la reconnaissance de contenu)
          est transmis à des fournisseurs de modèles d'IA tiers, qui le traitent pour notre compte :
        </p>
        <ul>
          <li>Google (Gemini) — y compris pour l'extraction de texte de documents,</li>
          <li>Mistral AI,</li>
          <li>Groq,</li>
          <li>Anthropic (Claude) — pour l'analyse d'images,</li>
          <li>DeepSeek et GitHub Models, le cas échéant.</li>
        </ul>
        <p>
          Ces transmissions sont limitées au contenu nécessaire à la génération demandée et sont
          effectuées via des connexions chiffrées. Ces fournisseurs traitent les données
          conformément à leurs propres politiques de confidentialité. <strong>Ne chargez pas de
          documents contenant des données sensibles</strong> (données médicales, judiciaires,
          financières personnelles…) : le Service est conçu pour des supports de cours.
        </p>
      </section>

      <section>
        <h2>4. Finalités et bases légales</h2>
        <ul>
          <li><strong>Fourniture du Service</strong> (compte, générations IA, bibliothèque, paiement) — exécution du contrat.</li>
          <li><strong>Sécurité</strong> (authentification, prévention de la fraude, limitation de débit) — intérêt légitime.</li>
          <li><strong>E-mails transactionnels</strong> (vérification d'adresse, réinitialisation de mot de passe) — exécution du contrat. Aucune prospection commerciale sans votre consentement.</li>
        </ul>
      </section>

      <section>
        <h2>5. Sous-traitants et hébergement</h2>
        <ul>
          <li><strong>DigitalOcean</strong> (Londres, Royaume-Uni) — hébergement du serveur applicatif.</li>
          <li><strong>Vercel</strong> — diffusion de l'interface web.</li>
          <li><strong>Neon</strong> — base de données PostgreSQL.</li>
          <li><strong>Resend</strong> — envoi des e-mails transactionnels.</li>
          <li><strong>PayTech</strong> (Sénégal) — traitement des paiements.</li>
          <li>Fournisseurs d'IA listés à la section 3.</li>
        </ul>
        <p>
          Certains de ces prestataires sont situés hors du Sénégal et de l'Union européenne ;
          les transferts sont encadrés par leurs engagements contractuels de protection des données.
        </p>
      </section>

      <section>
        <h2>6. Durées de conservation</h2>
        <ul>
          <li><strong>Compte et bibliothèque</strong> : conservés tant que le compte est actif ; supprimés à la suppression du compte.</li>
          <li><strong>Cache des générations IA</strong> : 6 heures maximum.</li>
          <li><strong>Contenus partagés par lien</strong> : 7 jours, puis suppression automatique.</li>
          <li><strong>Historique de consommation de jetons</strong> : 6 mois.</li>
          <li><strong>Transactions de paiement</strong> : durée légale de conservation comptable.</li>
        </ul>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>
          Jangalai n'utilise que des cookies <strong>strictement nécessaires</strong> au
          fonctionnement du Service : cookies d'authentification (session et reconnexion) et
          cookie de protection contre les attaques CSRF. Aucun cookie publicitaire, aucun
          traceur tiers, aucune revente de données. C'est pourquoi aucune bannière de
          consentement n'est requise.
        </p>
      </section>

      <section>
        <h2>8. Sécurité</h2>
        <ul>
          <li>Connexions chiffrées (TLS) sur l'ensemble du Service.</li>
          <li>Mots de passe hachés avec bcrypt — jamais stockés ni transmis en clair.</li>
          <li>Sessions à jetons rotatifs avec détection de vol de session.</li>
          <li>Limitation de débit et journalisation de sécurité.</li>
        </ul>
      </section>

      <section>
        <h2>9. Vos droits</h2>
        <p>
          Conformément à la loi n° 2008-12 et, le cas échéant, au RGPD, vous disposez des droits
          d'<strong>accès</strong>, de <strong>rectification</strong>, d'<strong>effacement</strong>,
          d'<strong>opposition</strong> et de <strong>portabilité</strong> de vos données.
        </p>
        <p>
          Pour les exercer, écrivez à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> depuis
          l'adresse e-mail associée à votre compte. Réponse sous 30 jours au plus.
        </p>
        <p>
          Vous pouvez également saisir la <strong>Commission de protection des Données
          Personnelles (CDP)</strong> du Sénégal (<a href="https://www.cdp.sn" target="_blank" rel="noopener noreferrer">cdp.sn</a>)
          ou, pour les résidents de l'UE, votre autorité de contrôle locale.
        </p>
      </section>

      <section>
        <h2>10. Modifications</h2>
        <p>
          Cette politique peut évoluer avec le Service. En cas de changement substantiel
          (nouveau sous-traitant IA, nouvelle finalité), vous en serez informé via
          l'application ou par e-mail. La date de dernière mise à jour figure en haut de page.
        </p>
      </section>
    </LegalLayout>
  );
}
