# Jangalai — Frontend

Interface React + Vite de la plateforme Jangalai.

## Développement

```bash
npm install
npm run dev      # démarre sur http://localhost:5173
```

## Build production

```bash
npm run build    # génère client/dist/
```

Le build est automatiquement lancé par `npm run build` à la racine du projet
(via `scripts/inject-sw-version.js` + `scripts/copy-public.js`).
