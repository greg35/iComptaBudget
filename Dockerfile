# Multi-stage build pour iComptaBudget
FROM node:18-alpine AS base

# Installer les dépendances système
RUN apk add --no-cache libc6-compat sqlite

# Stage 1: Installation des dépendances
FROM base AS deps
WORKDIR /app

# Copier les fichiers package.json
COPY package*.json ./
COPY backend/package*.json ./backend/

# Installer toutes les dépendances (dev + production pour le build)
RUN npm ci
RUN cd backend && npm ci

# Stage 2: Build du frontend
FROM base AS builder
WORKDIR /app

# Copier les dépendances
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY . .

# Build du frontend
RUN npm run build

# Stage 3: Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Créer un utilisateur non-root
RUN addgroup --system --gid 1000 nodejs
RUN adduser --system --uid 1000 appuser

# Copier le frontend buildé
COPY --from=builder --chown=appuser:nodejs /app/build ./public

# Copier le backend source et ses node_modules
COPY --from=builder --chown=appuser:nodejs /app/backend ./backend
COPY --from=deps --chown=appuser:nodejs /app/backend/node_modules ./backend/node_modules

# Créer un serveur unifié qui sert le frontend et l'API
COPY --chown=appuser:nodejs <<'EOF' ./server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

// Start backend
require('./backend/index.js');

const PORT = process.env.PORT || 2112;
const PUBLIC_DIR = path.join(__dirname, 'public');

function proxyApi(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: 2113,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  const proxy = http.request(options, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res, { end: true });
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  req.pipe(proxy, { end: true });
}

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(req.url.split('?')[0] || '/'));
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(400); res.end('Invalid path'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const index = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(index, (e, data) => {
        if (e) { res.writeHead(500); res.end('Server error'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    const stream = fs.createReadStream(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api')) return proxyApi(req, res);
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`Frontend server running on http://0.0.0.0:${PORT}`));
EOF

# Créer les répertoires nécessaires avec les bonnes permissions (et dossier /data unifié)
RUN mkdir -p /app/data /app/logs /data && \
  chown -R appuser:nodejs /app/data /app/logs /data || true && \
  chmod 775 /app/data /app/logs /data || true

# Variables d'environnement pour les chemins de base de données (par défaut /data)
ENV DATA_DIR=/data
ENV DB_PATH=/data/Comptes.cdb
ENV DATA_DB_PATH=/data/iComptaBudgetData.sqlite

# Installer su-exec pour drop de privilèges propre
RUN apk add --no-cache su-exec bash

# Définir shell par défaut et alias pratique
ENV SHELL=/bin/bash
COPY <<'EOF' /etc/profile.d/aliases.sh
alias l='ls -l'
EOF

# Script d'entrypoint pour ajuster permissions dynamiques quand volume monté
COPY <<'EOF' /entrypoint.sh
#!/bin/sh
set -e

APP_USER=appuser
APP_GROUP=nodejs
APP_UID=${APP_UID:-1000}
APP_GID=${APP_GID:-1000}
DATA_DIR=${DATA_DIR:-/data}

echo "[entrypoint] Starting with user=$(id -u), DATA_DIR=$DATA_DIR"

# Créer les répertoires nécessaires
mkdir -p "$DATA_DIR" /app/logs || true

# Toujours corriger les permissions si on est root
if [ "$(id -u)" = "0" ]; then
  echo "[entrypoint] Running as root, fixing permissions..."
  
  # Forcer la correction des permissions du volume data
  chown -R "$APP_UID:$APP_GID" "$DATA_DIR" || true
  chmod -R 775 "$DATA_DIR" || true
  
  # Corriger les logs aussi
  chown -R "$APP_UID:$APP_GID" /app/logs || true
  chmod 755 /app/logs || true
  
  echo "[entrypoint] Permissions fixed for $DATA_DIR"
else
  echo "[entrypoint] Running as non-root user $(id -u)"
fi

# Pré-créer les fichiers DB si absents avec les bonnes permissions
#if [ -n "$DB_PATH" ] && [ ! -e "$DB_PATH" ]; then
#  touch "$DB_PATH" || true
#  [ "$(id -u)" = "0" ] && chown "$APP_UID:$APP_GID" "$DB_PATH" || true
#fi

#if [ -n "$DATA_DB_PATH" ] && [ ! -e "$DATA_DB_PATH" ]; then
#  touch "$DATA_DB_PATH" || true
#  [ "$(id -u)" = "0" ] && chown "$APP_UID:$APP_GID" "$DATA_DB_PATH" || true
#fi

# Vérifier les permissions finales
echo "[entrypoint] Final permissions check:"
ls -la "$DATA_DIR" || true

# Démarrer l'application
if [ "$(id -u)" = "0" ]; then
  echo "[entrypoint] Switching to user $APP_UID:$APP_GID and starting server..."
  exec su-exec "$APP_UID:$APP_GID" node server.js
else
  echo "[entrypoint] Starting server as current user..."
  exec node server.js
fi
EOF

RUN chmod +x /entrypoint.sh

# Exposer le port du serveur unifié
EXPOSE 2112

# Health check amélioré
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 2112, path: '/api/health', timeout: 5000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

ENTRYPOINT ["/entrypoint.sh"]
