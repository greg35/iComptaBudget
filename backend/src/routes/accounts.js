const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb, mapAccountType } = require('../utils/database');

const router = express.Router();

// Get accounts
router.get('/', async (req, res) => {
  try {
    // If main database doesn't exist, return empty array
    if (!fs.existsSync(config.DB_PATH)) {
      console.log('Main database not found, returning empty accounts');
      return res.json([]);
    }
    
    const folder = (req.query.folder || '').toString();
    const filterType = req.query.filterType; // 'savings' or 'checking'
    
    // Get excluded account IDs if we need to filter them
    let excludedAccountIds = [];
    let excludeExcluded = false;
    if (filterType && fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
        const prefsDb = new SQL.Database(filebuffer);
        
        // Select accounts to exclude based on filter type
        let filterQuery;
        if (filterType === 'savings') {
          filterQuery = "SELECT accountId FROM account_preferences WHERE includeSavings = 0";
          excludeExcluded = true;
        } else if (filterType === 'checking') {
          filterQuery = "SELECT accountId FROM account_preferences WHERE includeChecking = 0";
          excludeExcluded = true;
        } else {
          // Unknown filterType: don't exclude any accounts
          filterQuery = "SELECT accountId FROM account_preferences WHERE 1=0"; // Return empty result
        }
        
        const prefsResult = prefsDb.exec(filterQuery);
        if (prefsResult && prefsResult[0]) {
          excludedAccountIds = prefsResult[0].values.map(row => row[0]);
        }
        prefsDb.close();
      } catch (e) {
        console.error('Error loading account preferences for filtering:', e && e.message);
      }
    }
    
    const db = await openDb(config.DB_PATH);
    try {

        // attempt join with ICAccountFolder and compute balance by summing splits for the account
        try {
        // Walk the parent chain (recursively) and match any ancestor with class = 'ICAccountsGroup' and name = 'Disponible'
        let qBal = `
            SELECT a.ID as id, a.name as name, COALESCE(bal.balance,0) as balance, a.type as type
            FROM ICAccount a
            LEFT JOIN (
              SELECT t.account as accId, SUM(CAST(s.amount AS REAL)) as balance 
              FROM ICTransactionSplit s 
              LEFT JOIN ICTransaction t ON s."transaction" = t.ID 
              WHERE (t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus')
              GROUP BY t.account
            ) as bal ON a.ID = bal.accId
            where a.hidden = 0 and a."type" IS NOT NULL
          `;
          
        // Add exclusion filter if we have excluded accounts
        if (excludeExcluded && excludedAccountIds.length > 0) {
          const excludedList = excludedAccountIds.map(id => "'" + String(id).replace(/'/g, "''") + "'").join(',');
          qBal += ` AND a.ID NOT IN (${excludedList})`;
        }
        
        const r = db.exec(qBal);

        if (r && r[0] && r[0].values && r[0].values.length > 0) {
            let out = [];
            const cols = r[0].columns;
            for (const row of r[0].values) {
            const obj = {};
            cols.forEach((c, i) => obj[c] = row[i]);
            out.push({ id: String(obj.id || ''), name: obj.name || '', balance: Number(obj.balance || 0), type: mapAccountType(obj.type) });
            }
            res.json(out);
            return;
        }
        } catch (e) {
          // ignore and fallback to empty
          console.error('accounts: qBal error', String(e && e.message));
        }

        // if we reach here nothing matched or an error occurred; return empty array
        if (!res.headersSent) {
        res.json([]);
        }
    } finally {
        db.close();
    }
  } catch (e) {
    console.error('accounts: qBal error', e && e.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

module.exports = router;
