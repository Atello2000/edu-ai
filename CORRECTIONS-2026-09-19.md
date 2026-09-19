# Corrections de l'audit du 19 septembre 2026

Corrections locales, sans déploiement ni paiement réel.

- Crédit, historique et statut de paiement dans une transaction PostgreSQL unique. Une notification répétée ne recrédite pas le compte.
- Conservation du solde lors du changement de mois et de l'expiration du plan. Les jetons Pro/Max sont crédités à chaque paiement confirmé ; accès au plan pendant 31 jours.
- Confirmation par référence d'achat et compte propriétaire, pour abonnement comme recharge. Le retour du prestataire ne suffit plus à annoncer un succès.
- Allocation gratuite unifiée à 80 jetons, y compris Google ; textes harmonisés.
- Changement de mot de passe : révocation des anciennes sessions et reconnexion demandée.
- En-tête d'IP accepté seulement d'un proxy authentifié. Configuration nécessaire pour conserver une limitation par utilisateur derrière le proxy Vercel ; voir DEPLOYMENT.md.

Validation dans une copie isolée : 96 tests Jest réussis, 4 scénarios de suivi d'achat réussis, compilation Vite et ESLint réussis. 9 tests nécessitant PostgreSQL ignorés localement ; le nouveau test de panne/reprise et de notifications concurrentes est inclus pour la CI avec sa base de test. La compilation complète avec pré-rendu et les parcours navigateur réels ne sont pas validés ici.

Les paiements restent verrouillés par défaut. Les éventuels achats anciens marqués payés sans crédit doivent être rapprochés des données du prestataire ; aucune réparation aveugle des données existantes n'a été lancée.
