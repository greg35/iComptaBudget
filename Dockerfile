# Multi-stage build pour iComptaBudget
FROM node:18-alpine AS base

# Installer les dépendances système
RUN apk add --no-cache libc6-compat

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
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copier le frontend buildé
COPY --from=builder --chown=appuser:nodejs /app/build ./public

# Copier le backend source (depuis builder) et ses node_modules (depuis deps)
# Le stage 'deps' n'a que les node_modules backend, le code source vient du stage 'builder'.
COPY --from=builder --chown=appuser:nodejs /app/backend ./backend
COPY --from=deps --chown=appuser:nodejs /app/backend/node_modules ./backend/node_modules

# Créer un serveur unifié qui sert le frontend et l'API
COPY --chown=appuser:nodejs <<'EOF' ./server.js
// Minimal unified server without external deps.
// Starts the backend (which uses its own node_modules) and serves the static frontend.
const http = require('http');
const fs = require('fs');
const path = require('path');

// Start backend (it will initialize its own Express server on port 4000)
require('./backend/index.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function proxyApi(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: 4000,
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

# Créer les répertoires de données
RUN mkdir -p /app/data /app/logs && chown -R appuser:nodejs /app/data /app/logs

USER appuser

# Exposer seulement le port du serveur unifié
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3000, path: '/api/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "server.js"]
