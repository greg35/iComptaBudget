const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const https = require('https');
const http = require('http');
const yauzl = require('yauzl');
const { promisify } = require('util');

const DB_PATH = path.join(__dirname, '..', 'Comptes.cdb');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const DATA_DB_PATH = path.join(__dirname, '..', 'iComptaBudgetData.sqlite');

const app = express();

// Configure CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());

function mapAccountType(type) {
  if (!type) return 'autre';
  const t = String(type).toLowerCase();
  if (t.includes('savings') || t.includes('savingsaccount') || t.includes('saving')) return 'Épargne';
  if (t.includes('checking') || t.includes('cheque') || t.includes('checkingaccount') || t.includes('current')) return 'Chèques';
  if (t.includes('investment') || t.includes('investmentaccount') || t.includes('invest')) return 'Investissement';
  return 'autre';
}

function loadProjects() {
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
  return JSON.parse(raw);
}

async function loadProjectsFromDataDb() {
  // read projects from iComptaBudgetData.sqlite
  try {
    if (!fs.existsSync(DATA_DB_PATH)) return [];
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
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

async function migrateDataDb() {
  try {
    if (!fs.existsSync(DATA_DB_PATH)) return; // No DB to migrate
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
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
        db.exec("ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0");
        console.log('Migration completed: archived column added');
      }
    } catch (e) {
      console.error('Migration failed:', e && e.message);
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
        )`);
        console.log('Migration completed: settings table created');
      }
    } catch (e) {
      console.error('Settings table migration failed:', e && e.message);
    }

    // Check if account_preferences table exists
    try {
      const accountPrefRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='account_preferences'");
      const hasAccountPrefTable = accountPrefRes && accountPrefRes[0] && accountPrefRes[0].values.length > 0;
      
      if (!hasAccountPrefTable) {
        console.log('Creating account_preferences table...');
        db.exec(`CREATE TABLE account_preferences (
          account_id TEXT PRIMARY KEY,
          account_name TEXT,
          excluded INTEGER DEFAULT 0
        )`);
        console.log('Migration completed: account_preferences table created');
      }
    } catch (e) {
      console.error('Account preferences table migration failed:', e && e.message);
    }

    // Save changes
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    
    db.close();
  } catch (e) {
    console.error('Migration error:', e && e.message);
  }
}

async function openDb() {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);
  return db;
}

async function ensureDataDbExists() {
  const SQL = await initSqlJs();

  // If file does not exist, create and populate it
  if (!fs.existsSync(DATA_DB_PATH)) {
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
      const filebuffer = fs.readFileSync(DB_PATH);
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
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    outDb.close();
    console.log('Created and populated SQLite data DB:', DATA_DB_PATH, 'inserted projects:', srcCount);
    return;
  }

  // If file exists, ensure it has rows; if empty, populate
  try {
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
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
      const srcBuf = fs.readFileSync(DB_PATH);
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
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary2));
    outDb.close();
    console.log('Populated existing data DB:', DATA_DB_PATH, 'inserted projects:', srcCount);
  } catch (e) {
    console.error('Error ensuring data DB exists:', e && e.message);
  }
}

function findCategoryId(db, patternName) {
  try {
    const q = "SELECT ID FROM ICCategory WHERE name LIKE '%" + patternName.replace("'", "''") + "%' LIMIT 1";
    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0]) return res[0].values[0][0];
  } catch (e) {}
  return null;
}

function computeCurrentSavingsSql(db, projectId, categoryIds) {
  // Sum splits considered 'Epargne'. Prefer exact category ID matching when possible.
  // categoryIds may be an array like [catIdVirements, catIdEpargne] (elements may be null).
  try {
    const escProject = String(projectId).replace(/'/g, "''");
    // build category id filter if we have ids
    const ids = (Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : []).map(id => String(id));
    let q;
    if (ids.length > 0) {
      // exact match on s.category
      const inList = ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(',');
      q = "SELECT SUM(CAST(s.amount AS REAL)) as s FROM ICTransactionSplit s WHERE s.project = '" + escProject + "' AND s.category IN (" + inList + ")";
    } else {
      // fallback to name-based heuristic
      q = "SELECT SUM(CAST(s.amount AS REAL)) as s FROM ICTransactionSplit s LEFT JOIN ICCategory c1 ON s.category = c1.ID " +
          "WHERE s.project = '" + escProject + "' AND (lower(c1.name) LIKE '%virements d''épargne%' OR lower(c1.name) = 'epargne')";
    }
    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] !== null) return res[0].values[0][0];
  } catch (e) {
    // swallow and fallback to zero
  }

  return 0;
}

function computeCurrentSpentSql(db, projectId, excludeCategoryIds) {
  // Sum absolute value of negative splits for a project, excluding provisions and optionally excluding savings categories
  try {
    const escProject = String(projectId).replace(/'/g, "''");
    const ids = (Array.isArray(excludeCategoryIds) ? excludeCategoryIds.filter(Boolean) : []).map(id => String(id));
    // base filter: negative amounts and not provisions
    let q = "SELECT SUM(CAST(-s.amount AS REAL)) as spent FROM ICTransactionSplit s LEFT JOIN ICCategory c1 ON s.category = c1.ID " +
            "WHERE s.project = '" + escProject + "' AND CAST(s.amount AS REAL) < 0 AND (c1.name IS NULL OR lower(c1.name) NOT LIKE '%provision%')";
    if (ids.length > 0) {
      const inList = ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(',');
      q += " AND (s.category IS NULL OR s.category NOT IN (" + inList + "))";
    } else {
      // fallback: try to exclude categories whose name contains 'virements' or 'epargne'
      q += " AND (c1.name IS NULL OR (lower(c1.name) NOT LIKE '%virements%' AND lower(c1.name) NOT LIKE '%epargne%'))";
    }
    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] !== null) return res[0].values[0][0];
  } catch (e) {}
  return 0;
}

function getDistinctSplitProjects(db) {
  try {
    const q = "SELECT project, COUNT(*) as cnt, SUM(CAST(amount AS REAL)) as total FROM ICTransactionSplit GROUP BY project";
    const resq = db.exec(q);
    const out = [];
    if (resq && resq[0]) {
      const cols = resq[0].columns;
      for (const row of resq[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        out.push(obj);
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

function scoreMatch(projectName, splitProject) {
  if (!splitProject) return 0;
  const a = (projectName || '').toString().toLowerCase();
  const b = splitProject.toString().toLowerCase();
  if (!a) return 0;
  // exact containment
  let score = 0;
  if (b.includes(a)) score += 50;
  // token overlap
  const tokensA = a.split(/[^a-z0-9]+/).filter(Boolean);
  const tokensB = new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
  for (const t of tokensA) if (tokensB.has(t)) score += 5;
  // shorter project strings that end with the name get bonus
  if (b.endsWith(a)) score += 10;
  // numbers / years matching
  const numsA = a.match(/\d{3,4}/g) || [];
  for (const n of numsA) if (b.includes(n)) score += 7;
  // prefer non-null project names
  if (splitProject !== null && splitProject !== 'null') score += 1;
  return score;
}

function findBestCandidates(projectName, splitProjects, topN = 5) {
  const scored = splitProjects.map(sp => ({
    project: sp.project,
    cnt: sp.cnt,
    total: sp.total,
    score: scoreMatch(projectName, sp.project)
  }));
  scored.sort((a,b) => b.score - a.score || (b.cnt || 0) - (a.cnt || 0));
  return scored.slice(0, topN);
}

// Endpoint to help map project GUIDs present in ICTransactionSplit
app.get('/api/split-projects', async (req, res) => {
  const db = await openDb();
  try {
    // parse optional exclude types (comma-separated) from query: ?excludeTypes=checking,investment
    const excludeParam = (req.query.excludeTypes || req.query.exclude || '').toString().toLowerCase();
    const excludeTokens = excludeParam.split(',').map(s => s.trim()).filter(Boolean);
    const excludeLabelSet = new Set();
    const addLabel = (label) => {
      if (!label) return;
      const low = label.toString().toLowerCase();
      excludeLabelSet.add(low);
      // also add a de-accented version for robustness
      try {
        const deaccent = low.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        excludeLabelSet.add(deaccent);
      } catch (e) {
        // ignore if normalization not supported
      }
    };
    for (const tok of excludeTokens) {
      if (['checking', 'cheque', 'cheques', 'chèque', 'chèques', 'cheques'].includes(tok)) addLabel('Chèques');
      if (['savings', 'livret', 'epargne', 'épargne', 'savingsaccount'].includes(tok)) addLabel('Épargne');
      if (['investment', 'investissement', 'investmentaccount'].includes(tok)) addLabel('Investissement');
      if (['autre', 'other'].includes(tok)) addLabel('autre');
    }
    const q = "SELECT project, COUNT(*) as cnt, SUM(CAST(amount AS REAL)) as total FROM ICTransactionSplit GROUP BY project ORDER BY cnt DESC LIMIT 200";
    const resq = db.exec(q);
    const out = [];
    if (resq && resq[0]) {
      const cols = resq[0].columns;
      for (const row of resq[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        out.push(obj);
      }
    }
    res.json(out);
  } finally {
    db.close();
  }
});

// Auto-mapping endpoint: for each frontend project, propose candidate split.project values
app.get('/api/auto-map', async (req, res) => {
  const projects = loadProjects();
  const db = await openDb();
  try {
    const splits = getDistinctSplitProjects(db);
    const out = projects.map(p => ({
      id: p.id,
      name: p.name,
      candidates: findBestCandidates(p.name, splits, 8)
    }));
    res.json(out);
  } finally {
    db.close();
  }
});

// Update plannedBudget for a project in iComptaBudgetData.sqlite
app.patch('/api/projects/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing project id' });
  const body = req.body || {};
  const hasPlanned = Object.prototype.hasOwnProperty.call(body, 'plannedBudget');
  const plannedBudget = body.plannedBudget;
  if (hasPlanned && (plannedBudget == null || isNaN(Number(plannedBudget)))) return res.status(400).json({ error: 'invalid plannedBudget' });

  try {
    const SQL = await initSqlJs();
    // ensure data DB exists
    if (!fs.existsSync(DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(buf);
    const updates = [];
    if (plannedBudget != null && !isNaN(Number(plannedBudget))) {
      updates.push(`plannedBudget = ${Number(plannedBudget)}`);
    }
    if (body.startDate != null) {
      const sd = String(body.startDate).replace(/'/g, "''");
      updates.push(`startDate = '${sd}'`);
    }
    if (body.endDate != null) {
      const ed = String(body.endDate).replace(/'/g, "''");
      updates.push(`endDate = '${ed}'`);
    }
    if (body.archived != null) {
      const archived = Boolean(body.archived) ? 1 : 0;
      updates.push(`archived = ${archived}`);
    }
    if (updates.length === 0) {
      db.close();
      return res.status(400).json({ error: 'nothing to update' });
    }
    const updSql = `UPDATE projects SET ${updates.join(', ')} WHERE id = '${String(id).replace(/'/g, "''")}'`;
    db.exec(updSql);
    // export and persist
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    // read back the updated row to return to client
    let proj = null;
    try {
      const r = db.exec(`SELECT id, name, startDate, endDate, plannedBudget, archived FROM projects WHERE id = '${String(id).replace(/'/g, "''")}' LIMIT 1`);
      if (r && r[0] && r[0].values && r[0].values[0]) {
        const cols = r[0].columns;
        const row = r[0].values[0];
        proj = {};
        cols.forEach((c, i) => proj[c] = row[i]);
        if (proj.archived !== undefined) {
          proj.archived = Boolean(proj.archived);
        }
      }
    } catch (e) {
      // ignore
    }
    db.close();
    return res.json({ ok: true, id, updated: updates, project: proj });
  } catch (e) {
    console.error('Failed to update project', e && e.message);
    return res.status(500).json({ error: 'failed to update project' });
  }
});

// Delete a project from iComptaBudgetData.sqlite
app.delete('/api/projects/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing project id' });
  
  try {
    const SQL = await initSqlJs();
    // ensure data DB exists
    if (!fs.existsSync(DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(buf);
    
    // First, check if the project exists
    const checkRes = db.exec(`SELECT id, name FROM projects WHERE id = '${String(id).replace(/'/g, "''")}' LIMIT 1`);
    if (!checkRes || !checkRes[0] || !checkRes[0].values || checkRes[0].values.length === 0) {
      db.close();
      return res.status(404).json({ error: 'project not found' });
    }
    
    const projectName = checkRes[0].values[0][1]; // name column
    
    // Delete the project
    const deleteSql = `DELETE FROM projects WHERE id = '${String(id).replace(/'/g, "''")}'`;
    db.exec(deleteSql);
    
    // export and persist
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    return res.json({ ok: true, id, deletedProject: { id, name: projectName } });
  } catch (e) {
    console.error('Failed to delete project', e && e.message);
    return res.status(500).json({ error: 'failed to delete project' });
  }
});

// Create a new project in iComptaBudgetData.sqlite
app.post('/api/projects', async (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'missing name' });
  try {
    const SQL = await initSqlJs();
    if (!fs.existsSync(DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(buf);
  const esc = name.replace(/'/g, "''");
  // prepare optional fields
  const sdVal = (body.startDate != null && body.startDate !== '') ? String(body.startDate).trim() : null;
  const edVal = (body.endDate != null && body.endDate !== '') ? String(body.endDate).trim() : null;
  const sd = sdVal ? (`'${sdVal.replace(/'/g, "''")}'`) : 'NULL';
  const ed = edVal ? (`'${edVal.replace(/'/g, "''")}'`) : 'NULL';
  const pbRaw = (body.plannedBudget != null && body.plannedBudget !== '') ? Number(body.plannedBudget) : null;
  const pb = (pbRaw != null && !isNaN(pbRaw)) ? pbRaw : 'NULL';
  const archived = body.archived ? 1 : 0;
  db.exec(`INSERT INTO projects (name, startDate, endDate, plannedBudget, archived) VALUES ('${esc}', ${sd}, ${ed}, ${pb}, ${archived})`);
    // return the inserted row
    const r = db.exec(`SELECT id, name, startDate, endDate, plannedBudget, archived FROM projects WHERE name = '${esc}' ORDER BY id DESC LIMIT 1`);
    let proj = null;
    if (r && r[0] && r[0].values && r[0].values[0]) {
      proj = {};
      const cols = r[0].columns;
      cols.forEach((c, i) => proj[c] = r[0].values[0][i]);
      if (proj.archived !== undefined) {
        proj.archived = Boolean(proj.archived);
      }
    }
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    db.close();
    return res.json({ ok: true, project: proj });
  } catch (e) {
    console.error('failed to create project', e && e.message);
    return res.status(500).json({ error: 'failed to create project' });
  }
});

app.get('/api/projects', async (req, res) => {
  let projects = await loadProjectsFromDataDb();
  if (!projects || projects.length === 0) {
    projects = loadProjects();
  }
  const db = await openDb();
  try {
  const doAutoMap = (req.query.autoMap === 'true');
  const splits = doAutoMap ? getDistinctSplitProjects(db) : null;
  // detect category ids for savings-related categories
  const catIdVirements = findCategoryId(db, "Virements d'épargne");
  const catIdEpargne = findCategoryId(db, "Epargne");
  const catIdVirementsInternes = findCategoryId(db, "Virements internes");
  const out = projects.map(p => {
      let projectKey = p.dbProject || p.id; // if user mapped dbProject use it, else fallback to id
      if (doAutoMap && (!p.dbProject || p.dbProject === null)) {
        // try to find the best candidate
        const candidates = findBestCandidates(p.name, splits, 1);
        if (candidates && candidates[0] && candidates[0].score > 10) {
          projectKey = candidates[0].project;
        }
      }
  const currentSavings = computeCurrentSavingsSql(db, projectKey, [catIdVirements, catIdEpargne]) || 0;
      const currentSpent = computeCurrentSpentSql(db, projectKey, [catIdVirements, catIdEpargne, catIdVirementsInternes]) || 0;
      return Object.assign({}, p, { currentSavings, currentSpent });
    });
  // ensure projects are sorted by name descending (locale fr)
  out.sort((a,b) => (b.name || '').localeCompare(a.name || '', 'fr', { sensitivity: 'base' }));
  res.json(out);
  } finally {
    db.close();
  }
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const SQL = await initSqlJs();
    if (!fs.existsSync(DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(buf);
    
    const result = db.exec("SELECT key, value FROM settings");
    const settings = {};
    if (result && result[0]) {
      for (const row of result[0].values) {
        settings[row[0]] = row[1];
      }
    }
    
    db.close();
    return res.json(settings);
  } catch (e) {
    console.error('Failed to get settings', e && e.message);
    return res.status(500).json({ error: 'failed to get settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  const body = req.body || {};
  const key = body.key;
  const value = body.value;
  
  if (!key) return res.status(400).json({ error: 'missing key' });
  
  try {
    const SQL = await initSqlJs();
    if (!fs.existsSync(DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(buf);
    
    const escapedKey = String(key).replace(/'/g, "''");
    const escapedValue = String(value || '').replace(/'/g, "''");
    
    // Use INSERT OR REPLACE to update existing keys or insert new ones
    db.exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('${escapedKey}', '${escapedValue}')`);
    
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    return res.json({ ok: true, key, value });
  } catch (e) {
    console.error('Failed to save setting', e && e.message);
    return res.status(500).json({ error: 'failed to save setting' });
  }
});

// Update accounts from Dropbox
app.post('/api/update-accounts', async (req, res) => {
  try {
    // Get Dropbox URL from settings
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const result = db.exec("SELECT value FROM settings WHERE key = 'dropbox_url'");
    let dropboxUrl = null;
    if (result && result[0] && result[0].values.length > 0) {
      dropboxUrl = result[0].values[0][0];
    }
    db.close();
    
    if (!dropboxUrl) {
      return res.status(400).json({ error: 'URL Dropbox non configurée dans les paramètres' });
    }
    
    // Convert Dropbox share URL to direct download URL
    const directUrl = dropboxUrl.replace('dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    
    console.log('Téléchargement depuis:', directUrl);
    
    // Download the ZIP file
    const tempZipPath = path.join(__dirname, 'temp_accounts.zip');
    await downloadFile(directUrl, tempZipPath);
    
    console.log('Fichier téléchargé, décompression en cours...');
    
    // Extract the ZIP file
    const extractedFiles = await extractZip(tempZipPath, __dirname);
    
    // Find the .cdb file in extracted files
    const cdbFile = extractedFiles.find(file => file.endsWith('.cdb'));
    if (!cdbFile) {
      // Cleanup
      fs.unlinkSync(tempZipPath);
      extractedFiles.forEach(file => {
        const fullPath = path.join(__dirname, path.basename(file));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      });
      return res.status(400).json({ error: 'Aucun fichier .cdb trouvé dans l\'archive ZIP' });
    }
    
    console.log('Fichier .cdb trouvé:', cdbFile);
    
    // Backup existing Comptes.cdb if it exists
    if (fs.existsSync(DB_PATH)) {
      const backupPath = DB_PATH + '.backup.' + Date.now();
      fs.copyFileSync(DB_PATH, backupPath);
      console.log('Sauvegarde créée:', backupPath);
    }
    
    // Move the extracted .cdb file to replace Comptes.cdb
    const extractedCdbPath = path.join(__dirname, path.basename(cdbFile));
    fs.copyFileSync(extractedCdbPath, DB_PATH);
    
    // Cleanup temporary files
    fs.unlinkSync(tempZipPath);
    extractedFiles.forEach(file => {
      const fullPath = path.join(__dirname, path.basename(file));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
    
    console.log('Mise à jour des comptes terminée avec succès');
    
    res.json({ 
      success: true, 
      message: 'Comptes mis à jour avec succès',
      cdbFile: path.basename(cdbFile)
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour des comptes:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour des comptes', 
      details: error.message 
    });
  }
});

// Helper function to download a file
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(destination);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to extract ZIP file
function extractZip(zipPath, extractDir) {
  return new Promise((resolve, reject) => {
    const extractedFiles = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
        } else {
          // File entry
          const fileName = path.basename(entry.fileName);
          const outputPath = path.join(extractDir, fileName);
          
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const writeStream = fs.createWriteStream(outputPath);
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              extractedFiles.push(entry.fileName);
              zipfile.readEntry();
            });
            
            writeStream.on('error', reject);
          });
        }
      });
      
      zipfile.on('end', () => {
        resolve(extractedFiles);
      });
      
      zipfile.on('error', reject);
    });
  });
}

// Return transaction splits for a given project key (project column in ICTransactionSplit)
app.get('/api/project-transactions', async (req, res) => {
  const projectKey = req.query.project;
  if (!projectKey) return res.status(400).json({ error: 'missing project query param' });
  const db = await openDb();
  try {
  const q = `SELECT s.ID as splitId, s.amount as amount, s.project as project, COALESCE(t.date, t.valueDate, '') as txDate, t.name as txName, c1.name as splitCategoryName, s.comment as splitComment
     FROM ICTransactionSplit s
         LEFT JOIN ICTransaction t ON s."transaction" = t.ID
         LEFT JOIN ICCategory c1 ON s.category = c1.ID
               WHERE s.project = '${String(projectKey).replace(/'/g, "''")}'
                 AND (c1.name IS NULL OR (lower(c1.name) NOT LIKE '%provision%' AND lower(c1.name) NOT LIKE '%virements internes%' AND lower(c1.name) NOT LIKE '%virements internes%'))
               ORDER BY t.date DESC LIMIT 1000`;
    const resq = db.exec(q);
    const out = [];
    if (resq && resq[0]) {
      const cols = resq[0].columns;
      for (const row of resq[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        // normalize a few fields for the frontend
        out.push({
          id: String(obj.splitId || ''),
          amount: obj.amount == null ? 0 : Number(obj.amount),
          date: obj.txDate || null,
          description: obj.txName || '',
          comment: obj.splitComment || '',
          category: obj.splitCategoryName || null,
          type: (Number(obj.amount) >= 0) ? 'income' : 'expense'
        });
      }
    }
    res.json(out);
  } finally {
    db.close();
  }
});

// Return accounts optionally filtered by folder name (e.g., ?folder=Disponible)
app.get('/api/accounts', async (req, res) => {
  const folder = (req.query.folder || '').toString();
  const db = await openDb();
  try {
    // Try to query ICAccount table. Columns differ across versions; attempt a few heuristics
    // 1) If ICAccountFolder exists, join and match folder.name
    // 2) Otherwise match account.name LIKE '%folder%'
    // detect if ICAccount has a 'hidden' column so we can exclude archived accounts
    let hasHidden = false;
    let hasClassCol = false;
    let hasTypeCol = false;

    try {
      const pi = db.exec("PRAGMA table_info('ICAccount')");
      if (pi && pi[0] && pi[0].values) {
        const cols = pi[0].values.map(r => r[1]);
        if (cols && cols.includes('hidden')) hasHidden = true;
        if (cols && cols.includes('class')) hasClassCol = true;
        if (cols && cols.includes('type')) hasTypeCol = true;
      }
    } catch (e) {
      // ignore
    }
    const hiddenClause = hasHidden ? " AND (a.hidden IS NULL OR a.hidden = 0) " : " ";
    const classClause = hasClassCol ? " AND lower(a.class) = 'icaccount' " : " ";
    const savingClause = hasTypeCol ? " AND a.type = 'ICAccountType.SavingsAccount' " : " ";

    // attempt join with ICAccountFolder and compute balance by summing splits for the account
    try {
      // Walk the parent chain (recursively) and match any ancestor with class = 'ICAccountsGroup' and name = 'Disponible'
      const qBal = `WITH RECURSIVE parent_chain(acc_id, parent_id, pname, pclass) AS (
          SELECT a.ID as acc_id, a.parent as parent_id, NULL as pname, NULL as pclass FROM ICAccount a
          UNION ALL
          SELECT pc.acc_id, p.parent as parent_id, p.name as pname, p.class as pclass FROM ICAccount p JOIN parent_chain pc ON p.ID = pc.parent_id
        )
        SELECT a.ID as id, a.name as name, COALESCE(bal.balance,0) as balance, a.type as type
        FROM ICAccount a
        LEFT JOIN (SELECT t.account as accId, SUM(CAST(s.amount AS REAL)) as balance FROM ICTransactionSplit s LEFT JOIN ICTransaction t ON s."transaction" = t.ID GROUP BY t.account) as bal ON a.ID = bal.accId
        WHERE EXISTS (
          SELECT 1 FROM parent_chain pc WHERE pc.acc_id = a.ID AND lower(pc.pclass) = 'icaccountsgroup' AND lower(pc.pname) = 'disponible'
        ) ${hiddenClause} ${classClause} ${savingClause}`;
  const r = db.exec(qBal);
  console.debug && console.debug('accounts: qBal executed', { rows: (r && r[0] && r[0].values && r[0].values.length) || 0, hasHidden, hasClassCol });
  if (r && r[0] && r[0].values && r[0].values.length > 0) {
        let out = [];
        const cols = r[0].columns;
        for (const row of r[0].values) {
          const obj = {};
          cols.forEach((c, i) => obj[c] = row[i]);
          out.push({ id: String(obj.id || ''), name: obj.name || '', balance: Number(obj.balance || 0), type: mapAccountType(obj.type) });
        }
        res.json(out);
        return;
      }
    } catch (e) {
      // ignore and fallback to empty
      console.error('accounts: qBal error', String(e && e.message));
    }

    // if we reach here nothing matched or an error occurred; return empty array
    if (!res.headersSent) {
      res.json([]);
    }
  } finally {
    db.close();
  }
});

// Monthly savings data endpoint
app.get('/api/monthly-savings', async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  
  try {
    const db = await openDb();
    
    // Load data DB for account preferences
    const SQL = await initSqlJs();
    const dataBuffer = fs.readFileSync(DATA_DB_PATH);
    const dataDb = new SQL.Database(dataBuffer);
    
    // Get excluded accounts from preferences
    const excludedAccountsResult = dataDb.exec(`
      SELECT account_id FROM account_preferences WHERE excluded = 1
    `);
    
    const excludedAccountIds = [];
    if (excludedAccountsResult && excludedAccountsResult[0]) {
      excludedAccountsResult[0].values.forEach(row => {
        excludedAccountIds.push(row[0]);
      });
    }
    dataDb.close();
    
    // Create excluded accounts filter
    let excludeAccountsFilter = '';
    if (excludedAccountIds.length > 0) {
      const escapedIds = excludedAccountIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      excludeAccountsFilter = `AND t.account NOT IN (${escapedIds})`;
    }
    
    // Calculate date range for the last X months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);
    
    const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const endDateStr = endDate.toISOString().slice(0, 10);
    
    // CTEs pour la hiérarchie des catégories seulement
    const commonCTE = `
      WITH RECURSIVE category_chain(cat_id, parent_id, root_name) AS (
        SELECT c.ID as cat_id, c.parent as parent_id, c.name as root_name 
        FROM ICCategory c
        WHERE c.parent IS NULL
        UNION ALL
        SELECT c.ID as cat_id, c.parent as parent_id, pc.root_name
        FROM ICCategory c 
        JOIN category_chain pc ON c.parent = pc.cat_id
      )`;
    
    // 1. Requête pour le total épargné par mois (indépendamment des projets et de la période de filtrage)
    const totalByMonthQuery = `
      ${commonCTE}
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(s.amount) as total_amount
      FROM ICTransactionSplit s
      LEFT JOIN ICTransaction t ON s."transaction" = t.ID
      LEFT JOIN ICCategory c ON s.category = c.ID
      WHERE s.category IS NOT NULL
        ${excludeAccountsFilter}
        AND NOT EXISTS (
          SELECT 1 FROM category_chain cc 
          WHERE cc.cat_id = s.category 
          AND (
            cc.root_name LIKE '%Hors Budget%' 
            OR cc.root_name LIKE '%99. Projets Financés%'
            OR LOWER(cc.root_name) LIKE '%hors budget%'
            OR LOWER(cc.root_name) LIKE '%projets financés%'
          )
        )
      GROUP BY strftime('%Y-%m', t.date)
      ORDER BY month DESC
    `;
    
    // 2. Requête pour la ventilation par projet (seulement pour la période demandée)
    const projectBreakdownQuery = `
      ${commonCTE}
      SELECT 
        strftime('%Y-%m', t.date) as month,
        COALESCE(s.project, '') as project,
        SUM(s.amount) as total_amount
      FROM ICTransactionSplit s
      LEFT JOIN ICTransaction t ON s."transaction" = t.ID
      LEFT JOIN ICCategory c ON s.category = c.ID
      WHERE t.date >= ? AND t.date <= ?
        AND s.category IS NOT NULL
        ${excludeAccountsFilter}
        AND NOT EXISTS (
          SELECT 1 FROM category_chain cc 
          WHERE cc.cat_id = s.category 
          AND (
            cc.root_name LIKE '%Hors Budget%' 
            OR cc.root_name LIKE '%99. Projets Financés%'
            OR LOWER(cc.root_name) LIKE '%hors budget%'
            OR LOWER(cc.root_name) LIKE '%projets financés%'
          )
        )
      GROUP BY strftime('%Y-%m', t.date), COALESCE(s.project, '')
      ORDER BY month DESC, project
    `;
    
    // Exécuter les deux requêtes
    const totalResult = db.exec(totalByMonthQuery);
    const projectResult = db.exec(projectBreakdownQuery, [startDateStr, endDateStr]);
    
    // Traiter les résultats des totaux par mois
    const monthlyTotals = {};
    if (totalResult && totalResult[0]) {
      const cols = totalResult[0].columns;
      for (const row of totalResult[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        monthlyTotals[obj.month] = Number(obj.total_amount) || 0;
      }
    }
    
    // Traiter les résultats de la ventilation par projet
    const monthlyData = {};
    if (projectResult && projectResult[0]) {
      const cols = projectResult[0].columns;
      for (const row of projectResult[0].values) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        
        const month = obj.month;
        const project = obj.project || 'unassigned';
        const amount = Number(obj.total_amount) || 0;
        
        if (!monthlyData[month]) {
          monthlyData[month] = {
            projectBreakdown: {}
          };
        }
        
        if (!monthlyData[month].projectBreakdown[project]) {
          monthlyData[month].projectBreakdown[project] = 0;
        }
        monthlyData[month].projectBreakdown[project] += amount;
      }
    }
    
    // Generate the complete months array even if no data
    const responseData = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
      
      responseData.push({
        month: monthKey,
        label: monthLabel,
        // Utiliser le total réel du mois (indépendamment des projets filtrés)
        totalSavings: monthlyTotals[monthKey] || 0,
        // Utiliser la ventilation par projet (seulement pour la période demandée)
        projectBreakdown: monthlyData[monthKey]?.projectBreakdown || {}
      });
    }
    
    db.close();
    res.json(responseData);
    
  } catch (error) {
    console.error('Failed to get monthly savings data:', error);
    res.status(500).json({ error: 'Failed to get monthly savings data' });
  }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const db = await openDb();
    const accountsRes = db.exec(`
      SELECT DISTINCT id, compteNom as name 
      FROM comptes 
      ORDER BY compteNom
    `);
    
    if (accountsRes && accountsRes[0]) {
      const accounts = accountsRes[0].values.map(row => ({
        id: row[0],
        name: row[1]
      }));
      db.close();
      res.json(accounts);
    } else {
      db.close();
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get account preferences
app.get('/api/account-preferences', async (req, res) => {
  try {
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    const preferencesRes = db.exec(`
      SELECT account_id, account_name, excluded 
      FROM account_preferences
    `);
    
    if (preferencesRes && preferencesRes[0]) {
      const preferences = preferencesRes[0].values.map(row => ({
        accountId: row[0],
        accountName: row[1],
        excluded: Boolean(row[2])
      }));
      db.close();
      res.json(preferences);
    } else {
      db.close();
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching account preferences:', error);
    res.status(500).json({ error: 'Failed to fetch account preferences' });
  }
});

// Update account preferences
app.post('/api/account-preferences', async (req, res) => {
  try {
    const { accountId, accountName, excluded } = req.body;
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Insert or update account preference
    db.exec(`
      INSERT OR REPLACE INTO account_preferences (account_id, account_name, excluded)
      VALUES (?, ?, ?)
    `, [accountId, accountName, excluded ? 1 : 0]);
    
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating account preference:', error);
    res.status(500).json({ error: 'Failed to update account preference' });
  }
});

// Refresh account preferences with all current accounts
app.post('/api/account-preferences/refresh', async (req, res) => {
  try {
    // Get all current accounts from main Comptes.cdb
    const mainDb = await openDb();
    
    const accountsRes = mainDb.exec(`
      SELECT DISTINCT id, name
      FROM ICAccount a
      WHERE class = 'ICAccount'
      ORDER BY name
    `);
    
    let accounts = [];
    if (accountsRes && accountsRes[0]) {
      accounts = accountsRes[0].values;
    }
    mainDb.close();
    
    // Update preferences in iComptaBudgetData.sqlite
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
    const dataDb = new SQL.Database(filebuffer);
    
    // Insert new accounts with default exclusion = 0
    for (const account of accounts) {
      dataDb.exec(`
        INSERT OR IGNORE INTO account_preferences (account_id, account_name, excluded)
        VALUES (?, ?, 0)
      `, [account[0], account[1]]);
    }
    
    // Update account names for existing preferences
    for (const account of accounts) {
      dataDb.exec(`
        UPDATE account_preferences 
        SET account_name = ?
        WHERE account_id = ?
      `, [account[1], account[0]]);
    }
    
    const binary = dataDb.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    dataDb.close();
    
    res.json({ success: true, accountsFound: accounts.length });
  } catch (error) {
    console.error('Error refreshing account preferences:', error);
    res.status(500).json({ error: 'Failed to refresh account preferences' });
  }
});

// Save all account preferences at once
app.post('/api/account-preferences/save-all', async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Invalid preferences data' });
    }
    
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DATA_DB_PATH);
    const db = new SQL.Database(filebuffer);
    
    // Update all preferences
    for (const pref of preferences) {
      db.exec(`
        INSERT OR REPLACE INTO account_preferences (account_id, account_name, excluded)
        VALUES (?, ?, ?)
      `, [pref.accountId, pref.accountName, pref.excluded ? 1 : 0]);
    }
    
    const binary = db.export();
    fs.writeFileSync(DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    res.json({ success: true, saved: preferences.length });
  } catch (error) {
    console.error('Error saving account preferences:', error);
    res.status(500).json({ error: 'Failed to save account preferences' });
  }
});

// diagnostic endpoints removed

const port = process.env.PORT || 4000;
(async () => {
  await ensureDataDbExists();
  await migrateDataDb();
  app.listen(port, () => console.log(`Backend listening on http://127.0.0.1:${port}/api/projects`));
})();
