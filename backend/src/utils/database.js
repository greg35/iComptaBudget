const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

async function openDb(dbPath) {
  const SQL = await initSqlJs();
  
  // Check if the main database file exists
  if (!fs.existsSync(dbPath)) {
    // Return a temporary empty database if the main file doesn't exist
    console.warn(`Main database file ${dbPath} does not exist, creating temporary empty database`);
    return new SQL.Database();
  }

  const filebuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(filebuffer);
  return db;
}

function mapAccountType(type) {
  if (!type) return 'autre';
  const t = String(type).toLowerCase();
  if (t.includes('savings') || t.includes('savingsaccount') || t.includes('saving')) return 'Épargne';
  if (t.includes('checking') || t.includes('cheque') || t.includes('checkingaccount') || t.includes('current')) return 'Chèques';
  if (t.includes('investment') || t.includes('investmentaccount') || t.includes('invest')) return 'Investissement';
  return 'autre';
}

function loadProjects() {
  const raw = fs.readFileSync(config.PROJECTS_FILE, 'utf8');
  return JSON.parse(raw);
}

async function loadProjectsFromDataDb() {
  // read projects from iComptaBudgetData.sqlite
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) return [];
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    const res = db.exec("SELECT id, name, startDate, endDate, plannedBudget, archived FROM projects ORDER BY id ASC");
    const out = [];
    if (res && res[0]) {
      const cols = res[0].columns;
      for (const row of res[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        out.push({ 
          id: String(obj.id), 
          name: obj.name, 
          startDate: obj.startDate, 
          endDate: obj.endDate, 
          plannedBudget: obj.plannedBudget, 
          archived: Boolean(obj.archived),
          dbProject: obj.name 
        });
      }
    }
    db.close();
    return out;
  } catch (e) {
    console.error('Failed to load projects from data DB:', e && e.message);
    return [];
  }
}

module.exports = {
  openDb,
  mapAccountType,
  loadProjects,
  loadProjectsFromDataDb
};
