const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Get category hierarchy
router.get('/categories', async (req, res) => {
  try {
    console.log('Category matrix - categories endpoint called');
    console.log('DB_PATH:', config.DB_PATH);
    console.log('DB exists:', fs.existsSync(config.DB_PATH));

    if (!fs.existsSync(config.DB_PATH)) {
      console.warn('⚠️  Main database not found at', config.DB_PATH);
      console.warn('⚠️  Please configure the iCompta database path');
      console.warn('⚠️  Returning empty categories array');
      // Return empty array to match expected format
      return res.json([]);
    }

    const db = await openDb(config.DB_PATH);

    try {
      // Get all categories with their parent relationships
      const query = `
        SELECT
          ID as id,
          name,
          parent as parentId
        FROM ICCategory
        WHERE name IS NOT NULL
        ORDER BY name
      `;

      const result = db.exec(query);
      const categories = [];

      console.log('Query result:', result ? 'has data' : 'no data');
      if (result && result[0]) {
        console.log('Found', result[0].values.length, 'categories');
        const cols = result[0].columns;
        for (const row of result[0].values) {
          const cat = {};
          cols.forEach((col, i) => cat[col] = row[i]);
          categories.push({
            id: String(cat.id || ''),
            name: cat.name || '',
            parentId: cat.parentId ? String(cat.parentId) : null
          });
        }
      }

      res.json(categories);
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('Error fetching categories:', e && e.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get transactions aggregated by category and month
router.get('/data', async (req, res) => {
  try {
    const startMonth = req.query.startMonth; // Format: YYYY-MM
    const endMonth = req.query.endMonth;     // Format: YYYY-MM

    if (!startMonth || !endMonth) {
      return res.status(400).json({ error: 'startMonth and endMonth parameters are required' });
    }

    if (!fs.existsSync(config.DB_PATH)) {
      console.log('Main database not found, returning empty data');
      return res.json({ months: [], categories: [] });
    }

    // Get accounts that are included in checking (expense) calculations
    let includedAccountIds = [];
    if (fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
        const prefsDb = new SQL.Database(filebuffer);

        const prefsResult = prefsDb.exec(`
          SELECT accountId FROM account_preferences
          WHERE includeChecking = 1
        `);
        if (prefsResult && prefsResult[0]) {
          includedAccountIds = prefsResult[0].values.map(row => row[0]);
        }
        prefsDb.close();
      } catch (e) {
        console.error('Error loading account preferences:', e && e.message);
        return res.status(500).json({ error: 'Failed to load account preferences: ' + e.message });
      }
    }

    if (includedAccountIds.length === 0) {
      console.log('No accounts included in expense calculations');
      return res.json({ months: [], categories: [] });
    }

    const db = await openDb(config.DB_PATH);

    try {
      const accountFilter = includedAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');

      // Get all transactions grouped by category and month
      const query = `
        SELECT
          c.ID as categoryId,
          c.name as categoryName,
          c.parent as parentId,
          strftime('%Y-%m', t.date) as month,
          SUM(CAST(s.amount AS REAL)) as total
        FROM ICTransactionSplit s
        LEFT JOIN ICTransaction t ON s."transaction" = t.ID
        LEFT JOIN ICCategory c ON s.category = c.ID
        WHERE
          t.account IN (${accountFilter})
          AND strftime('%Y-%m', t.date) BETWEEN '${startMonth}' AND '${endMonth}'
          AND c.name IS NOT NULL
          AND lower(c.name) NOT LIKE '%virements internes%'
          AND c.ID NOT IN (
            WITH RECURSIVE category_hierarchy AS (
              SELECT ID, name, parent FROM ICCategory WHERE name = 'Hors budget'
              UNION ALL
              SELECT c.ID, c.name, c.parent
              FROM ICCategory c
              INNER JOIN category_hierarchy ch ON c.parent = ch.ID
            )
            SELECT ID FROM category_hierarchy
          )
        GROUP BY c.ID, c.name, c.parent, month
        ORDER BY month, c.name
      `;

      const result = db.exec(query);
      const data = [];

      if (result && result[0]) {
        const cols = result[0].columns;
        for (const row of result[0].values) {
          const item = {};
          cols.forEach((col, i) => item[col] = row[i]);
          data.push({
            categoryId: String(item.categoryId || ''),
            categoryName: item.categoryName || '',
            parentId: item.parentId ? String(item.parentId) : null,
            month: item.month,
            total: Number(item.total) || 0
          });
        }
      }

      // Generate list of months in range
      const months = [];
      const startDate = new Date(startMonth + '-01');
      const endDate = new Date(endMonth + '-01');

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthKey);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      res.json({ months, data });
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('Error fetching category matrix data:', e && e.message);
    res.status(500).json({ error: 'Failed to fetch category matrix data' });
  }
});

module.exports = router;
