const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Get project transactions
router.get('/', async (req, res) => {
  try {
    // If main database doesn't exist, return empty array
    if (!fs.existsSync(config.DB_PATH)) {
      console.log('Main database not found, returning empty transactions');
      return res.json([]);
    }

    console.log(req.query);

    const projectId = req.query.project;
    if (!projectId) return res.status(400).json({ error: 'missing project query param' });

    // Get project info to find the dbProject name
    let projectDbName = projectId; // Default fallback
    if (fs.existsSync(config.DATA_DB_PATH)) {
      const SQL = await initSqlJs();
      const dataBuffer = fs.readFileSync(config.DATA_DB_PATH);
      const dataDb = new SQL.Database(dataBuffer);

      try {
        const projectQuery = dataDb.exec('SELECT name FROM projects WHERE id = ?', [projectId]);
        if (projectQuery && projectQuery[0] && projectQuery[0].values[0]) {
          projectDbName = projectQuery[0].values[0][0]; // Use name as dbProject
        }
      } catch (projectError) {
        console.warn('Could not find project info, using ID as fallback:', projectError.message);
      } finally {
        dataDb.close();
      }
    }

    const db = await openDb(config.DB_PATH);
    try {
      const q = `SELECT s.ID as splitId, s.amount as amount, s.project as project, COALESCE(t.date, t.valueDate, '') as txDate, t.name as txName, c1.name as splitCategoryName, s.comment as splitComment
        FROM ICTransactionSplit s
            LEFT JOIN ICTransaction t ON s."transaction" = t.ID
            LEFT JOIN ICCategory c1 ON s.category = c1.ID
                WHERE s.project = '${String(projectDbName).replace(/'/g, "''")}'
                    AND (c1.name IS NULL OR (lower(c1.name) NOT LIKE '%provision%' AND lower(c1.name) NOT LIKE '%virements internes%' AND lower(c1.name) NOT LIKE '%virements internes%'))
                ORDER BY t.date DESC LIMIT 1000`;
      const resq = db.exec(q);
      const out = [];
      if (resq && resq[0]) {
        const cols = resq[0].columns;
        for (const row of resq[0].values) {
          const obj = {};
          cols.forEach((c, i) => obj[c] = row[i]);
          // normalize a few fields for the frontend
          out.push({
            id: String(obj.splitId || ''),
            amount: obj.amount == null ? 0 : Number(obj.amount),
            date: obj.txDate || null,
            description: obj.txName || '',
            comment: obj.splitComment || '',
            category: obj.splitCategoryName || null,
            type: (Number(obj.amount) >= 0) ? 'income' : 'expense'
          });
        }
      }

      // Add manual transactions from our local database
      if (fs.existsSync(config.DATA_DB_PATH)) {
        const SQL = await initSqlJs();
        const localBuffer = fs.readFileSync(config.DATA_DB_PATH);
        const localDb = new SQL.Database(localBuffer);

        try {
          const localQuery = `
              SELECT id, date, description, amount, type, category, comment
              FROM transactions 
              WHERE projectId = ? OR projectId = ''
              ORDER BY date DESC
            `;
          const localResult = localDb.exec(localQuery, [projectId]);

          if (localResult && localResult[0]) {
            const localCols = localResult[0].columns;
            for (const row of localResult[0].values) {
              const obj = {};
              localCols.forEach((c, i) => obj[c] = row[i]);

              out.push({
                id: String(obj.id || ''),
                amount: obj.amount == null ? 0 : Number(obj.amount),
                date: obj.date || null,
                description: obj.description || '',
                comment: obj.comment || '',
                category: obj.category || null,
                type: obj.type || 'expense',
                isManual: true // Flag to identify manual transactions
              });
            }
          }
        } finally {
          localDb.close();
        }
      }

      // Sort all transactions by date (descending)
      out.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateB - dateA;
      });

      res.json(out);
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('Error fetching project transactions:', e && e.message);
    res.status(500).json({ error: 'Failed to fetch project transactions' });
  }
});

// Search transactions (global)
router.get('/search', async (req, res) => {
  try {
    // If main database doesn't exist, return empty array
    if (!fs.existsSync(config.DB_PATH)) {
      return res.json([]);
    }

    const accountId = req.query.account;
    const searchQuery = req.query.q ? req.query.q.toLowerCase() : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;

    const db = await openDb(config.DB_PATH);
    try {
      // Step 1: Find matching Transaction IDs
      let idQuery = `
        SELECT DISTINCT t.ID
        FROM ICTransaction t
        LEFT JOIN ICTransactionSplit s ON s."transaction" = t.ID
        LEFT JOIN ICCategory c1 ON s.category = c1.ID
        WHERE 1=1
      `;

      if (accountId) {
        idQuery += ` AND t.account = '${String(accountId).replace(/'/g, "''")}'`;
      }

      if (searchQuery) {
        idQuery += ` AND (lower(t.name) LIKE '%${String(searchQuery).replace(/'/g, "''")}%' OR lower(s.comment) LIKE '%${String(searchQuery).replace(/'/g, "''")}%' OR lower(c1.name) LIKE '%${String(searchQuery).replace(/'/g, "''")}%')`;
      }

      // Exclude provisions from the ID search to avoid matching them
      idQuery += ` AND (c1.name IS NULL OR lower(c1.name) NOT LIKE '%provision%')`;

      idQuery += ` ORDER BY t.date DESC LIMIT ${limit}`;

      const idRes = db.exec(idQuery);
      const transactionIds = [];
      if (idRes && idRes[0]) {
        idRes[0].values.forEach(row => transactionIds.push(row[0]));
      }

      const out = [];

      // Step 2: Fetch all details for these IDs
      if (transactionIds.length > 0) {
        const idsString = transactionIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
        const detailsQuery = `
          SELECT s.ID as splitId, s.amount as amount, s.project as project, 
                 COALESCE(t.date, t.valueDate, '') as txDate, t.name as txName, 
                 c1.name as splitCategoryName, s.comment as splitComment,
                 t.account as accountId, t.ID as transactionId
          FROM ICTransactionSplit s
          LEFT JOIN ICTransaction t ON s."transaction" = t.ID
          LEFT JOIN ICCategory c1 ON s.category = c1.ID
          WHERE t.ID IN (${idsString})
          ORDER BY t.date DESC
        `;

        const resq = db.exec(detailsQuery);

        if (resq && resq[0]) {
          const cols = resq[0].columns;
          const rows = resq[0].values;

          const txMap = new Map();

          rows.forEach(row => {
            const obj = {};
            cols.forEach((c, i) => obj[c] = row[i]);

            const txId = obj.transactionId;
            if (!txMap.has(txId)) {
              txMap.set(txId, {
                id: txId,
                date: obj.txDate || null,
                description: obj.txName || '',
                accountId: obj.accountId,
                splits: [],
                amount: 0 // Will be calculated
              });
            }

            const tx = txMap.get(txId);
            const amount = obj.amount == null ? 0 : Number(obj.amount);

            tx.splits.push({
              id: String(obj.splitId || ''),
              amount: amount,
              category: obj.splitCategoryName || null,
              comment: obj.splitComment || '',
              project: obj.project
            });

            tx.amount += amount;
          });

          // Convert map to array
          txMap.forEach(tx => {
            tx.type = tx.amount >= 0 ? 'income' : 'expense';
            out.push(tx);
          });
        }
      }

      // Add manual transactions from local DB
      if (!accountId && fs.existsSync(config.DATA_DB_PATH)) {
        const SQL = await initSqlJs();
        const localBuffer = fs.readFileSync(config.DATA_DB_PATH);
        const localDb = new SQL.Database(localBuffer);

        try {
          let localQuery = `
            SELECT id, date, description, amount, type, category, comment, projectId
            FROM transactions 
            WHERE 1=1
          `;

          if (searchQuery) {
            localQuery += ` AND (lower(description) LIKE '%${String(searchQuery).replace(/'/g, "''")}%' OR lower(comment) LIKE '%${String(searchQuery).replace(/'/g, "''")}%' OR lower(category) LIKE '%${String(searchQuery).replace(/'/g, "''")}%')`;
          }

          localQuery += ` ORDER BY date DESC LIMIT ${limit}`;

          const localResult = localDb.exec(localQuery);

          if (localResult && localResult[0]) {
            const localCols = localResult[0].columns;
            for (const row of localResult[0].values) {
              const obj = {};
              localCols.forEach((c, i) => obj[c] = row[i]);

              const amount = obj.amount == null ? 0 : Number(obj.amount);

              out.push({
                id: String(obj.id || ''),
                amount: amount,
                date: obj.date || null,
                description: obj.description || '',
                type: obj.type || 'expense',
                accountId: null,
                isManual: true,
                splits: [{
                  id: String(obj.id || '') + '_split',
                  amount: amount,
                  category: obj.category || null,
                  comment: obj.comment || '',
                  project: obj.projectId || ''
                }]
              });
            }
          }
        } finally {
          localDb.close();
        }
      }

      // Re-sort combined list
      out.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateB - dateA;
      });

      // Apply limit again after merge (though we limited IDs earlier, manual txs might add more)
      const finalOut = out.slice(0, limit);

      res.json(finalOut);
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('Error searching transactions:', e && e.message);
    res.status(500).json({ error: 'Failed to search transactions' });
  }
});

// Get all transactions (including manual savings transactions)
router.get('/all', async (req, res) => {
  try {
    const out = [];

    // Get manual transactions from our local database
    if (fs.existsSync(config.DATA_DB_PATH)) {
      const SQL = await initSqlJs();
      const localBuffer = fs.readFileSync(config.DATA_DB_PATH);
      const localDb = new SQL.Database(localBuffer);

      try {
        const localQuery = `
          SELECT id, date, description, amount, type, category, comment, projectId
          FROM transactions 
          ORDER BY date DESC
        `;
        const localResult = localDb.exec(localQuery);

        if (localResult && localResult[0]) {
          const localCols = localResult[0].columns;
          for (const row of localResult[0].values) {
            const obj = {};
            localCols.forEach((c, i) => obj[c] = row[i]);

            out.push({
              id: String(obj.id || ''),
              amount: obj.amount == null ? 0 : Number(obj.amount),
              date: obj.date || null,
              description: obj.description || '',
              comment: obj.comment || '',
              category: obj.category || null,
              type: obj.type || 'expense',
              projectId: obj.projectId || '',
              isManual: true // Flag to identify manual transactions
            });
          }
        }
      } finally {
        localDb.close();
      }
    }

    // Sort all transactions by date (descending)
    out.sort((a, b) => {
      const dateA = new Date(a.date || '1970-01-01');
      const dateB = new Date(b.date || '1970-01-01');
      return dateB - dateA;
    });

    res.json(out);
  } catch (e) {
    console.error('Error fetching all transactions:', e && e.message);
    res.status(500).json({ error: 'Failed to fetch all transactions' });
  }
});

module.exports = router;
