const express = require('express');
const fs = require('fs');
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
    const db = await openDb();
    try {
        // Try to query ICAccount table. Columns differ across versions; attempt a few heuristics
        // 1) If ICAccountFolder exists, join and match folder.name
        // 2) Otherwise match account.name LIKE '%folder%'
        // detect if ICAccount has a 'hidden' column so we can exclude archived accounts
        let hasHidden = false;
        let hasClassCol = false;
        let hasTypeCol = false;

        try {
        const pi = db.exec("PRAGMA table_info('ICAccount')");
        if (pi && pi[0] && pi[0].values) {
            const cols = pi[0].values.map(r => r[1]);
            if (cols && cols.includes('hidden')) hasHidden = true;
            if (cols && cols.includes('class')) hasClassCol = true;
            if (cols && cols.includes('type')) hasTypeCol = true;
        }
        } catch (e) {
        // ignore
        }
        const hiddenClause = hasHidden ? " AND (a.hidden IS NULL OR a.hidden = 0) " : " ";
        const classClause = hasClassCol ? " AND lower(a.class) = 'icaccount' " : " ";
        const savingClause = hasTypeCol ? " AND a.type = 'ICAccountType.SavingsAccount' " : " ";

        // attempt join with ICAccountFolder and compute balance by summing splits for the account
        try {
        // Walk the parent chain (recursively) and match any ancestor with class = 'ICAccountsGroup' and name = 'Disponible'
        const qBal = `WITH RECURSIVE parent_chain(acc_id, parent_id, pname, pclass) AS (
            SELECT a.ID as acc_id, a.parent as parent_id, NULL as pname, NULL as pclass FROM ICAccount a
            UNION ALL
            SELECT pc.acc_id, p.parent as parent_id, p.name as pname, p.class as pclass FROM ICAccount p JOIN parent_chain pc ON p.ID = pc.parent_id
            )
            SELECT a.ID as id, a.name as name, COALESCE(bal.balance,0) as balance, a.type as type
            FROM ICAccount a
            LEFT JOIN (SELECT t.account as accId, SUM(CAST(s.amount AS REAL)) as balance FROM ICTransactionSplit s LEFT JOIN ICTransaction t ON s."transaction" = t.ID GROUP BY t.account) as bal ON a.ID = bal.accId
            WHERE EXISTS (
            SELECT 1 FROM parent_chain pc WHERE pc.acc_id = a.ID AND lower(pc.pclass) = 'icaccountsgroup' AND lower(pc.pname) = 'disponible'
            ) ${hiddenClause} ${classClause} ${savingClause}`;
        const r = db.exec(qBal);
        console.debug && console.debug('accounts: qBal executed', { rows: (r && r[0] && r[0].values && r[0].values.length) || 0, hasHidden, hasClassCol });
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
