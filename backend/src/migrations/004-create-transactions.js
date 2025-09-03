const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

// Script pour créer la table des transactions manuelles
async function createTransactionsTable() {
  try {
    console.log('Creating transactions table...');
    
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
      WHERE type='table' AND name='transactions'
    `);
    
    if (tableExists && tableExists[0] && tableExists[0].values.length > 0) {
      console.log('Table transactions already exists');
      db.close();
      return;
    }
    
    // Créer la nouvelle table
    db.exec(`
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        projectId TEXT DEFAULT '',
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        category TEXT NOT NULL,
        comment TEXT DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_transactions_date ON transactions(date);
      CREATE INDEX idx_transactions_project ON transactions(projectId);
      CREATE INDEX idx_transactions_type ON transactions(type);
      CREATE INDEX idx_transactions_category ON transactions(category);
    `);
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    console.log('Table transactions created successfully');
    
  } catch (error) {
    console.error('Error creating transactions table:', error);
    throw error;
  }
}

module.exports = { createTransactionsTable };

// Exécuter si appelé directement
if (require.main === module) {
  createTransactionsTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
