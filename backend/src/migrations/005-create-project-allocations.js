const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

// Script pour créer la table des répartitions d'épargne manuelles
async function createProjectAllocationTable() {
  try {
    console.log('Creating project_allocations table...');
    
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
      WHERE type='table' AND name='project_allocations'
    `);
    
    if (tableExists && tableExists[0] && tableExists[0].values.length > 0) {
      console.log('Table project_allocations already exists');
      db.close();
      return;
    }
    
    // Créer la nouvelle table
    db.exec(`
      CREATE TABLE project_allocations (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        projectId TEXT NOT NULL,
        allocatedAmount REAL NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month, projectId),
        FOREIGN KEY(projectId) REFERENCES projects(id)
      );
      
      CREATE INDEX idx_project_allocations_month ON project_allocations(month);
      CREATE INDEX idx_project_allocations_project ON project_allocations(projectId);
      CREATE INDEX idx_project_allocations_month_project ON project_allocations(month, projectId);
    `);
    
    // Sauvegarder
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    console.log('Table project_allocations created successfully');
    
  } catch (error) {
    console.error('Error creating project_allocations table:', error);
    throw error;
  }
}

module.exports = { createProjectAllocationTable };

// Exécuter si appelé directement
if (require.main === module) {
  createProjectAllocationTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
