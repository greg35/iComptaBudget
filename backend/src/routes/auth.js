const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { openDataDb } = require('../services/projectService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

// Vérifier si un utilisateur existe
router.get('/check-user', async (req, res) => {
  try {
    const db = await openDataDb();
    const result = db.exec('SELECT id FROM users LIMIT 1');
    const hasUser = result && result[0] && result[0].values && result[0].values.length > 0;
    db.close();
    res.json({ hasUser });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification utilisateur' });
  }
});

// Créer le premier utilisateur
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const db = await openDataDb();
    
    // Vérifier qu'aucun utilisateur n'existe déjà
    const existingResult = db.exec('SELECT id FROM users LIMIT 1');
    const hasExistingUser = existingResult && existingResult[0] && existingResult[0].values && existingResult[0].values.length > 0;
    
    if (hasExistingUser) {
      db.close();
      return res.status(400).json({ error: 'Un utilisateur existe déjà' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Créer l'utilisateur
    db.run(
      'INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)',
      [email, hashedPassword, new Date().toISOString()]
    );

    // Récupérer l'ID du nouvel utilisateur
    const userResult = db.exec('SELECT last_insert_rowid() as id');
    const userId = userResult && userResult[0] && userResult[0].values && userResult[0].values[0] && userResult[0].values[0][0];

    // Sauvegarder la base de données
    const binary = db.export();
    const fs = require('fs');
    const config = require('../config');
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();

    // Générer un token JWT
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      success: true, 
      token,
      user: { id: userId, email }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Erreur lors de la création utilisateur' });
  }
});

// Connexion utilisateur
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const db = await openDataDb();
    const userResult = db.exec('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!userResult || !userResult[0] || !userResult[0].values || userResult[0].values.length === 0) {
      db.close();
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const userData = userResult[0];
    const columnNames = userData.columns;
    const userRow = userData.values[0];
    
    // Reconstruire l'objet user
    const user = {};
    columnNames.forEach((col, index) => {
      user[col] = userRow[index];
    });

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      db.close();
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    db.close();

    // Générer un token JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      success: true, 
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Vérifier un token JWT
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const db = await openDataDb();
    const userResult = db.exec('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
    
    if (!userResult || !userResult[0] || !userResult[0].values || userResult[0].values.length === 0) {
      db.close();
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const userData = userResult[0];
    const userRow = userData.values[0];
    const user = { id: userRow[0], email: userRow[1] };

    db.close();

    res.json({ 
      success: true, 
      user
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
