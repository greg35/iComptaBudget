const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get manual savings amount for a specific month
router.get('/:month', async (req, res) => {
  try {
    const { month } = req.params;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json({ amount: 0 });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const query = `
      SELECT amount 
      FROM monthly_manual_savings 
      WHERE month = ?
    `;
    
    const result = db.exec(query, [month]);
    db.close();
    
    if (!result || !result[0] || result[0].values.length === 0) {
      return res.json({ amount: 0 });
    }
    
    res.json({ amount: result[0].values[0][0] });
    
  } catch (error) {
    console.error('Error getting manual savings amount:', error);
    res.status(500).json({ error: 'Failed to get manual savings amount' });
  }
});

// Update manual savings amount for a specific month
router.put('/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const { amount } = req.body;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Check if record exists
    const existsQuery = `
      SELECT id FROM monthly_manual_savings 
      WHERE month = ?
    `;
    const existsResult = db.exec(existsQuery, [month]);
    
    if (existsResult && existsResult[0] && existsResult[0].values.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE monthly_manual_savings 
        SET amount = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE month = ?
      `;
      db.exec(updateQuery, [amount, month]);
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO monthly_manual_savings (id, month, amount, createdAt, updatedAt)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      db.exec(insertQuery, [uuidv4(), month, amount]);
    }
    
    // Create transaction for this manual savings entry
    await createSavingsTransaction(db, month, amount);
    
    // Save database
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ success: true, month, amount });
    
  } catch (error) {
    console.error('Error updating manual savings amount:', error);
    res.status(500).json({ error: 'Failed to update manual savings amount' });
  }
});

// Helper function to create a savings transaction
async function createSavingsTransaction(db, month, amount) {
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
    const description = `VIR Epargne ${monthName} ${year}`;
    
    // Check if transaction already exists to avoid duplicates
    const existingQuery = `
      SELECT id FROM transactions 
      WHERE description = ? AND date = ?
    `;
    const existingResult = db.exec(existingQuery, [description, transactionDate]);
    
    if (existingResult && existingResult[0] && existingResult[0].values.length > 0) {
      // Update existing transaction
      const updateQuery = `
        UPDATE transactions 
        SET amount = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE description = ? AND date = ?
      `;
      db.exec(updateQuery, [amount, description, transactionDate]);
    } else {
      // Create new transaction
      const insertQuery = `
        INSERT INTO transactions (id, projectId, date, description, amount, type, category, createdAt, updatedAt)
        VALUES (?, '', ?, ?, ?, 'income', 'Virements d''épargne', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      db.exec(insertQuery, [uuidv4(), transactionDate, description, amount]);
    }
  } catch (error) {
    console.error('Error creating savings transaction:', error);
    // Don't throw - we don't want to fail the main operation
  }
}

// Get all manual savings amounts
router.get('/', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const query = `
      SELECT month, amount, createdAt, updatedAt
      FROM monthly_manual_savings 
      ORDER BY month DESC
    `;
    
    const result = db.exec(query);
    db.close();
    
    if (!result || !result[0]) {
      return res.json([]);
    }
    
    const savings = result[0].values.map(row => ({
      month: row[0],
      amount: row[1],
      createdAt: row[2],
      updatedAt: row[3]
    }));
    
    res.json(savings);
    
  } catch (error) {
    console.error('Error getting all manual savings amounts:', error);
    res.status(500).json({ error: 'Failed to get manual savings amounts' });
  }
});

module.exports = router;
