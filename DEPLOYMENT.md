# JangalAI Deployment

Recommended production layout:

```text
jangalai.online      -> Vercel frontend
api.jangalai.online  -> Render backend
Postgres             -> Supabase
```

## 1. Supabase

Create a Supabase project and copy the Postgres connection string.

Use the pooled connection string when possible for deployed apps, then set it in Render:

```text
DATABASE_URL=postgresql://...
DB_SSL_REJECT_UNAUTHORIZED=false
```

The app creates and migrates its schema on backend startup.

## 2. Render

Create a new Render Blueprint from this repository, or create a Web Service manually:

```text
Service name: jangalai-api
Build command: npm ci --include=dev && npm run build
Start command: npm start
Health check: /api/health
Plan: Standard or higher
```

Set the custom domain:

```text
api.jangalai.online
```

Required environment variables are listed in `render.yaml`. Values with `sync: false`
must be added in the Render dashboard.

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
api.jangalai.online  -> Render
```

After DNS is live, redeploy Render first, then Vercel.

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
