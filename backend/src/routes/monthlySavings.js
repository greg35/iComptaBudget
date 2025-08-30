const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Get monthly savings with real calculation from transactions
router.get('/', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    //console.log('Monthly savings calculation requested for', months, 'months');
    
    if (!fs.existsSync(config.DB_PATH)) {
      console.log('Main database not found, returning empty monthly savings');
      return res.json([]);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    ////
    ////////////////////////////////////////////////////////////////////////////////////////
    // Get accounts that are included in checking (expense) calculations
    let includedAccountIds = [];
    if (fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
        const prefsDb = new SQL.Database(filebuffer);
        
        // Get accounts included in checking/expenses
        const prefsResult = prefsDb.exec(`
          SELECT accountId FROM account_preferences 
          WHERE includeChecking = 1
        `);
        if (prefsResult && prefsResult[0]) {
          includedAccountIds = prefsResult[0].values.map(row => row[0]);
        }
        prefsDb.close();
        //console.log('Found', includedAccountIds.length, 'accounts included in checking:', includedAccountIds);
      } catch (e) {
        console.error('Error loading account preferences for monthly savings:', e && e.message);
        return res.status(500).json({ error: 'Failed to load account preferences: ' + e.message });
      }
    }

    // If no specific accounts are included, fall back to empty result
    if (includedAccountIds.length === 0) {
      console.log('No accounts included in expense calculations');
      return res.json([]);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    ////
    ////////////////////////////////////////////////////////////////////////////////////////
    const db = await openDb();
    
    // Load projects from data DB to get the project breakdown
    let projects = [];
    if (fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
        const prefsDb = new SQL.Database(filebuffer);
        
        const projectsResult = prefsDb.exec(`SELECT id, name FROM projects ORDER BY name`);
        if (projectsResult && projectsResult[0]) {
          projects = projectsResult[0].values.map(row => ({
            id: row[0],
            name: row[1],
          }));
        }
        prefsDb.close();
        console.log('Found', projects.length, 'projects for breakdown calculation');
      } catch (e) {
        console.error('Error loading projects for monthly savings breakdown:', e && e.message);
        // Continue without project breakdown
      }
    }
    
    // Detect category ids for savings-related categories (like in projects.js)
    const findCategoryId = (db, name) => {
      try {
        const res = db.exec(`SELECT ID FROM ICCategory WHERE name = '${name.replace(/'/g, "''")}'`);
        return (res && res[0] && res[0].values && res[0].values[0]) ? res[0].values[0][0] : null;
      } catch (e) {
        return null;
      }
    };
    
    const catIdVirements = findCategoryId(db, "Virements d'épargne");
    const catIdEpargne = findCategoryId(db, "Epargne");
    console.log('Savings category IDs:', { catIdVirements, catIdEpargne });
    
    const monthlyData = [];
    
    try {
      // Calculate for each month
      for (let i = months - 1; i >= 0; i--) {
        // Use a more robust way to calculate months by working with year/month directly
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-based (0=January, 11=December)
        
        // Calculate target month/year by going back i months
        let targetMonth = currentMonth - i;
        let targetYear = currentYear;
        
        // Handle year overflow
        while (targetMonth < 0) {
          targetMonth += 12;
          targetYear--;
        }
        
        const monthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
        
        // Create a proper date for the first day of the target month for labeling
        const labelDate = new Date(targetYear, targetMonth, 1);
        const monthLabel = labelDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
        
        console.log(`Processing month: ${monthKey} (${monthLabel})`);
        
        // Get transactions for this month from included accounts
        const accountFilter = includedAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
        
        // Calculate total savings for the month (existing logic)
        const totalQuery = `
        SELECT 
          SUM(CAST(s.amount AS REAL)) as totalAmount
          FROM ICTransactionSplit s
          LEFT JOIN ICTransaction t ON s."transaction" = t.ID
          LEFT JOIN ICAccount a ON t.account = a.ID
          LEFT JOIN ICCategory c ON s.category = c.ID
          WHERE 
            t.account IN (${accountFilter})
            AND strftime('%Y-%m', t.date) = '${monthKey}'
            AND (c.ID IS NULL OR c.ID NOT IN (
              WITH RECURSIVE category_hierarchy AS (
                SELECT ID, name, parent FROM ICCategory WHERE name = 'Hors budget'
                UNION ALL
                SELECT c.ID, c.name, c.parent 
                FROM ICCategory c
                INNER JOIN category_hierarchy ch ON c.parent = ch.ID
              )
              SELECT ID FROM category_hierarchy
            ))
        `;
        
        console.log('Executing total query for', monthKey);
        
        const totalResult = db.exec(totalQuery);
        let totalSavings = 0;
        
        if (totalResult && totalResult[0] && totalResult[0].values && totalResult[0].values[0]) {
          totalSavings = Number(totalResult[0].values[0][0]) || 0;
        }
      
        ////////////////////////////////////////////////////////////////////////////////////////
        ////
        ////////////////////////////////////////////////////////////////////////////////////////
        // Get accounts that are included in checking (expense) calculations
        let includedAccountSavingsIds = [];
        if (fs.existsSync(config.DATA_DB_PATH)) {
          try {
            const SQL = await initSqlJs();
            const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
            const prefsDb = new SQL.Database(filebuffer);
            
            // Get accounts included in checking/expenses
            const prefsResult = prefsDb.exec(`
              SELECT accountId FROM account_preferences 
              WHERE includeSavings = 1
            `);
            if (prefsResult && prefsResult[0]) {
              includedAccountSavingsIds = prefsResult[0].values.map(row => row[0]);
            }
            prefsDb.close();
            console.log('Found', includedAccountSavingsIds.length, 'accounts included in savings:', includedAccountSavingsIds);
          } catch (e) {
            console.error('Error loading account preferences for monthly savings:', e && e.message);
            return res.status(500).json({ error: 'Failed to load account preferences: ' + e.message });
          }
        }

        // If no specific accounts are included, fall back to empty result
        if (includedAccountSavingsIds.length === 0) {
          console.log('No accounts Savings included in savings calculations');
          return res.json([]);
        } 
        
        // Calculate project breakdown
        const projectBreakdown = {};
        const accountFilterSavings = includedAccountSavingsIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');

        console.log(`Projects : ${projects}`);

        for (const project of projects) {
          // Use the project name directly since ICTransactionSplit.project contains the project name as text
          const projectKey = project.name; // Use project name directly
          
          // Calculate savings for this specific project using similar logic as computeCurrentSavingsSql
          let projectQuery;
          const escProject = String(projectKey).replace(/'/g, "''");
          
          if (catIdVirements && catIdEpargne) {
            // Use exact category match if we have the IDs
            const inList = [catIdVirements, catIdEpargne].map(id => "'" + String(id).replace(/'/g, "''") + "'").join(',');
            projectQuery = `
              SELECT SUM(CAST(s.amount AS REAL)) as projectAmount
              FROM ICTransactionSplit s 
              LEFT JOIN ICTransaction t ON s."transaction" = t.ID
              WHERE s.project = '${escProject}' 
                AND s.category IN (${inList})
                AND t.account IN (${accountFilterSavings})
                AND strftime('%Y-%m', t.date) = '${monthKey}'
            `;
          } else {
            // Fallback to name-based heuristic
            projectQuery = `
              SELECT SUM(CAST(s.amount AS REAL)) as projectAmount
              FROM ICTransactionSplit s 
              LEFT JOIN ICTransaction t ON s."transaction" = t.ID
              LEFT JOIN ICCategory c1 ON s.category = c1.ID 
              WHERE s.project = '${escProject}' 
                AND t.account IN (${accountFilterSavings})
                AND strftime('%Y-%m', t.date) = '${monthKey}'
                AND (lower(c1.name) LIKE '%virements d''épargne%' OR lower(c1.name) = 'epargne')
            `;
          }
          console.log(`Query : ${projectQuery}`);

          const projectResult = db.exec(projectQuery);
          if (projectResult && projectResult[0] && projectResult[0].values && projectResult[0].values[0]) {
            const projectAmount = Number(projectResult[0].values[0][0]) || 0;
            if (projectAmount > 0) {
              projectBreakdown[project.name] = projectAmount;
            }
          }
        }
        
        console.log(`Month ${monthKey}: Total=${totalSavings}, Projects breakdown:`, Object.keys(projectBreakdown).length, 'projects');
        
        monthlyData.push({
          month: monthKey,
          label: monthLabel,
          totalSavings,
          projectBreakdown
        });
      }
      
    } finally {
      db.close();
    }
    
    console.log('Returning monthly data:', monthlyData.length, 'months');
    res.json(monthlyData);
  } catch (e) {
    console.error('Error calculating monthly savings:', e && e.message);
    res.status(500).json({ error: 'Failed to calculate monthly savings: ' + e.message });
  }
});

module.exports = router;
