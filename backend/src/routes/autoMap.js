const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

const router = express.Router();

// Get auto-mapping configuration
router.get('/', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json({ enabled: false, rules: [] });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Get enabled status
    let enabled = false;
    try {
      const configResult = db.exec("SELECT value FROM app_config WHERE key = 'auto_mapping_enabled'");
      if (configResult && configResult[0] && configResult[0].values.length > 0) {
        enabled = configResult[0].values[0][0] === '1';
      }
    } catch (e) {
      // Table might not exist yet
    }
    
    // Get mapping rules
    const rules = [];
    try {
      const rulesResult = db.exec("SELECT id, pattern, projectId, projectName FROM auto_mapping_rules ORDER BY id");
      if (rulesResult && rulesResult[0]) {
        const cols = rulesResult[0].columns;
        for (const row of rulesResult[0].values) {
          const rule = {};
          cols.forEach((col, i) => rule[col] = row[i]);
          rules.push({
            id: rule.id,
            pattern: rule.pattern || '',
            projectId: String(rule.projectId),
            projectName: rule.projectName || ''
          });
        }
      }
    } catch (e) {
      // Table might not exist yet
    }
    
    db.close();
    res.json({ enabled, rules });
  } catch (e) {
    console.error('Error loading auto-mapping config:', e && e.message);
    res.status(500).json({ error: 'Failed to load auto-mapping configuration' });
  }
});

// Update auto-mapping configuration
router.post('/', async (req, res) => {
  try {
    const { enabled, rules } = req.body;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Create tables if they don't exist
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT
      )`);
      
      db.exec(`CREATE TABLE IF NOT EXISTS auto_mapping_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        projectId TEXT NOT NULL,
        projectName TEXT
      )`);
    } catch (e) {
      console.error('Error creating tables:', e);
    }
    
    // Update enabled status
    if (enabled !== undefined) {
      const enabledValue = enabled ? '1' : '0';
      const stmt = db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)');
      stmt.run(['auto_mapping_enabled', enabledValue]);
      stmt.free();
    }
    
    // Update rules if provided
    if (Array.isArray(rules)) {
      // Clear existing rules
      db.exec('DELETE FROM auto_mapping_rules');
      
      // Insert new rules
      const stmt = db.prepare('INSERT INTO auto_mapping_rules (pattern, projectId, projectName) VALUES (?, ?, ?)');
      for (const rule of rules) {
        if (rule.pattern && rule.projectId) {
          stmt.run([rule.pattern, String(rule.projectId), rule.projectName || '']);
        }
      }
      stmt.free();
    }
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, enabled, rulesCount: Array.isArray(rules) ? rules.length : undefined });
  } catch (e) {
    console.error('Error saving auto-mapping config:', e && e.message);
    res.status(500).json({ error: 'Failed to save auto-mapping configuration' });
  }
});

// Add auto-mapping rule
router.post('/rules', async (req, res) => {
  try {
    const { pattern, projectId, projectName } = req.body;
    if (!pattern || !projectId) {
      return res.status(400).json({ error: 'pattern and projectId are required' });
    }

    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Create table if it doesn't exist
    db.exec(`CREATE TABLE IF NOT EXISTS auto_mapping_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT
    )`);
    
    const stmt = db.prepare('INSERT INTO auto_mapping_rules (pattern, projectId, projectName) VALUES (?, ?, ?)');
    stmt.run([pattern, String(projectId), projectName || '']);
    stmt.free();
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, pattern, projectId, projectName });
  } catch (e) {
    console.error('Error adding auto-mapping rule:', e && e.message);
    res.status(500).json({ error: 'Failed to add auto-mapping rule' });
  }
});

// Delete auto-mapping rule
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const stmt = db.prepare('DELETE FROM auto_mapping_rules WHERE id = ?');
    stmt.run([parseInt(id)]);
    stmt.free();
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, deleted: id });
  } catch (e) {
    console.error('Error deleting auto-mapping rule:', e && e.message);
    res.status(500).json({ error: 'Failed to delete auto-mapping rule' });
  }
});

module.exports = router;
