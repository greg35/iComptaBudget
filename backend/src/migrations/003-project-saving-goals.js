const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

// Calcule le nombre de mois entre deux dates inclusivement en se basant sur AAAA-MM
function diffMonthsInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const [ys, ms] = startDate.split('-').map(Number);
  const [ye, me] = endDate.split('-').map(Number);
  return (ye - ys) * 12 + (me - ms) + 1;
}

async function migrate() {
  if (!fs.existsSync(config.DATA_DB_PATH)) return; // rien à faire
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(config.DATA_DB_PATH);
  const db = new SQL.Database(buf);
  let changed = false;

  try {
    // Vérifier existence table
    const hasTableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='project_saving_goals'");
    const hasTable = hasTableRes && hasTableRes[0] && hasTableRes[0].values.length > 0;
    if (!hasTable) {
      db.exec(`CREATE TABLE project_saving_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        reason TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );`);
      db.exec('CREATE INDEX idx_project_saving_goals_project ON project_saving_goals(project_id);');
      db.exec('CREATE INDEX idx_project_saving_goals_period ON project_saving_goals(project_id, start_date, end_date);');
      changed = true;

      // Initialiser un objectif pour chaque projet qui a budget + dates
      const projRes = db.exec("SELECT id, startDate, endDate, plannedBudget FROM projects WHERE plannedBudget IS NOT NULL AND plannedBudget > 0 AND startDate IS NOT NULL AND endDate IS NOT NULL");
      if (projRes && projRes[0]) {
        const cols = projRes[0].columns;
        const idxId = cols.indexOf('id');
        const idxS = cols.indexOf('startDate');
        const idxE = cols.indexOf('endDate');
        const idxB = cols.indexOf('plannedBudget');
        for (const row of projRes[0].values) {
          const pid = row[idxId];
          const sd = row[idxS];
          const ed = row[idxE];
          const bud = Number(row[idxB]) || 0;
          const months = diffMonthsInclusive((sd||'').slice(0,7), (ed||'').slice(0,7));
            if (months > 0 && bud > 0) {
              const monthly = Math.ceil(bud / months);
              const startMonth = (sd||'').slice(0,7) + '-01';
              db.run(`INSERT INTO project_saving_goals (project_id, amount, start_date, end_date, reason) VALUES (${pid}, ${monthly}, '${startMonth}', NULL, 'initial');`);
            }
        }
      }
    }
  } catch (e) {
    console.error('Migration project_saving_goals failed:', e && e.message);
  }

  if (changed) {
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
  }
  db.close();
}

module.exports = migrate;