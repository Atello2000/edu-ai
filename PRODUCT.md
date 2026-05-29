# Product

## Register

product

## Users

Étudiants et apprenants francophones (Licence, Master, Doctorat) et professionnels en
formation, principalement au Sénégal et en Afrique de l'Ouest. Ils arrivent avec des
supports de cours (PDF, PPT) et veulent réviser efficacement sous contrainte de temps,
souvent à l'approche d'un examen. Le contexte d'usage : session de travail concentrée,
sur ordinateur ou mobile, parfois en connexion limitée. Langues : français (par défaut),
anglais, arabe.

## Product Purpose

EDU AI transforme un cours (PDF/PPT) en outils de révision générés par IA : résumé
pédagogique structuré, fiche d'examen, quiz, flashcards (avec répétition espacée),
glossaire, questions probables, plan de révision, analyse d'erreurs, et un mode socratique.
L'objectif : faire passer l'étudiant du document brut à une compréhension active le plus
vite possible. Le succès se mesure à la confiance de l'étudiant le jour de l'examen et à
la rapidité de la boucle « charger → comprendre → s'auto-évaluer ».

## Brand Personality

Pro & premium. Voix : claire, sûre d'elle, encourageante sans être infantilisante.
Trois mots : crédible, épuré, focalisé. L'interface doit donner l'impression d'un outil
SaaS sérieux (registre Linear / Notion) auquel on confie ses révisions, pas d'un gadget.
Le calme et la lisibilité priment ; la couleur et le mouvement servent l'état et le
feedback, jamais la décoration.

## Anti-references

- **Le « site pondu par une IA »** : dégradés violets, glassmorphism décoratif, grilles de
  cartes identiques icône+titre+texte, polices génériques, eyebrows en petites capitales
  au-dessus de chaque section.
- **L'esthétique « éducatif » surchargée et datée** : trop d'éléments à l'écran, couleurs
  criardes, mise en page brouillonne de site scolaire.
- **Le corporate froid** : bleu marine terne, rigidité sans âme, qui décourage des étudiants.

## Design Principles

- **L'outil disparaît dans la tâche.** Familiarité gagnée plutôt que surprise ; chaque écran
  sert l'action en cours (réviser), pas l'esthétique.
- **Lisibilité d'abord.** Contraste et hiérarchie claire avant tout effet ; un étudiant fatigué
  doit lire sans effort.
- **Le feedback rassure.** Génération, chargement, progression et erreurs sont toujours visibles
  et compréhensibles (l'IA ne doit jamais sembler bloquée ou muette).
- **Vocabulaire cohérent.** Même forme de bouton, mêmes contrôles, mêmes états (hover/focus/
  disabled/loading) d'un panneau à l'autre.
- **Multilingue assumé.** FR / EN / AR de première classe, y compris la lecture droite-à-gauche.

## Accessibility & Inclusion

Cible WCAG 2.1 AA : contraste du texte ≥ 4.5:1 (≥ 3:1 grand texte), navigation clavier
complète avec focus visible, rôles/labels ARIA sur les éléments interactifs, hiérarchie de
titres sémantique, labels de formulaire explicites. Respect de `prefers-reduced-motion`.
Support arabe (RTL) et police adaptée. Cibles tactiles ≥ 44×44px sur mobile.
