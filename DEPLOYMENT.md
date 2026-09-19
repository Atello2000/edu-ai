# JangalAI Deployment

Production architecture:

```text
jangalai.online      -> Vercel frontend
api.jangalai.online  -> DigitalOcean App Platform backend
Postgres             -> Neon
```

## 1. Neon

Create a Neon project and copy its pooled Postgres connection string.

Configure it in DigitalOcean App Platform:

```text
DATABASE_URL=postgresql://...
DB_SSL_REJECT_UNAUTHORIZED=false
```

The app creates and migrates its schema on backend startup.

## 2. DigitalOcean App Platform

The backend is declared in `.do/app.yaml` and deployed from `main`:

```text
App name: jangalai-api
Region: London
Build: Dockerfile
HTTP port: 10000
Health check: /api/health
Automatic deployment: deploy_on_push
```

Set the custom domain:

```text
api.jangalai.online
```

Secrets referenced by `.do/app.yaml` must be configured in the DigitalOcean
dashboard and must never be committed to the repository.

## 3. Vercel

Deploy the repository on Vercel with:

```text
Build command: npm run build
Output directory: client/dist
```

The root `vercel.json` proxies browser calls from `/api/*` to:

```text
https://api.jangalai.online/api/*
```

This keeps the frontend code same-origin from the browser point of view and avoids
cross-site cookie/CSRF issues.

## 4. DNS

Configure:

```text
jangalai.online      -> Vercel
api.jangalai.online  -> DigitalOcean App Platform
```

After DNS is live, deploy DigitalOcean first, verify the API health, then Vercel.

Merging into `main` triggers both production deployments: DigitalOcean rebuilds
the backend and Vercel rebuilds the frontend. Neon remains the external database.

## 5. Smoke test

Check these URLs after deployment:

```text
https://api.jangalai.online/api/health
https://jangalai.online
```

Then test:

```text
register/login
upload PDF or DOCX
generate summary
payment checkout callback
Google OAuth callback, if enabled
```

## Proxy trust and billing corrections (September 2026)

The backend ignores x-vercel-forwarded-for unless x-jangalai-proxy-secret matches TRUSTED_PROXY_SECRET (at least 32 characters). Leave the secret unset for direct hosting: req.ip is used. With the existing Vercel rewrite, requests share the proxy IP until a trusted server-side proxy injects this secret and overwrites the client-IP header. Do not put this secret in VITE_* variables or public vercel.json headers. Configure a private proxy before scaling the split deployment; the safe fallback may group users under one rate limit.

Credits are added once per confirmed payment. No calendar-month balance reset occurs. Pro/Max access lasts 31 days from payment; remaining credits survive expiry. No schema migration is needed for this correction. Existing paid transactions without credits must be reconciled against provider records, not replayed blindly.

The payment return URL only starts verification. GET /api/payment/status/:reference requires the owner's authenticated account; paid is committed in the same SQL transaction as the credit and ledger entry. Keep PAYMENTS_LOCKED and VITE_PAYMENTS_LOCKED enabled until staging payment callbacks, retries and ownership checks pass.
