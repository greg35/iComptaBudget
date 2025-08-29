const express = require('express');
const fs = require('fs');
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
    const projectKey = req.query.project;
    if (!projectKey) return res.status(400).json({ error: 'missing project query param' });
    const db = await openDb();
    try {
    const q = `SELECT s.ID as splitId, s.amount as amount, s.project as project, COALESCE(t.date, t.valueDate, '') as txDate, t.name as txName, c1.name as splitCategoryName, s.comment as splitComment
        FROM ICTransactionSplit s
            LEFT JOIN ICTransaction t ON s."transaction" = t.ID
            LEFT JOIN ICCategory c1 ON s.category = c1.ID
                WHERE s.project = '${String(projectKey).replace(/'/g, "''")}'
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
        res.json(out);
    } finally {
        db.close();
    }
  } catch (e) {
    console.error('Error fetching project transactions:', e && e.message);
    res.status(500).json({ error: 'Failed to fetch project transactions' });
  }
});

module.exports = router;
