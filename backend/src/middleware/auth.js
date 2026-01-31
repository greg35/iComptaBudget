const jwt = require('jsonwebtoken');
const fs = require('fs');
const { openDataDb } = require('../services/projectService');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function isFirstStartup() {
  try {
    // If DB file doesn't exist, it's definitely first startup
    if (!fs.existsSync(config.DATA_DB_PATH)) return true;

    // If DB exists, check content (users count)
    // The previous check was too aggressive (only file existence), blocking restore
    // setup when an empty DB was auto-created.
    try {
      const db = await openDataDb();
      
      let userCount = 0;
      try {
        const result = db.exec("SELECT COUNT(*) FROM users");
        if (result && result[0] && result[0].values) {
          userCount = result[0].values[0][0];
        }
      } catch (e) {
        // Table might not exist yet, treat as 0 users
      }

      let hasDropbox = false;
      try {
        const result = db.exec("SELECT value FROM settings WHERE key = 'dropbox_url'");
        if (result && result[0] && result[0].values && result[0].values.length > 0) {
          hasDropbox = !!result[0].values[0][0];
        }
      } catch (e) {
        // Table might not exist
      }

      db.close();

      // Consider it first startup (allowing public access to setup endpoints)
      // if NO users AND NO dropbox configured.
      if (userCount === 0 && !hasDropbox) {
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Error opening DB for first-startup check:', e);
      // If DB is unreadable/corrupted, return true to allow restore/setup to fix it
      return true;
    }
  } catch (error) {
    console.error('Unexpected error in isFirstStartup:', error);
    return false; // Default to secure
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
