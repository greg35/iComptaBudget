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
    const targetMonth = req.query.targetMonth; // Format: YYYY-MM
    const allHistory = req.query.all === 'true';
    const startMonthParam = req.query.startMonth;
    const endMonthParam = req.query.endMonth;
    //console.log('Monthly savings calculation requested for', months, 'months', targetMonth ? `targeting ${targetMonth}` : '');
    
    if (!fs.existsSync(config.DB_PATH)) {
      console.log('Main database not found, returning empty monthly savings');
      return res.json([]);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    ////
    ////////////////////////////////////////////////////////////////////////////////////////
    // Get accounts that are included in checking (expense) calculations
    let includedAccountIds = [];
    let savingsAccountIds = [];
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

        // Get accounts explicitly marked as savings
        const savingsResult = prefsDb.exec(`
          SELECT accountId FROM account_preferences 
          WHERE includeSavings = 1
        `);
        if (savingsResult && savingsResult[0]) {
          savingsAccountIds = savingsResult[0].values.map(row => row[0]);
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
    const db = await openDb(config.DB_PATH);

    const monthKeyFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const parseMonthKey = (monthKey) => {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
      const [y, m] = monthKey.split('-').map(Number);
      return new Date(y, m - 1, 1);
    };

    const today = new Date();
    const todayMonthKey = monthKeyFromDate(today);

    // Fallback to any savings-like accounts if none flagged explicitly
    if (savingsAccountIds.length === 0) {
      try {
        const fallbackQuery = `
          SELECT ID FROM ICAccount
          WHERE hidden = 0 
            AND "type" IS NOT NULL
            AND lower("type") LIKE '%savings%'
        `;
        const fallbackRes = db.exec(fallbackQuery);
        if (fallbackRes && fallbackRes[0]) {
          savingsAccountIds = fallbackRes[0].values.map(row => row[0]);
        }
      } catch (e) {
        console.warn('Could not determine savings accounts fallback:', e && e.message);
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
    
    //TODO : make these configurable in data DB by presenting the categories in the settings et letting user choose
    const catIdVirements = "49441D5E-A4A8-4478-8291-440ECBFBA78F"; // findCategoryId(db, "Virements d'épargne");
    const catIdEpargne = "D9968331-C6F0-4A9E-9A67-74C1D0B59E01"; // findCategoryId(db, "Epargne");
    console.log('Savings category IDs (hardcoded):', { catIdVirements, catIdEpargne });
    
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
        console.log('First few projects:', projects.slice(0, 3).map(p => p.name));
      } catch (e) {
        console.error('Error loading projects for monthly savings breakdown:', e && e.message);
        // Continue without project breakdown
      }
    }
    
    const monthlyData = [];

    async function inferEarliestMonth() {
      let earliest = null;
      const updateEarliest = (value) => {
        if (!value) return;
        const key = String(value).slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) return;
        if (!earliest || key < earliest) {
          earliest = key;
        }
      };

      if (includedAccountIds.length > 0) {
        try {
          const filter = includedAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
          const res = db.exec(`SELECT MIN(date) as minDate FROM ICTransaction WHERE account IN (${filter})`);
          const val = res && res[0] && res[0].values && res[0].values[0] ? res[0].values[0][0] : null;
          updateEarliest(val);
        } catch (e) {
          console.warn('Failed inferring earliest month from ICTransaction:', e && e.message);
        }
      }

      if (savingsAccountIds.length > 0) {
        try {
          const filter = savingsAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
          const res = db.exec(`SELECT MIN(date) as minDate FROM ICTransaction WHERE account IN (${filter})`);
          const val = res && res[0] && res[0].values && res[0].values[0] ? res[0].values[0][0] : null;
          updateEarliest(val);
        } catch (e) {
          console.warn('Failed inferring earliest month from savings accounts:', e && e.message);
        }
      }

      if (fs.existsSync(config.DATA_DB_PATH)) {
        try {
          const SQL = await initSqlJs();
          const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
          const dataDb = new SQL.Database(filebuffer);

          const allocationsRes = dataDb.exec(`SELECT MIN(month) FROM project_allocations WHERE allocatedAmount > 0`);
          const allocationsMin = allocationsRes && allocationsRes[0] && allocationsRes[0].values && allocationsRes[0].values[0] ? allocationsRes[0].values[0][0] : null;
          updateEarliest(allocationsMin);

          const manualSavingsRes = dataDb.exec(`SELECT MIN(date) FROM transactions WHERE type='income'`);
          const manualMin = manualSavingsRes && manualSavingsRes[0] && manualSavingsRes[0].values && manualSavingsRes[0].values[0] ? manualSavingsRes[0].values[0][0] : null;
          updateEarliest(manualMin);

          dataDb.close();
        } catch (e) {
          console.warn('Failed inferring earliest month from data DB:', e && e.message);
        }
      }

      return earliest || todayMonthKey;
    }
    
    try {
      // Si un mois spécifique est demandé, calculer seulement celui-ci
      if (targetMonth) {
        const [year, month] = targetMonth.split('-').map(Number);
        const monthKey = targetMonth;
        const labelDate = new Date(year, month - 1, 1);
        const monthLabel = labelDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
        
        console.log(`Processing specific month: ${monthKey} (${monthLabel})`);
        
        const monthData = await calculateMonthData(db, monthKey, monthLabel, includedAccountIds, projects, catIdVirements, catIdEpargne, savingsAccountIds);
        if (monthData) {
          monthlyData.push(monthData);
        }
      } else if (allHistory || startMonthParam) {
        let startKey = startMonthParam;
        if (allHistory || !startKey) {
          const inferred = await inferEarliestMonth();
          if (!startKey || (inferred && inferred < startKey)) {
            startKey = inferred;
          }
        }

        if (!startKey || !/^\d{4}-\d{2}$/.test(startKey)) {
          return res.status(400).json({ error: 'Invalid or missing start month for history mode' });
        }

        const endKey = endMonthParam && /^\d{4}-\d{2}$/.test(endMonthParam) ? endMonthParam : todayMonthKey;
        const startDate = parseMonthKey(startKey);
        const endDate = parseMonthKey(endKey);
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Invalid month format' });
        }
        if (startDate.getTime() > endDate.getTime()) {
          console.warn('Start month is after end month, returning empty history');
        } else {
          let iter = new Date(startDate.getTime());
          while (iter.getTime() <= endDate.getTime()) {
            const monthKey = monthKeyFromDate(iter);
            const monthLabel = iter.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
            console.log(`Processing month: ${monthKey} (${monthLabel}) [history]`);
            const monthData = await calculateMonthData(db, monthKey, monthLabel, includedAccountIds, projects, catIdVirements, catIdEpargne, savingsAccountIds);
            if (monthData) {
              monthlyData.push(monthData);
            }
            iter = new Date(iter.getFullYear(), iter.getMonth() + 1, 1);
          }
        }
      } else {
        // Calculer pour plusieurs mois (comportement original)
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
          
          const monthData = await calculateMonthData(db, monthKey, monthLabel, includedAccountIds, projects, catIdVirements, catIdEpargne, savingsAccountIds);
          if (monthData) {
            monthlyData.push(monthData);
          }
        }
      }
    } catch (e) {
      console.error('Error in monthly savings calculation:', e && e.message);
      return res.status(500).json({ error: 'Failed to calculate monthly savings: ' + e.message });
    } finally {
      if (db) db.close();
    }

    // Trier par ordre chronologique (plus ancien en premier)
    monthlyData.sort((a, b) => {
      const [yearA, monthA] = a.month.split('-').map(Number);
      const [yearB, monthB] = b.month.split('-').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
    
    res.json(monthlyData); // Chronological order (oldest first)
  } catch (error) {
    console.error('Monthly savings error:', error && error.message);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Fonction helper pour calculer les données d'un mois
async function calculateMonthData(db, monthKey, monthLabel, includedAccountIds, projects, catIdVirements, catIdEpargne, savingsAccountIds) {
  try {
        // Get transactions for this month from included accounts
        const accountFilter = includedAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
        const savingsFilter = (savingsAccountIds || []).map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
        const [year, month] = monthKey.split('-').map(Number);
        const monthEnd = new Date(year, month, 0);
        const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
        
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

        // Calculate cumulative balance of savings accounts up to end of month
        let savingsAccountsBalance = 0;
        if (savingsFilter) {
          const savingsBalanceQuery = `
            SELECT SUM(CAST(s.amount AS REAL)) as balance
            FROM ICTransactionSplit s
            LEFT JOIN ICTransaction t ON s."transaction" = t.ID
            WHERE t.account IN (${savingsFilter})
              AND date(t.date) <= date('${monthEndStr}')
          `;
          try {
            const savingsResult = db.exec(savingsBalanceQuery);
            if (savingsResult && savingsResult[0] && savingsResult[0].values && savingsResult[0].values[0]) {
              savingsAccountsBalance = Number(savingsResult[0].values[0][0]) || 0;
            }
          } catch (e) {
            console.error(`Error calculating savings balance for month ${monthKey}:`, e && e.message);
          }
        }

        // Calculate total spent (expenses) for the month: negative amounts excluding provisions and savings categories
        let totalMonthlyProjectSpent = 0;
        try {
          const excludeSavingsFilter = (catIdVirements || catIdEpargne)
            ? `AND (c.ID IS NULL OR c.ID NOT IN ('${String(catIdVirements || '').replace(/'/g, "''")}', '${String(catIdEpargne || '').replace(/'/g, "''")}'))`
            : `AND (c.name IS NULL OR (lower(c.name) NOT LIKE '%virements%' AND lower(c.name) NOT LIKE '%epargne%'))`;
          const spentQuery = `
            SELECT SUM(CAST(-s.amount AS REAL)) as spent
            FROM ICTransactionSplit s
            LEFT JOIN ICTransaction t ON s."transaction" = t.ID
            LEFT JOIN ICAccount a ON t.account = a.ID
            LEFT JOIN ICCategory c ON s.category = c.ID
            WHERE 
              t.account IN (${accountFilter})
              AND strftime('%Y-%m', t.date) = '${monthKey}'
              AND (c.name IS NULL OR lower(c.name) NOT LIKE '%provision%')
              and s.project IS NOT NULL
              ${excludeSavingsFilter}
          `;
          console.log('Executing spent query for', monthKey);
          const totalMonthlyProjectSpentResult = db.exec(spentQuery);
          if (totalMonthlyProjectSpentResult && totalMonthlyProjectSpentResult[0] && totalMonthlyProjectSpentResult[0].values && totalMonthlyProjectSpentResult[0].values[0]) {
            totalMonthlyProjectSpent = Number(totalMonthlyProjectSpentResult[0].values[0][0]) || 0;
          }
        } catch (e) {
          console.error(`Error calculating total spent for month ${monthKey}:`, e && e.message);
        }
      
        // Calculate project breakdown from both iCompta transactions and manual allocations
        const projectBreakdown = {};
        
        // Create a mapping from project names to IDs
        const projectNameToId = {};
        projects.forEach(project => {
          projectNameToId[project.name] = project.id;
        });
        
        // First, get manual allocations for this month
        if (fs.existsSync(config.DATA_DB_PATH)) {
          try {
            const SQL = await initSqlJs();
            const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
            const budgetDb = new SQL.Database(filebuffer);
            
            const allocationsQuery = `
              SELECT projectId, allocatedAmount
              FROM project_allocations
              WHERE month = ?
                AND allocatedAmount > 0
            `;
            
            const allocationsResult = budgetDb.exec(allocationsQuery, [monthKey]);
            
            // Process results from sql.js
            if (allocationsResult && allocationsResult[0] && allocationsResult[0].values) {
              for (const row of allocationsResult[0].values) {
                const projectId = row[0];
                const amount = Number(row[1]) || 0;
                if (amount > 0) {
                  projectBreakdown[projectId] = (projectBreakdown[projectId] || 0) + amount;
                }
              }
            }
            
            budgetDb.close();
            
            console.log(`Month ${monthKey}: Found manual allocations for ${Object.keys(projectBreakdown).length} projects`);
          } catch (e) {
            console.error(`Error fetching manual allocations for month ${monthKey}:`, e && e.message);
          }
        }
        
        // Then, get iCompta transactions for this month (to avoid double counting, only if no manual allocations exist)
        if (projects.length > 0) {
          let allProjectsQuery;
          if (catIdVirements || catIdEpargne) {
            // Use specific category IDs if available
            const categoryIds = [catIdVirements, catIdEpargne].filter(Boolean);
            const inList = categoryIds.map(id => "'" + String(id).replace(/'/g, "''") + "'").join(',');
            allProjectsQuery = `
              SELECT s.project, SUM(CAST(s.amount AS REAL)) as savings
              FROM ICTransactionSplit s
              LEFT JOIN ICTransaction t ON s."transaction" = t.ID
              WHERE s.project IS NOT NULL 
                AND s.project != ''
                AND s.category IN (${inList})
                AND strftime('%Y-%m', t.date) = '${monthKey}'
              GROUP BY s.project
              HAVING savings > 0
            `;
          } else {
            // Fallback to name-based heuristic
            allProjectsQuery = `
              SELECT s.project, SUM(CAST(s.amount AS REAL)) as savings
              FROM ICTransactionSplit s
              LEFT JOIN ICTransaction t ON s."transaction" = t.ID
              LEFT JOIN ICCategory c ON s.category = c.ID
              WHERE s.project IS NOT NULL 
                AND s.project != ''
                AND (lower(c.name) LIKE '%virements d''épargne%' OR lower(c.name) = 'epargne')
                AND strftime('%Y-%m', t.date) = '${monthKey}'
              GROUP BY s.project
              HAVING savings > 0
            `;
          }
          
          try {
            const allProjectsResult = db.exec(allProjectsQuery);
            if (allProjectsResult && allProjectsResult[0] && allProjectsResult[0].values) {
              for (const row of allProjectsResult[0].values) {
                const projectName = row[0];
                const projectSavings = Number(row[1]) || 0;
                if (projectSavings > 0) {
                  // Use project ID as key instead of project name
                  const projectId = projectNameToId[projectName];
                  if (projectId) {
                    // Only add iCompta data if no manual allocation exists for this project
                    if (!projectBreakdown[projectId]) {
                      projectBreakdown[projectId] = projectSavings;
                    }
                  } else {
                    // Fallback to name if ID not found (for backward compatibility)
                    if (!projectBreakdown[projectName]) {
                      projectBreakdown[projectName] = projectSavings;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error calculating project savings for month ${monthKey}:`, e && e.message);
          }
        }

        console.log(`Month ${monthKey}: Total Savings=${totalSavings}, Total Project Spent=${totalMonthlyProjectSpent}`);

        return {
          month: monthKey,
          label: monthLabel,
          totalSavings,
          projectBreakdown,
          totalMonthlyProjectSpent,
          savingsAccountsBalance
        };
  } catch (e) {
    console.error(`Error calculating data for month ${monthKey}:`, e && e.message);
    return null;
  }
}

module.exports = router;
