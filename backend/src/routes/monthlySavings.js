const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

const router = express.Router();

// Get monthly savings
router.get('/', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.json([]);
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const result = db.exec("SELECT id, name, targetAmount, currentAmount, notes FROM monthly_savings ORDER BY name");
    const savings = [];
    
    if (result && result[0]) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const saving = {};
        cols.forEach((col, i) => saving[col] = row[i]);
        savings.push({
          id: saving.id,
          name: saving.name || '',
          targetAmount: parseFloat(saving.targetAmount) || 0,
          currentAmount: parseFloat(saving.currentAmount) || 0,
          notes: saving.notes || ''
        });
      }
    }
    
    db.close();
    res.json(savings);
  } catch (e) {
    console.error('Error loading monthly savings:', e && e.message);
    res.status(500).json({ error: 'Failed to load monthly savings' });
  }
});

// Add new monthly saving
router.post('/', async (req, res) => {
  try {
    const { name, targetAmount, currentAmount, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const escapedName = name.replace(/'/g, "''");
    const escapedNotes = (notes || '').replace(/'/g, "''");
    const target = parseFloat(targetAmount) || 0;
    const current = parseFloat(currentAmount) || 0;
    
    db.exec(`INSERT INTO monthly_savings (name, targetAmount, currentAmount, notes) VALUES ('${escapedName}', ${target}, ${current}, '${escapedNotes}')`);
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, name, targetAmount: target, currentAmount: current, notes });
  } catch (e) {
    console.error('Error adding monthly saving:', e && e.message);
    res.status(500).json({ error: 'Failed to add monthly saving' });
  }
});

// Update monthly saving
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, targetAmount, currentAmount, notes } = req.body;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (targetAmount !== undefined) {
      updates.push('targetAmount = ?');
      values.push(parseFloat(targetAmount) || 0);
    }
    if (currentAmount !== undefined) {
      updates.push('currentAmount = ?');
      values.push(parseFloat(currentAmount) || 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    
    if (updates.length === 0) {
      db.close();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(parseInt(id));
    
    const stmt = db.prepare(`UPDATE monthly_savings SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(values);
    stmt.free();
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, id, ...req.body });
  } catch (e) {
    console.error('Error updating monthly saving:', e && e.message);
    res.status(500).json({ error: 'Failed to update monthly saving' });
  }
});

// Delete monthly saving
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'data DB missing' });
    }

    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const stmt = db.prepare('DELETE FROM monthly_savings WHERE id = ?');
    stmt.run([parseInt(id)]);
    stmt.free();
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ ok: true, deleted: id });
  } catch (e) {
    console.error('Error deleting monthly saving:', e && e.message);
    res.status(500).json({ error: 'Failed to delete monthly saving' });
  }
});

module.exports = router;
