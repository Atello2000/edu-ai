FROM node:20-bookworm-slim

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-dejavu \
  fonts-liberation \
  libreoffice \
  libreoffice-impress \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && rm -rf client/node_modules client/dist

ENV NODE_ENV=production
ENV PORT=10000
ENV LIBREOFFICE_PATH=/usr/bin/soffice

EXPOSE 10000

CMD ["npm", "start"]
