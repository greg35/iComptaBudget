const jwt = require('jsonwebtoken');
const fs = require('fs');
const { openDataDb } = require('../services/projectService');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function isFirstStartup() {
  // Mirror logic of /api/first-startup: if data DB is valid OR main DB exists => not first-startup
  try {
    if (fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const stat = fs.statSync(config.DATA_DB_PATH);
        if (stat.isFile() && stat.size >= 100) {
          const fd = fs.openSync(config.DATA_DB_PATH, 'r');
          const buf = Buffer.alloc(16);
          fs.readSync(fd, buf, 0, 16, 0);
          fs.closeSync(fd);
          if (buf.toString('utf8') === 'SQLite format 3\0') return false;
        }
      } catch {}
    }
    if (fs.existsSync(config.DB_PATH)) return false;
    return true;
  } catch {
    // On error, default to not first-startup to avoid unintentionally opening public endpoints
    return false;
  }
}

const PUBLIC_ALWAYS = new Set(['/health', '/first-startup']);
const PUBLIC_FIRST_STARTUP = new Set(['/settings', '/update-accounts', '/settings/import-backup', '/settings/restore']);

const authMiddleware = async (req, res, next) => {
  // Express mounts this middleware at '/api', so req.path is the subpath, e.g. '/projects'
  const path = req.path || '';

  // Public endpoints that never require auth
  if (PUBLIC_ALWAYS.has(path)) return next();

  // Allow bootstrap endpoints during first startup (no users / no main DB)
  if (PUBLIC_FIRST_STARTUP.has(path) && await isFirstStartup()) return next();

  // Dev mode: bypass auth everywhere
  if (process.env.DEV_MODE === 'true') {
    req.user = { id: 1, email: 'dev@test.com' };
    console.log('🔓 Mode développement activé - authentification ignorée');
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Option de test: autoriser ?token=... / ?access_token=... si ALLOW_QUERY_TOKEN=true
    if (!token && process.env.ALLOW_QUERY_TOKEN === 'true') {
      token = (req.query && (req.query.token || req.query.access_token)) || undefined;
    }

    if (!token) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const db = await openDataDb();
      const userResult = db.exec('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
      if (!userResult || !userResult[0] || !userResult[0].values || userResult[0].values.length === 0) {
        db.close();
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }
      const userRow = userResult[0].values[0];
      const user = { id: userRow[0], email: userRow[1] };
      db.close();
      req.user = user;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Token invalide' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = authMiddleware;
