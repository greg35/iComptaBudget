const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

// Script pour créer la table des montants d'épargne mensuels manuels
async function createMonthlyManualSavingsTable() {
  try {
    console.log('Creating monthly_manual_savings table...');
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      console.log('Data database does not exist, skipping migration...');
      return;
    }
    
    // Charger la base existante
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Vérifier si la table existe déjà
    const tableExists = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='monthly_manual_savings'
    `);
    
    if (tableExists && tableExists[0] && tableExists[0].values.length > 0) {
      console.log('Table monthly_manual_savings already exists');
      db.close();
      return;
    }
    
    // Créer la nouvelle table
    db.exec(`
      CREATE TABLE monthly_manual_savings (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_monthly_manual_savings_month ON monthly_manual_savings(month);
    `);
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    console.log('Table monthly_manual_savings created successfully');
    
  } catch (error) {
    console.error('Error creating monthly_manual_savings table:', error);
    throw error;
  }
}

module.exports = { createMonthlyManualSavingsTable };

// Exécuter si appelé directement
if (require.main === module) {
  createMonthlyManualSavingsTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
