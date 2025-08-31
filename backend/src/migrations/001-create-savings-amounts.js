const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

// Script pour créer la table des montants d'épargne mensuels
async function createSavingsAmountsTable() {
  try {
    console.log('Creating savings_amounts table...');
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      console.log('Data database does not exist, creating it...');
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      
      // Créer les tables de base si nécessaire
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          plannedBudget REAL DEFAULT 0,
          archived BOOLEAN DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS account_preferences (
          accountId TEXT PRIMARY KEY,
          includeChecking BOOLEAN DEFAULT 0,
          includeSavings BOOLEAN DEFAULT 0
        );
      `);
      
      const binary = db.export();
      fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
      db.close();
      console.log('Created new data database');
    }
    
    // Charger la base existante
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Vérifier si la table existe déjà
    const tableExists = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='savings_amounts'
    `);
    
    if (tableExists && tableExists[0] && tableExists[0].values.length > 0) {
      console.log('Table savings_amounts already exists');
      db.close();
      return;
    }
    
    // Créer la nouvelle table
    db.exec(`
      CREATE TABLE savings_amounts (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        month TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(projectId, month),
        FOREIGN KEY(projectId) REFERENCES projects(id)
      );
      
      CREATE INDEX idx_savings_amounts_project_month ON savings_amounts(projectId, month);
      CREATE INDEX idx_savings_amounts_month ON savings_amounts(month);
    `);
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    console.log('Table savings_amounts created successfully');
    
  } catch (error) {
    console.error('Error creating savings_amounts table:', error);
    throw error;
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  createSavingsAmountsTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createSavingsAmountsTable };
