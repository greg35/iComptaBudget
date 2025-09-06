const jwt = require('jsonwebtoken');
const { openDataDb } = require('../services/projectService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    const token = authHeader.substring(7); // Enlever 'Bearer '
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Vérifier que l'utilisateur existe toujours
      const db = await openDataDb();
      const userResult = db.exec('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
      
      if (!userResult || !userResult[0] || !userResult[0].values || userResult[0].values.length === 0) {
        db.close();
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      const userRow = userResult[0].values[0];
      const user = { id: userRow[0], email: userRow[1] };
      
      db.close();
      
      // Ajouter les infos utilisateur à la requête
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
