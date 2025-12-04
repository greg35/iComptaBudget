const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get allocations for a specific month
router.get('/:month', async (req, res) => {
  try {
    const { month } = req.params;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const query = `
      SELECT pa.id, pa.month, pa.projectId, pa.allocatedAmount, pa.createdAt, pa.updatedAt,
             p.name as projectName
      FROM project_allocations pa
      LEFT JOIN projects p ON pa.projectId = p.id
      WHERE pa.month = ?
      ORDER BY p.name ASC
    `;
    
    const result = db.exec(query, [month]);
    db.close();
    
    if (!result || !result[0]) {
      return res.json([]);
    }
    
    const allocations = result[0].values.map(row => ({
      id: row[0],
      month: row[1],
      projectId: row[2],
      allocatedAmount: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      projectName: row[6]
    }));
    
    res.json(allocations);
    
  } catch (error) {
    console.error('Error getting project allocations:', error);
    res.status(500).json({ error: 'Failed to get project allocations' });
  }
});

// Update allocations for a month
router.put('/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const { allocations, freeSavings } = req.body; // allocations = [{ projectId, amount }]
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    try {
      // Start transaction
      db.exec('BEGIN TRANSACTION');
      
      console.log('Processing allocations for month:', month, 'allocations:', allocations);

      // Insert new allocations and create transactions
      for (const allocation of allocations) {
        if (allocation.amount !== 0) {
          // Insert allocation (permettre les valeurs négatives)
          const allocationId = uuidv4();
          // Check if allocation exists for the same month and projectId
          const existing = db.exec(
            `SELECT id FROM project_allocations WHERE month = ? AND projectId = ?`,
            [month, allocation.projectId]
          );

          if (existing && existing[0] && existing[0].values.length > 0) {
            // Update allocatedAmount and updatedAt
            db.exec(
              `UPDATE project_allocations SET allocatedAmount = ?, updatedAt = CURRENT_TIMESTAMP WHERE month = ? AND projectId = ?`,
              [allocation.amount, month, allocation.projectId]
            );
          } else {
            // Insert new allocation
            db.exec(
              `INSERT INTO project_allocations (id, month, projectId, allocatedAmount, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [allocationId, month, allocation.projectId, allocation.amount]
            );
          }

          // Get project name
          const projectQuery = db.exec('SELECT name FROM projects WHERE id = ?', [allocation.projectId]);
          const projectName = projectQuery && projectQuery[0] && projectQuery[0].values[0] ?
                              projectQuery[0].values[0][0] : 'Projet inconnu';

          // Create transaction for this allocation
          await createAllocationTransaction(db, month, allocation.amount, projectName, allocation.projectId);
        }
        else {
          // Delete allocation if amount is 0
          const deleteQuery = `
            DELETE FROM project_allocations WHERE
            month = ?
            AND projectId = ?`;
          console.log('Executing query:', deleteQuery, 'with params:', [month, allocation.projectId]);
          db.exec(deleteQuery, [month, allocation.projectId]);

          db.exec(
            `DELETE FROM transactions WHERE projectId = ? AND date LIKE ?`,
            [allocation.projectId, `${month}%`]
          );
        }
      }
      
      // Create transaction for free savings if any
      if (freeSavings > 0) {
        await createAllocationTransaction(db, month, freeSavings, 'Épargne libre', '');
      }
      
      db.exec('COMMIT');
      
      // Save database
      const binary = db.export();
      fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
      
      res.json({ success: true, month, allocations, freeSavings });
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.close();
    }
    
  } catch (error) {
    console.error('Error updating project allocations:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to update project allocations' });
  }
});

// Helper function to create allocation transactions
async function createAllocationTransaction(db, month, amount, projectName, projectId) {
  try {
    // Parse month (YYYY-MM) to get year and month
    const [year, monthNum] = month.split('-');
    const monthNames = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    const monthName = monthNames[parseInt(monthNum) - 1];
    
    // Get last day of the month
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const transactionDate = `${year}-${monthNum.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    // Create transaction description
    const transactionDescription = `VIR Epargne ${monthName} ${year}`;
    
    // Create transaction
    const transactionId = uuidv4();
    // Check if a transaction already exists for this projectId and date
    const existingTx = db.exec(
      `SELECT id FROM transactions WHERE projectId = ? AND date = ?`,
      [projectId, transactionDate]
    );

    if (existingTx && existingTx[0] && existingTx[0].values.length > 0) {
      // Update amount and updatedAt
      db.exec(
      `UPDATE transactions SET amount = ?, updatedAt = CURRENT_TIMESTAMP WHERE projectId = ? AND date = ?`,
      [amount, projectId, transactionDate]
      );
    } else {
      const insertQuery = `
      INSERT INTO transactions (id, projectId, date, description, amount, type, category, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'income', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      db.exec(insertQuery, [transactionId, projectId, transactionDate, transactionDescription, amount, "Virements d'épargne"]);
    }    
  } catch (error) {
    console.error('Error creating allocation transaction:', error);
    throw error;
  }
}

module.exports = router;
