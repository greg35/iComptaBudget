const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb, loadProjects, loadProjectsFromDataDb } = require('../utils/database');

const router = express.Router();

// Helper functions (à extraire plus tard si nécessaire)
function getDistinctSplitProjects(db) {
  try {
    const res = db.exec("SELECT DISTINCT project FROM ICTransactionSplit WHERE project IS NOT NULL AND project <> '' ORDER BY project");
    const projects = [];
    if (res && res[0]) {
      for (const row of res[0].values) {
        if (row[0]) projects.push(row[0]);
      }
    }
    return projects;
  } catch (e) {
    console.error('Error getting distinct split projects:', e && e.message);
    return [];
  }
}

function findCategoryId(db, categoryName) {
  try {
    const escaped = categoryName.replace(/'/g, "''");
    const res = db.exec(`SELECT ID FROM ICCategory WHERE Name = '${escaped}' LIMIT 1`);
    if (res && res[0] && res[0].values && res[0].values[0]) {
      return res[0].values[0][0];
    }
    return null;
  } catch (e) {
    console.error(`Error finding category ID for '${categoryName}':`, e && e.message);
    return null;
  }
}

function computeCurrentSavingsSql(db, projectKey, categoryIds) {
  try {
    const escProject = String(projectKey).replace(/'/g, "''");
    // build category id filter if we have ids
    const ids = (Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : []).map(id => String(id));
    let q;
    if (ids.length > 0) {
      // exact match on s.category
      const inList = ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(',');
      q = "SELECT SUM(CAST(s.amount AS REAL)) as s FROM ICTransactionSplit s " +
          "LEFT JOIN ICTransaction t ON s.\"transaction\" = t.ID " +
          "WHERE s.project = '" + escProject + "' AND s.category IN (" + inList + ") " +
          "AND (t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus')";
    } else {
      // fallback to name-based heuristic
      q = "SELECT SUM(CAST(s.amount AS REAL)) as s FROM ICTransactionSplit s " +
          "LEFT JOIN ICCategory c1 ON s.category = c1.ID " +
          "LEFT JOIN ICTransaction t ON s.\"transaction\" = t.ID " +
          "WHERE s.project = '" + escProject + "' AND (lower(c1.name) LIKE '%virements d''épargne%' OR lower(c1.name) = 'epargne') " +
          "AND (t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus')";
    }
    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] !== null) {
      return Number(res[0].values[0][0]) || 0;
    }
    return 0;
  } catch (e) {
    console.error('Error computing current savings:', e && e.message);
    return 0;
  }
}

function computeCurrentSavingsDataSql(db, projectId) {
  try {
    let q;
    q = "SELECT SUM(CAST(t.amount AS REAL)) as s FROM transactions t " +
        "WHERE t.projectId = '" + projectId + "'";

    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] !== null) {
      return Number(res[0].values[0][0]) || 0;
    }
    return 0;
  } catch (e) {
    console.error('Error computing current savings:', e && e.message);
    return 0;
  }
}

function computeCurrentSpentSql(db, projectKey, excludeCategoryIds) {
  try {
    const escProject = String(projectKey).replace(/'/g, "''");
    const ids = (Array.isArray(excludeCategoryIds) ? excludeCategoryIds.filter(Boolean) : []).map(id => String(id));
    // base filter: negative amounts and not provisions, and NOT planned transactions
    let q = "SELECT SUM(CAST(-s.amount AS REAL)) as spent FROM ICTransactionSplit s " +
            "LEFT JOIN ICCategory c1 ON s.category = c1.ID " +
            "LEFT JOIN ICTransaction t ON s.\"transaction\" = t.ID " +
            "WHERE s.project = '" + escProject + "' AND CAST(s.amount AS REAL) < 0 " +
            "AND (c1.name IS NULL OR lower(c1.name) NOT LIKE '%provision%') " +
            "AND (t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus')";
    if (ids.length > 0) {
      const inList = ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(',');
      q += " AND (s.category IS NULL OR s.category NOT IN (" + inList + "))";
    } else {
      // fallback: try to exclude categories whose name contains 'virements' or 'epargne'
      q += " AND (c1.name IS NULL OR (lower(c1.name) NOT LIKE '%virements%' AND lower(c1.name) NOT LIKE '%epargne%'))";
    }
    
    const res = db.exec(q);
    if (res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] !== null) {
      return Number(res[0].values[0][0]) || 0;
    }
    return 0;
  } catch (e) {
    console.error('Error computing current spent:', e && e.message);
    return 0;
  }
}

function findBestCandidates(targetName, candidateProjects, limit = 5) {
  const target = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = candidateProjects.map(proj => {
    const candidate = proj.toLowerCase().replace(/[^a-z0-9]/g, '');
    let score = 0;
    
    if (candidate === target) score += 100;
    else if (candidate.includes(target)) score += 50;
    else if (target.includes(candidate)) score += 30;
    else {
      const words = target.split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && candidate.includes(word)) score += 10;
      }
    }
    
    return { project: proj, score };
  });
  
  return candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Routes
router.get('/', async (req, res) => {
  // Check if this is first startup (no database exists)
  if (!fs.existsSync(config.DATA_DB_PATH)) {
    return res.status(500).json({ error: 'data DB missing - first startup required' });
  }
  
  let projects = await loadProjectsFromDataDb();
  if (!projects || projects.length === 0) {
    projects = loadProjects();
  }
  
  // If main database doesn't exist, return projects without calculations
  if (!fs.existsSync(config.DB_PATH)) {
    console.log('Main database not found, returning projects without calculations');
    const out = projects.map(p => ({
      ...p,
      currentSavings: 0,
      currentSpent: 0
    }));
    // ensure projects are sorted by name descending (locale fr)
    out.sort((a,b) => (b.name || '').localeCompare(a.name || '', 'fr', { sensitivity: 'base' }));
    return res.json(out);
  }
  
  const db = await openDb(config.DB_PATH);
  const datadb = await openDb(config.DATA_DB_PATH);
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
        const currentSavings = computeCurrentSavingsSql(db, projectKey, [catIdVirements, catIdEpargne]) + computeCurrentSavingsDataSql(datadb, p.id);
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

router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const SQL = await initSqlJs();
    const db = new SQL.Database(buf);
    
    const { name, startDate, endDate, plannedBudget } = req.body;
    if (!name) return res.status(400).json({ error: 'project name required' });
    
    const escapedName = name.replace(/'/g, "''");
    const escapedStartDate = (startDate || '').replace(/'/g, "''");
    const escapedEndDate = (endDate || '').replace(/'/g, "''");
    const budget = Number(plannedBudget || 0) || 0;
    
    db.run(`INSERT INTO projects (name, startDate, endDate, plannedBudget, archived) VALUES ('${escapedName}', '${escapedStartDate}', '${escapedEndDate}', ${budget}, 0);`);
    
    const idRes = db.exec("SELECT last_insert_rowid() as id");
    let projectId = null;
    if (idRes && idRes[0] && idRes[0].values && idRes[0].values[0]) {
      projectId = idRes[0].values[0][0];
    }

    // Tentative d'initialisation d'un objectif mensuel initial si la table existe et que les infos sont complètes
    try {
      if (startDate && endDate && budget > 0) {
        const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='project_saving_goals'");
        const hasGoalsTable = tableCheck && tableCheck[0] && tableCheck[0].values.length > 0;
        if (hasGoalsTable) {
          const startMonth = String(startDate).slice(0,7);
          const endMonth = String(endDate).slice(0,7);
          if (/^\d{4}-\d{2}$/.test(startMonth) && /^\d{4}-\d{2}$/.test(endMonth)) {
            const todayMonth = new Date().toISOString().slice(0,7);
            // Fonction utilitaire pour index mois
            const monthIndex = (ym) => {
              const [y,m] = ym.split('-').map(Number); return y*12 + (m-1);
            };
            const startIdx = monthIndex(startMonth);
            const endIdx = monthIndex(endMonth);
            const todayIdx = monthIndex(todayMonth);
            if (endIdx >= startIdx) {
              // Calcul de l'épargne déjà réalisée si DB principale dispo
              let saved = 0;
              try {
                if (fs.existsSync(config.DB_PATH)) {
                  const SQLMain = await initSqlJs();
                  const mainBuf = fs.readFileSync(config.DB_PATH);
                  const mainDb = new SQLMain.Database(mainBuf);
                  const escName = escapedName; // name déjà échappé
                  const savingsRes = mainDb.exec(`SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s WHERE s.project='${escName}'`);
                  if (savingsRes && savingsRes[0] && savingsRes[0].values[0] && savingsRes[0].values[0][0] != null) {
                    saved = Number(savingsRes[0].values[0][0]) || 0;
                  }
                  mainDb.close();
                }
              } catch (e2) {
                console.error('Failed to compute initial saved amount', e2 && e2.message);
              }

              // Reste à épargner
              let remaining = Math.max(0, budget - saved);
              // Déterminer mois de début de l'objectif initial: si projet déjà commencé -> mois courant, sinon mois de début du projet
              let goalStartMonth = startMonth;
              if (todayIdx > startIdx && todayIdx <= endIdx) {
                goalStartMonth = todayMonth; // on repart depuis le mois en cours
              } else if (todayIdx > endIdx) {
                // Projet déjà terminé: aucun objectif utile
                remaining = 0;
              }
              const goalStartIdx = monthIndex(goalStartMonth);
              const remainingMonths = (endIdx - goalStartIdx) + 1;
              if (remainingMonths > 0 && remaining > 0) {
                const monthly = Math.ceil(remaining / remainingMonths); // Arrondi à l'euro supérieur
                const startDay = goalStartMonth + '-01';
                db.run(`INSERT INTO project_saving_goals (project_id, amount, start_date, end_date, reason) VALUES (${parseInt(projectId)}, ${monthly}, '${startDay}', NULL, 'initial')`);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to init initial saving goal for project', e && e.message);
    }
    
    const proj = {
      id: String(projectId || Math.random().toString(36).substr(2,9)),
      name,
      startDate: startDate || '',
      endDate: endDate || '',
      plannedBudget: budget,
      currentSavings: 0,
      currentSpent: 0,
      archived: false,
      dbProject: name
    };
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    return res.json({ ok: true, project: proj });
  } catch (e) {
    console.error('failed to create project', e && e.message);
    return res.status(500).json({ error: 'failed to create project' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { archived, plannedBudget, startDate, endDate, name } = req.body;

    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const SQL = await initSqlJs();
    const db = new SQL.Database(buf);

    // Build the update query dynamically based on provided fields
    const updates = [];
    if (archived !== undefined) {
      updates.push(`archived = ${archived ? 1 : 0}`);
    }
    if (plannedBudget !== undefined) {
      updates.push(`plannedBudget = ${Number(plannedBudget) || 0}`);
    }
    if (startDate !== undefined) {
      const escaped = (startDate || '').replace(/'/g, "''");
      updates.push(`startDate = '${escaped}'`);
    }
    if (endDate !== undefined) {
      const escaped = (endDate || '').replace(/'/g, "''");
      updates.push(`endDate = '${escaped}'`);
    }
    if (name !== undefined) {
      const escaped = (name || '').replace(/'/g, "''");
      updates.push(`name = '${escaped}'`);
    }

    if (updates.length === 0) {
      db.close();
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updateQuery = `UPDATE projects SET ${updates.join(', ')} WHERE id = ${parseInt(projectId)}`;
    db.run(updateQuery);

    // Get the updated project
    const selectRes = db.exec(`SELECT * FROM projects WHERE id = ${parseInt(projectId)}`);
    let updatedProject = null;
    if (selectRes && selectRes[0] && selectRes[0].values && selectRes[0].values[0]) {
      const cols = selectRes[0].columns;
      const row = selectRes[0].values[0];
      const proj = {};
      cols.forEach((col, i) => proj[col] = row[i]);
      updatedProject = {
        id: String(proj.id),
        name: proj.name,
        startDate: proj.startDate,
        endDate: proj.endDate,
        plannedBudget: proj.plannedBudget,
        archived: Boolean(proj.archived),
        dbProject: proj.name
      };
    }

    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();

    return res.json({ ok: true, project: updatedProject });
  } catch (e) {
    console.error('Failed to update project:', e && e.message);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const SQL = await initSqlJs();
    const db = new SQL.Database(buf);

    // Delete the project
    const deleteQuery = `DELETE FROM projects WHERE id = ${parseInt(projectId)}`;
    db.run(deleteQuery);

    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();

    return res.json({ ok: true, message: 'Project deleted successfully' });
  } catch (e) {
    console.error('Failed to delete project:', e && e.message);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
