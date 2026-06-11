# Migration Render → DigitalOcean App Platform

Objectif : éliminer les cold starts du plan free Render. Le front Vercel et la DB Neon
ne bougent pas — seul le backend change d'hébergeur.

## Étapes

1. **Créer l'app** : dashboard DO → Apps → Create App → GitHub `Atello2000/edu-ai`
   (branche `main`, runtime Docker détecté automatiquement), puis dans l'onglet
   Spec coller `.do/app.yaml`. Ou en CLI : `doctl apps create --spec .do/app.yaml`.
2. **Renseigner les secrets** (Settings → api → Environment Variables) : recopier
   les valeurs depuis le dashboard Render du service « Jangalai api docker »
   (srv-d8i8kfek1jcs73a0gfkg). Liste complète dans `app.yaml` (type: SECRET).
3. **Tester sur l'URL ondigitalocean.app** fournie par DO :
   - `GET /api/health` → 200
   - login + une génération IA (vérifie DB, Groq, cookies)
4. **Basculer le DNS** : chez le registrar, pointer le CNAME `api.jangalai.online`
   vers l'app DO (valeur affichée dans Settings → Domains). DO provisionne le
   certificat TLS automatiquement.
5. **Vérifier PayTech** : l'URL IPN reste `https://api.jangalai.online/api/payment/ipn`,
   donc rien à changer côté PayTech une fois le DNS basculé.
6. **Après 24-48 h de stabilité** : suspendre le service Render et retirer le
   monitor UptimeRobot (plus nécessaire, pas de sleep sur DO basic).

## Points d'attention

- `initial_delay_seconds: 20` dans le health check couvre le réveil Neon
  (autosuspend 5-10 s) + initSchema avec retry.
- `basic-xs` (1 Go RAM) minimum : LibreOffice (conversion PPT) est gourmand.
- Coût : ~12 $/mois → couvert par le crédit GitHub Education (200 $ ≈ 16 mois).
- `render.yaml` et `railway.toml` deviennent obsolètes une fois la migration finie.
