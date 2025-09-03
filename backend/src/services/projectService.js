const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

async function syncProjectsFromMainDb() {
  if (!fs.existsSync(config.DB_PATH)) {
    console.log('Main database file does not exist, skipping project sync');
    return 0;
  }

  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
  const outDb = new SQL.Database(filebuffer);

  let srcCount = 0;
  try {
    const srcBuf = fs.readFileSync(config.DB_PATH);
    const srcDb = new SQL.Database(srcBuf);
    const res = srcDb.exec("SELECT DISTINCT project FROM ICTransactionSplit WHERE project IS NOT NULL AND project <> ''");
    const projects = [];
    if (res && res[0]) {
      for (const row of res[0].values) projects.push(row[0]);
    }
    srcDb.close();

    const seen = new Set();
    for (let p of projects) {
      if (!p) continue;
      p = p.toString().trim();
      if (!p) continue;
      if (seen.has(p)) continue;
      seen.add(p);
      const esc = p.replace(/'/g, "''");
      outDb.run(`INSERT OR IGNORE INTO projects (name, startDate, endDate, plannedBudget, archived) VALUES ('${esc}', NULL, NULL, NULL, 0);`);
    }
    srcCount = seen.size;

    const binary = outDb.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    console.log('Synchronized projects from main DB:', srcCount, 'projects found');
  } catch (e) {
    console.error('Error synchronizing projects from main DB:', e && e.message);
  } finally {
    outDb.close();
  }

  return srcCount;
}

async function ensureDataDbExists() {
  const SQL = await initSqlJs();

  // If file does not exist, create and populate it
  if (!fs.existsSync(config.DATA_DB_PATH)) {
    const outDb = new SQL.Database();
    outDb.run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      startDate TEXT,
      endDate TEXT,
      plannedBudget REAL,
      archived INTEGER DEFAULT 0
    );`);

    outDb.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );`);

    let srcCount = 0;
    try {
      const filebuffer = fs.readFileSync(config.DB_PATH);
      const srcDb = new SQL.Database(filebuffer);
      const res = srcDb.exec("SELECT DISTINCT project FROM ICTransactionSplit WHERE project IS NOT NULL AND project <> ''");
      const projects = [];
      if (res && res[0]) {
        for (const row of res[0].values) projects.push(row[0]);
      }
      srcDb.close();

      const seen = new Set();
      for (let p of projects) {
        if (!p) continue;
        p = p.toString().trim();
        if (!p) continue;
        if (seen.has(p)) continue;
        seen.add(p);
        const esc = p.replace(/'/g, "''");
        outDb.run(`INSERT OR IGNORE INTO projects (name, startDate, endDate, plannedBudget, archived) VALUES ('${esc}', NULL, NULL, NULL, 0);`);
      }
      srcCount = seen.size;
    } catch (e) {
      console.error('Warning: failed to read source DB for projects:', e && e.message);
    }

    const binary = outDb.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    outDb.close();
    console.log('Created and populated SQLite data DB:', config.DATA_DB_PATH, 'inserted projects:', srcCount);
    return;
  }

  // If file exists, ensure it has rows; if empty, populate
  try {
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const outDb = new SQL.Database(filebuffer);
    const cntRes = outDb.exec("SELECT COUNT(*) as c FROM projects");
    let count = 0;
    if (cntRes && cntRes[0] && cntRes[0].values && cntRes[0].values[0]) count = cntRes[0].values[0][0] || 0;
    if (count > 0) {
      outDb.close();
      return;
    }

    // populate from source DB
    let srcCount = 0;
    try {
      const srcBuf = fs.readFileSync(config.DB_PATH);
      const srcDb = new SQL.Database(srcBuf);
      const res = srcDb.exec("SELECT DISTINCT project FROM ICTransactionSplit WHERE project IS NOT NULL AND project <> ''");
      const projects = [];
      if (res && res[0]) {
        for (const row of res[0].values) projects.push(row[0]);
      }
      srcDb.close();

      const seen = new Set();
      for (let p of projects) {
        if (!p) continue;
        p = p.toString().trim();
        if (!p) continue;
        if (seen.has(p)) continue;
        seen.add(p);
        const esc = p.replace(/'/g, "''");
        outDb.run(`INSERT OR IGNORE INTO projects (name, startDate, endDate, plannedBudget, archived) VALUES ('${esc}', NULL, NULL, NULL, 0);`);
      }
      srcCount = seen.size;
    } catch (e) {
      console.error('Warning: failed to read source DB for projects (existing DB path):', e && e.message);
    }

    const binary2 = outDb.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary2));
    outDb.close();
    console.log('Populated existing data DB:', config.DATA_DB_PATH, 'inserted projects:', srcCount);
  } catch (e) {
    console.error('Error ensuring data DB exists:', e && e.message);
  }
}

async function migrateDataDb() {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) return; // No DB to migrate
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Check if archived column exists
    try {
      const schemaRes = db.exec("PRAGMA table_info(projects)");
      let hasArchivedColumn = false;
      if (schemaRes && schemaRes[0]) {
        const cols = schemaRes[0].columns;
        const nameIndex = cols.indexOf('name');
        if (nameIndex >= 0) {
          for (const row of schemaRes[0].values) {
            if (row[nameIndex] === 'archived') {
              hasArchivedColumn = true;
              break;
            }
          }
        }
      }

      if (!hasArchivedColumn) {
        console.log('Adding archived column to projects table...');
        db.exec('ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0');
        console.log('Migration completed: archived column added');
      }
    } catch (e) {
      console.error('Archived column migration failed:', e && e.message);
    }

    // Check if settings table exists
    try {
      const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
      const hasSettingsTable = tablesRes && tablesRes[0] && tablesRes[0].values.length > 0;

      if (!hasSettingsTable) {
        console.log('Creating settings table...');
        db.exec(`CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );`);
        console.log('Migration completed: settings table created');
      }
    } catch (e) {
      console.error('Settings table migration failed:', e && e.message);
    }

    // Check if account_preferences table exists and migrate it
    try {
      const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='account_preferences'");
      const hasAccountPreferencesTable = tablesRes && tablesRes[0] && tablesRes[0].values.length > 0;

      if (!hasAccountPreferencesTable) {
        console.log('Creating account_preferences table...');
        db.exec(`CREATE TABLE account_preferences (
          accountId TEXT PRIMARY KEY,
          accountName TEXT NOT NULL,
          includeSavings INTEGER DEFAULT 1,
          includeChecking INTEGER DEFAULT 1
        );`);
        console.log('Migration completed: account_preferences table created');
      } else {
        // Check if we need to migrate from old 'excluded' column to new include columns
        // Also check if we need to remove the excluded column
        const schemaRes = db.exec("PRAGMA table_info(account_preferences)");
        let hasExcludedColumn = false;
        let hasIncludeSavingsColumn = false;
        let hasIncludeCheckingColumn = false;
        
        if (schemaRes && schemaRes[0]) {
          const cols = schemaRes[0].columns;
          const nameIndex = cols.indexOf('name');
          if (nameIndex >= 0) {
            for (const row of schemaRes[0].values) {
              const colName = row[nameIndex];
              if (colName === 'excluded') hasExcludedColumn = true;
              if (colName === 'includeSavings') hasIncludeSavingsColumn = true;
              if (colName === 'includeChecking') hasIncludeCheckingColumn = true;
            }
          }
        }

        // Migration from old format to new format
        if (hasExcludedColumn && !hasIncludeSavingsColumn && !hasIncludeCheckingColumn) {
          console.log('Migrating account_preferences from excluded to include columns...');
          
          // Add new columns
          db.exec('ALTER TABLE account_preferences ADD COLUMN includeSavings INTEGER DEFAULT 1');
          db.exec('ALTER TABLE account_preferences ADD COLUMN includeChecking INTEGER DEFAULT 1');
          
          // Migrate data: excluded=1 becomes includeSavings=0, includeChecking=0
          // excluded=0 becomes includeSavings=1, includeChecking=1
          db.exec(`UPDATE account_preferences SET 
            includeSavings = CASE WHEN excluded = 1 THEN 0 ELSE 1 END,
            includeChecking = CASE WHEN excluded = 1 THEN 0 ELSE 1 END`);
          
          console.log('Migration completed: account_preferences migrated to include format');
        } else if (!hasIncludeSavingsColumn || !hasIncludeCheckingColumn) {
          // Add missing columns if needed
          if (!hasIncludeSavingsColumn) {
            db.exec('ALTER TABLE account_preferences ADD COLUMN includeSavings INTEGER DEFAULT 1');
          }
          if (!hasIncludeCheckingColumn) {
            db.exec('ALTER TABLE account_preferences ADD COLUMN includeChecking INTEGER DEFAULT 1');
          }
          console.log('Migration completed: added missing include columns');
        }

        // Remove excluded column if it exists (cleanup migration)
        if (hasExcludedColumn && hasIncludeSavingsColumn && hasIncludeCheckingColumn) {
          console.log('Removing excluded column from account_preferences...');
          
          // Create new table without excluded column
          db.exec(`CREATE TABLE account_preferences_new (
            accountId TEXT PRIMARY KEY,
            accountName TEXT NOT NULL,
            includeSavings INTEGER DEFAULT 1,
            includeChecking INTEGER DEFAULT 1
          );`);
          
          // Copy data to new table
          db.exec(`INSERT INTO account_preferences_new (accountId, accountName, includeSavings, includeChecking)
                   SELECT accountId, accountName, includeSavings, includeChecking 
                   FROM account_preferences`);
          
          // Drop old table and rename new one
          db.exec('DROP TABLE account_preferences');
          db.exec('ALTER TABLE account_preferences_new RENAME TO account_preferences');
          
          console.log('Migration completed: excluded column removed');
        }
      }
    } catch (e) {
      console.error('Account preferences table migration failed:', e && e.message);
    }

    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();

    // Exécuter migrations incrémentales séparées (ex: project_saving_goals)
    try {
      const migrateSavingGoals = require('../migrations/003-project-saving-goals');
      await migrateSavingGoals();
    } catch (e) {
      console.error('Failed running migration 003-project-saving-goals:', e && e.message);
    }

    // Exécuter migration pour les montants d'épargne mensuels manuels
    try {
      const { createMonthlyManualSavingsTable } = require('../migrations/002-create-monthly-manual-savings');
      await createMonthlyManualSavingsTable();
    } catch (e) {
      console.error('Failed running migration 002-create-monthly-manual-savings:', e && e.message);
    }

    // Exécuter migration pour la table transactions
    try {
      const { createTransactionsTable } = require('../migrations/004-create-transactions');
      await createTransactionsTable();
    } catch (e) {
      console.error('Failed running migration 004-create-transactions:', e && e.message);
    }

    // Exécuter migration pour la table project_allocations
    try {
      const { createProjectAllocationTable } = require('../migrations/005-create-project-allocations');
      await createProjectAllocationTable();
    } catch (e) {
      console.error('Failed running migration 005-create-project-allocations:', e && e.message);
    }
  } catch (e) {
    console.error('Database migration failed:', e && e.message);
  }
}

module.exports = {
  syncProjectsFromMainDb,
  ensureDataDbExists,
  migrateDataDb
};
