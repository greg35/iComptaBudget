const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Get account preferences
router.get('/', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const result = db.exec("SELECT accountId, accountName, excluded FROM account_preferences ORDER BY accountName");
    const preferences = [];
    
    if (result && result[0]) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const pref = {};
        cols.forEach((col, i) => pref[col] = row[i]);
        preferences.push({
          accountId: String(pref.accountId),
          accountName: pref.accountName || '',
          excluded: Boolean(pref.excluded)
        });
      }
    }
    
    db.close();
    res.json(preferences);
  } catch (e) {
    console.error('Error loading account preferences:', e && e.message);
    res.status(500).json({ error: 'Failed to load account preferences' });
  }
});

// Save account preference
router.post('/', async (req, res) => {
  try {
    const { accountId, accountName, excluded } = req.body;
    if (!accountId || !accountName) {
      return res.status(400).json({ error: 'accountId and accountName are required' });
    }

    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const escapedId = accountId.replace(/'/g, "''");
    const escapedName = accountName.replace(/'/g, "''");
    const excludedValue = excluded ? 1 : 0;
    
    db.exec(`INSERT OR REPLACE INTO account_preferences (accountId, accountName, excluded) VALUES ('${escapedId}', '${escapedName}', ${excludedValue})`);
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, accountId, accountName, excluded: Boolean(excluded) });
  } catch (e) {
    console.error('Error saving account preference:', e && e.message);
    res.status(500).json({ error: 'Failed to save account preference' });
  }
});

// Refresh account list from main database
router.post('/refresh', async (req, res) => {
  try {
    // If main database doesn't exist, return error
    if (!fs.existsSync(config.DB_PATH)) {
      return res.status(400).json({ error: 'Main database not found' });
    }

    const mainDb = await openDb();
    const accounts = [];
    
    try {
      const qBal = `
          SELECT a.ID as id, a.name as name, a.type as type
          FROM ICAccount a
          where a.hidden = 0 and a."type" IS NOT NULL
        `;
      const result = mainDb.exec(qBal);
      
      if (result && result[0]) {
        const cols = result[0].columns;
        for (const row of result[0].values) {
          const account = {};
          cols.forEach((col, i) => account[col] = row[i]);
          accounts.push({
            id: String(account.id),
            name: account.name || ''
          });
        }
      }
    } finally {
      mainDb.close();
    }
    // Debug: log accounts array
    console.log('Accounts from main DB:', accounts);
    
    // Update preferences database
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Insert new accounts with default excluded = 0
    for (const account of accounts) {
      const escapedId = account.id.replace(/'/g, "''");
      const escapedName = account.name.replace(/'/g, "''");
      db.exec(`INSERT OR IGNORE INTO account_preferences (accountId, accountName, excluded) VALUES ('${escapedId}', '${escapedName}', 0)`);
    }
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, refreshed: accounts.length });
  } catch (e) {
    console.error('Error refreshing account preferences:', e && e.message);
    res.status(500).json({ error: 'Failed to refresh account preferences' });
  }
});

// Save all preferences
router.post('/save-all', async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'preferences array is required' });
    }

    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    let saved = 0;
    for (const pref of preferences) {
      if (pref.accountId && pref.accountName) {
        const escapedId = pref.accountId.replace(/'/g, "''");
        const escapedName = pref.accountName.replace(/'/g, "''");
        const excludedValue = pref.excluded ? 1 : 0;
        
        db.exec(`INSERT OR REPLACE INTO account_preferences (accountId, accountName, excluded) VALUES ('${escapedId}', '${escapedName}', ${excludedValue})`);
        saved++;
      }
    }
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, saved });
  } catch (e) {
    console.error('Error saving all preferences:', e && e.message);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
