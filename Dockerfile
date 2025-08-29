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

# Copier le backend avec ses dépendances
COPY --from=deps --chown=appuser:nodejs /app/backend ./backend

# Créer un serveur unifié qui sert le frontend et l'API
COPY --chown=appuser:nodejs <<'EOF' ./server.js
const express = require('express');
const path = require('path');

// Importer le backend
const backendApp = express();

// Configurer le backend (reprendre la config du backend/index.js)
const config = require('./backend/src/config');
const corsMiddleware = require('./backend/src/middleware/cors');
const { ensureDataDbExists, migrateDataDb } = require('./backend/src/services/projectService');

// Import route modules
const projectsRoutes = require('./backend/src/routes/projects');
const settingsRoutes = require('./backend/src/routes/settings');
const accountsRoutes = require('./backend/src/routes/accounts');
const transactionsRoutes = require('./backend/src/routes/transactions');
const accountPreferencesRoutes = require('./backend/src/routes/accountPreferences');
const monthlySavingsRoutes = require('./backend/src/routes/monthlySavings');
const autoMapRoutes = require('./backend/src/routes/autoMap');
const splitProjectsRoutes = require('./backend/src/routes/splitProjects');

// Configure backend middleware
backendApp.use(corsMiddleware);
backendApp.use(express.json());

// Configure backend routes
backendApp.use('/api/projects', projectsRoutes);
backendApp.use('/api', settingsRoutes);
backendApp.use('/api/accounts', accountsRoutes);
backendApp.use('/api/transactions', transactionsRoutes);
backendApp.use('/api/account-preferences', accountPreferencesRoutes);
backendApp.use('/api/monthly-savings', monthlySavingsRoutes);
backendApp.use('/api/auto-map', autoMapRoutes);
backendApp.use('/api/split-projects', splitProjectsRoutes);

// Health check endpoint
backendApp.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir les fichiers statiques du frontend
backendApp.use(express.static(path.join(__dirname, 'public')));

// Fallback pour le routing côté client (SPA)
backendApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Initialiser la base de données et démarrer le serveur
async function startServer() {
  try {
    console.log('Ensuring data DB exists...');
    await ensureDataDbExists();
    console.log('Migrating data DB...');
    await migrateDataDb();
    console.log('Starting unified server...');
    backendApp.listen(PORT, '0.0.0.0', () => {
      console.log(`Application running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
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
