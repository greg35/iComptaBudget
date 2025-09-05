const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Split projects endpoint - separates grouped projects into individual ones
router.post('/', async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Check if main database exists
    if (!fs.existsSync(config.DB_PATH)) {
      return res.status(400).json({ error: 'Main database not found' });
    }

    // Check if data database exists
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Data database missing' });
    }

    const mainDb = await openDb(config.DB_PATH);
    const SQL = await initSqlJs();
    
    try {
      // Get project details from main database
      const projectResult = mainDb.exec(`SELECT ID, Name FROM ICProject WHERE ID = '${projectId.replace(/'/g, "''")}'`);
      if (!projectResult || !projectResult[0] || projectResult[0].values.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectName = projectResult[0].values[0][1];

      // Get all transactions for this project
      const transactionsResult = mainDb.exec(`
        SELECT t.ID, t.Date, t.Amount, t.Description, t.AccountId, a.Name as AccountName
        FROM ICTransaction t
        LEFT JOIN ICAccount a ON t.AccountId = a.ID
        WHERE t.ProjectId = '${projectId.replace(/'/g, "''")}'
        ORDER BY t.Date
      `);

      if (!transactionsResult || !transactionsResult[0]) {
        return res.status(400).json({ error: 'No transactions found for this project' });
      }

      const transactions = [];
      const cols = transactionsResult[0].columns;
      for (const row of transactionsResult[0].values) {
        const transaction = {};
        cols.forEach((col, i) => transaction[col] = row[i]);
        transactions.push(transaction);
      }

      // Group transactions by account
      const accountGroups = {};
      transactions.forEach(transaction => {
        const accountId = transaction.AccountId;
        if (!accountGroups[accountId]) {
          accountGroups[accountId] = {
            accountId,
            accountName: transaction.AccountName,
            transactions: []
          };
        }
        accountGroups[accountId].transactions.push(transaction);
      });

      // Open data database to save split configuration
      const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
      const dataDb = new SQL.Database(filebuffer);

      // Create split_projects table if it doesn't exist
      dataDb.exec(`CREATE TABLE IF NOT EXISTS split_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        originalProjectId TEXT NOT NULL,
        originalProjectName TEXT,
        accountId TEXT NOT NULL,
        accountName TEXT,
        newProjectId TEXT,
        newProjectName TEXT,
        transactionCount INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      const splitResults = [];
      let splitCount = 0;

      // Create separate project entries for each account
      for (const [accountId, group] of Object.entries(accountGroups)) {
        splitCount++;
        const newProjectId = `${projectId}_split_${accountId}`;
        const newProjectName = `${projectName} - ${group.accountName}`;

        // Insert split project record
        const stmt = dataDb.prepare(`
          INSERT INTO split_projects 
          (originalProjectId, originalProjectName, accountId, accountName, newProjectId, newProjectName, transactionCount)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          projectId,
          projectName,
          accountId,
          group.accountName,
          newProjectId,
          newProjectName,
          group.transactions.length
        ]);
        stmt.free();

        splitResults.push({
          accountId,
          accountName: group.accountName,
          newProjectId,
          newProjectName,
          transactionCount: group.transactions.length
        });
      }

      // Save data database
      const binary = dataDb.export();
      fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
      dataDb.close();

      res.json({
        ok: true,
        originalProject: { id: projectId, name: projectName },
        splits: splitResults,
        totalSplits: splitCount
      });

    } finally {
      mainDb.close();
    }

  } catch (e) {
    console.error('Error splitting project:', e && e.message);
    res.status(500).json({ error: 'Failed to split project' });
  }
});

// Get split projects history
router.get('/history', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    try {
      const result = db.exec(`
        SELECT originalProjectId, originalProjectName, 
               GROUP_CONCAT(accountName) as accounts,
               COUNT(*) as splitCount,
               MAX(created_at) as lastSplit
        FROM split_projects 
        GROUP BY originalProjectId, originalProjectName
        ORDER BY lastSplit DESC
      `);
      
      const history = [];
      if (result && result[0]) {
        const cols = result[0].columns;
        for (const row of result[0].values) {
          const record = {};
          cols.forEach((col, i) => record[col] = row[i]);
          history.push({
            projectId: record.originalProjectId,
            projectName: record.originalProjectName,
            accounts: record.accounts ? record.accounts.split(',') : [],
            splitCount: record.splitCount,
            lastSplit: record.lastSplit
          });
        }
      }
      
      db.close();
      res.json(history);
    } catch (e) {
      // Table might not exist
      db.close();
      res.json([]);
    }
  } catch (e) {
    console.error('Error loading split history:', e && e.message);
    res.status(500).json({ error: 'Failed to load split history' });
  }
});

// Get details of a specific split
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    try {
      const result = db.exec(`
        SELECT * FROM split_projects 
        WHERE originalProjectId = '${projectId.replace(/'/g, "''")}'
        ORDER BY accountName
      `);
      
      const splits = [];
      if (result && result[0]) {
        const cols = result[0].columns;
        for (const row of result[0].values) {
          const split = {};
          cols.forEach((col, i) => split[col] = row[i]);
          splits.push(split);
        }
      }
      
      db.close();
      res.json(splits);
    } catch (e) {
      // Table might not exist
      db.close();
      res.json([]);
    }
  } catch (e) {
    console.error('Error loading split details:', e && e.message);
    res.status(500).json({ error: 'Failed to load split details' });
  }
});

module.exports = router;
