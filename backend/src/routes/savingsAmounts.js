const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get savings amounts for a specific month and projects
router.get('/', async (req, res) => {
  try {
    const { month, projectId } = req.query;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    let query = `
      SELECT sa.id, sa.projectId, sa.month, sa.amount, sa.createdAt, sa.updatedAt,
             p.name as projectName
      FROM savings_amounts sa
      LEFT JOIN projects p ON sa.projectId = p.id
    `;
    
    const conditions = [];
    if (month) {
      conditions.push(`sa.month = '${month.replace(/'/g, "''")}'`);
    }
    if (projectId) {
      conditions.push(`sa.projectId = '${projectId.replace(/'/g, "''")}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY sa.month DESC, p.name ASC`;
    
    const result = db.exec(query);
    db.close();
    
    if (!result || !result[0]) {
      return res.json([]);
    }
    
    const savingsAmounts = result[0].values.map(row => ({
      id: row[0],
      projectId: row[1],
      month: row[2],
      amount: Number(row[3]) || 0,
      createdAt: row[4],
      updatedAt: row[5],
      projectName: row[6]
    }));
    
    res.json(savingsAmounts);
    
  } catch (error) {
    console.error('Error fetching savings amounts:', error);
    res.status(500).json({ error: 'Failed to fetch savings amounts: ' + error.message });
  }
});

// Update or create savings amount
router.put('/', async (req, res) => {
  try {
    const { projectId, month, amount } = req.body;
    
    if (!projectId || !month || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields: projectId, month, amount' });
    }
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Data database not found' });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Vérifier si l'entrée existe déjà
    const existingQuery = `
      SELECT id FROM savings_amounts 
      WHERE projectId = '${projectId.replace(/'/g, "''")}' 
      AND month = '${month.replace(/'/g, "''")}'
    `;
    
    const existingResult = db.exec(existingQuery);
    const now = new Date().toISOString();
    
    if (existingResult && existingResult[0] && existingResult[0].values.length > 0) {
      // Mise à jour
      const existingId = existingResult[0].values[0][0];
      db.exec(`
        UPDATE savings_amounts 
        SET amount = ${Number(amount)}, updatedAt = '${now}'
        WHERE id = '${existingId.replace(/'/g, "''")}'
      `);
      console.log(`Updated savings amount for project ${projectId}, month ${month}: ${amount}`);
    } else {
      // Création
      const newId = uuidv4();
      db.exec(`
        INSERT INTO savings_amounts (id, projectId, month, amount, createdAt, updatedAt)
        VALUES (
          '${newId}',
          '${projectId.replace(/'/g, "''")}',
          '${month.replace(/'/g, "''")}',
          ${Number(amount)},
          '${now}',
          '${now}'
        )
      `);
      console.log(`Created new savings amount for project ${projectId}, month ${month}: ${amount}`);
    }
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ success: true, projectId, month, amount });
    
  } catch (error) {
    console.error('Error updating savings amount:', error);
    res.status(500).json({ error: 'Failed to update savings amount: ' + error.message });
  }
});

// Delete savings amount
router.delete('/', async (req, res) => {
  try {
    const { projectId, month } = req.query;
    
    if (!projectId || !month) {
      return res.status(400).json({ error: 'Missing required parameters: projectId, month' });
    }
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Data database not found' });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    db.exec(`
      DELETE FROM savings_amounts 
      WHERE projectId = '${projectId.replace(/'/g, "''")}' 
      AND month = '${month.replace(/'/g, "''")}'
    `);
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ success: true, projectId, month });
    
  } catch (error) {
    console.error('Error deleting savings amount:', error);
    res.status(500).json({ error: 'Failed to delete savings amount: ' + error.message });
  }
});

module.exports = router;
