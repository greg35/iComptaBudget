const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

const router = express.Router();

// Utilitaires
function monthKey(dateStr) {
  if (!dateStr) return null; // YYYY-MM
  return dateStr.slice(0,7);
}

// Liste des objectifs d'un projet
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.json([]);
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(buf);
    const result = db.exec(`SELECT id, project_id, amount, start_date, end_date, created_at, reason
                             FROM project_saving_goals
                             WHERE project_id = ${parseInt(projectId)}
                             ORDER BY start_date DESC, id DESC`);
    const out = [];
    if (result && result[0]) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const obj = {};
        cols.forEach((c,i)=>obj[c]=row[i]);
        out.push({
          id: String(obj.id),
            projectId: String(obj.project_id),
            amount: obj.amount,
            startDate: obj.start_date,
            endDate: obj.end_date || undefined,
            createdAt: obj.created_at,
            reason: obj.reason || undefined
        });
      }
    }
    db.close();
    res.json(out);
  } catch(e) {
    console.error('Failed listing saving goals', e && e.message);
    res.status(500).json({ error: 'failed to list saving goals'});
  }
});

// Objectif courant pour un mois donné (ou actuel si non fourni)
router.get('/project/:projectId/current', async (req, res) => {
  try {
    const { projectId } = req.params;
    const targetMonth = (req.query.month || new Date().toISOString().slice(0,7)) + '-01';
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.json(null);
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(buf);
    // objectif où start_date <= targetMonth AND (end_date IS NULL OR end_date >= targetMonth)
    const q = `SELECT id, project_id, amount, start_date, end_date, created_at, reason
               FROM project_saving_goals
               WHERE project_id = ${parseInt(projectId)}
                 AND start_date <= '${targetMonth}'
                 AND (end_date IS NULL OR end_date >= '${targetMonth}')
               ORDER BY start_date DESC, id DESC LIMIT 1`;
    const result = db.exec(q);
    let goal = null;
    if (result && result[0] && result[0].values[0]) {
      const cols = result[0].columns;
      const row = result[0].values[0];
      const obj = {}; cols.forEach((c,i)=>obj[c]=row[i]);
      goal = {
        id: String(obj.id), projectId: String(obj.project_id), amount: obj.amount,
        startDate: obj.start_date, endDate: obj.end_date || undefined,
        createdAt: obj.created_at, reason: obj.reason || undefined
      };
    }
    db.close();
    res.json(goal);
  } catch(e) {
    console.error('Failed fetching current goal', e && e.message);
    res.status(500).json({ error: 'failed to fetch current goal'});
  }
});

// Impl fonction interne suggestion (réutilisée par POST et fallback GET)
async function buildSuggestion(req, res) {
  try {
    const { projectId } = req.params;
    console.log('[saving-goals] Suggest called for project', projectId, 'method', req.method);
    const todayMonth = new Date().toISOString().slice(0,7);
    if (!fs.existsSync(config.DATA_DB_PATH) || !fs.existsSync(config.DB_PATH)) return res.status(400).json({ error: 'missing db'});
    const SQL = await initSqlJs();
    const dataBuf = fs.readFileSync(config.DATA_DB_PATH);
    const dataDb = new SQL.Database(dataBuf);

    // Récup projet
    const projRes = dataDb.exec(`SELECT id, name, startDate, endDate, plannedBudget FROM projects WHERE id = ${parseInt(projectId)}`);
    if (!projRes || !projRes[0] || !projRes[0].values[0]) {
      dataDb.close();
      return res.status(404).json({ error: 'project not found'});
    }
    const cols = projRes[0].columns; const row = projRes[0].values[0];
    const proj = {}; cols.forEach((c,i)=>proj[c]=row[i]);
    const startMonth = (proj.startDate||'').slice(0,7);
    const endMonth = (proj.endDate||'').slice(0,7);
    const plannedBudget = Number(proj.plannedBudget)||0;
    if (!startMonth || !endMonth || plannedBudget<=0) { dataDb.close(); return res.status(400).json({ error:'project missing dates/budget'}); }

    console.log(`[DEBUG] Project found: id=${proj.id}, name="${proj.name}"`);
    
    // Calcul épargne cumulée réelle via DB principale (plus robuste)
    const mainBuf = fs.readFileSync(config.DB_PATH);
    const mainDb = new SQL.Database(mainBuf);
    function findCategoryId(db, categoryName) {
      try {
        const escaped = categoryName.replace(/'/g, "''");
        const r = db.exec(`SELECT ID FROM ICCategory WHERE Name='${escaped}' COLLATE NOCASE LIMIT 1`);
        if (r && r[0] && r[0].values[0]) return r[0].values[0][0];
      } catch {}
      return null;
    }
    const catIdVirements = findCategoryId(mainDb, "Virements d'épargne") || findCategoryId(mainDb, 'Virements épargne') || findCategoryId(mainDb, 'Virements');
    const catIdEpargne = findCategoryId(mainDb, 'Epargne') || findCategoryId(mainDb, 'Épargne');
    const escProjectName = String(proj.name || '').replace(/'/g, "''");
    let saved = 0;
    let debugInfo = {};
    try {
      let queriesTried = [];
      // Debug: vérifier d'abord si le projet existe dans les transactions
      const debugProjectQ = `SELECT COUNT(*) as count, SUM(CAST(s.amount AS REAL)) as total FROM ICTransactionSplit s WHERE s.project='${escProjectName}'`;
      const debugRes = mainDb.exec(debugProjectQ);
      let projectExists = false;
      let totalAmount = 0;
      if (debugRes && debugRes[0] && debugRes[0].values[0]) {
        projectExists = Number(debugRes[0].values[0][0]) > 0;
        totalAmount = Number(debugRes[0].values[0][1]) || 0;
      }
      
      // 1) Cat IDs si trouvés
      if (catIdVirements || catIdEpargne) {
        const ids = [catIdVirements, catIdEpargne].filter(Boolean).map(id => `'${String(id).replace(/'/g,"''")}'`).join(',');
        const q1 = `SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s WHERE s.project='${escProjectName}' AND s.category IN (${ids}) AND CAST(s.amount AS REAL) > 0`;
        queriesTried.push(q1);
        const r1 = mainDb.exec(q1);
        if (r1 && r1[0] && r1[0].values[0] && r1[0].values[0][0] != null) saved = Number(r1[0].values[0][0]) || 0;
      }
      // 2) Fallback noms si rien trouvé
      if (saved === 0) {
        const q2 = `SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s LEFT JOIN ICCategory c ON s.category=c.ID WHERE s.project='${escProjectName}' AND CAST(s.amount AS REAL) > 0 AND (lower(c.name) LIKE '%epargne%' OR lower(c.name) LIKE '%épargne%' OR lower(c.name) LIKE '%virements d''épargne%')`;
        queriesTried.push(q2);
        const r2 = mainDb.exec(q2);
        if (r2 && r2[0] && r2[0].values[0] && r2[0].values[0][0] != null) saved = Number(r2[0].values[0][0]) || 0;
      }
      // 3) Ultime fallback: considérer tous montants positifs du projet hors provisions/hors budget
      if (saved === 0) {
        const q3 = `SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s LEFT JOIN ICCategory c ON s.category=c.ID WHERE s.project='${escProjectName}' AND CAST(s.amount AS REAL) > 0 AND (c.name IS NULL OR lower(c.name) NOT LIKE '%provision%')`;
        queriesTried.push(q3);
        const r3 = mainDb.exec(q3);
        if (r3 && r3[0] && r3[0].values[0] && r3[0].values[0][0] != null) saved = Number(r3[0].values[0][0]) || 0;
      }
      
      // Log debug complet
      console.log(`[DEBUG] Project "${escProjectName}": exists=${projectExists}, totalAmount=${totalAmount}, savedCalculated=${saved}`);
      console.log(`[DEBUG] Categories found: virements=${catIdVirements}, epargne=${catIdEpargne}`);
      
      debugInfo = { 
        catIdVirements, 
        catIdEpargne, 
        queriesTried, 
        projectExists, 
        totalAmount, 
        escProjectName 
      };
    } catch (e2) {
      console.error('Failed computing saved amount for suggestion', e2 && e2.message);
    }
    mainDb.close();

    // Nombre de mois total et restant (inclusif)
    const totalMonths = ((parseInt(endMonth.slice(0,4))*12+parseInt(endMonth.slice(5,7))) - (parseInt(startMonth.slice(0,4))*12+parseInt(startMonth.slice(5,7)))) + 1;
    const currentMonthIndex = ((parseInt(todayMonth.slice(0,4))*12+parseInt(todayMonth.slice(5,7))) - (parseInt(startMonth.slice(0,4))*12+parseInt(startMonth.slice(5,7)))) + 1;
    const remainingMonths = Math.max(0, totalMonths - currentMonthIndex + 1);
    
    // Intégrer l'épargne manuelle locale (transactions créées par l'application)
    // On additionne seulement les entrées (type='income') qui correspondent à nos allocations manuelles
    // Critères : description commençant par 'VIR Epargne' OU catégorie contenant 'épargne'
    let manualSaved = 0;
    try {
      const manualQ = `SELECT SUM(CAST(amount AS REAL)) as s
        FROM transactions 
        WHERE type='income'
          AND (projectId = ${parseInt(projectId)} OR projectId = '' OR projectId IS NULL)
          AND (
            description LIKE 'VIR Epargne%'
            OR lower(category) LIKE '%épargne%'
            OR lower(category) LIKE '%epargne%'
          )`;
      const manualRes = dataDb.exec(manualQ);
      if (manualRes && manualRes[0] && manualRes[0].values[0] && manualRes[0].values[0][0] != null) {
        manualSaved = Number(manualRes[0].values[0][0]) || 0;
      }
    } catch (e2) {
      console.warn('Failed summing manual allocations for suggestion', e2 && e2.message);
    }
    // Ajouter au montant épargné (évite double comptage car non présent dans la DB principale)
    saved += manualSaved;
  // Reste à épargner = budget prévu - déjà épargné (plafonné à 0 mini)
  if (saved >= plannedBudget - 0.01) saved = plannedBudget; // clamp en cas de dépassement léger
  const remainingBudget = Math.max(0, plannedBudget - saved);
    let suggested = remainingMonths > 0 ? Math.ceil(remainingBudget / remainingMonths) : Math.ceil(remainingBudget);
    if (remainingBudget <= 0.01) {
      suggested = 0;
    }

    // Récup objectif courant pour info
    const curRes = dataDb.exec(`SELECT amount FROM project_saving_goals WHERE project_id=${parseInt(projectId)} AND start_date <= '${todayMonth}-01' AND (end_date IS NULL OR end_date >= '${todayMonth}-01') ORDER BY start_date DESC, id DESC LIMIT 1`);
    let currentAmount = null;
    if (curRes && curRes[0] && curRes[0].values[0]) currentAmount = Number(curRes[0].values[0][0])||0;
    dataDb.close();

    // Calcul attendu à ce stade (objectif linéaire de base)
    const expectedSavedBaseline = (plannedBudget / totalMonths) * currentMonthIndex;
    const performanceGap = saved - expectedSavedBaseline; // positif = avance
    let status;
  if (remainingBudget <= 0.01) {
      status = 'completed';
    } else if (performanceGap > (currentAmount || suggested) * 0.75) status = 'ahead';
    else if (performanceGap < -(currentAmount || suggested) * 0.75) status = 'behind';
    else status = 'on_track';

  const payload = {
      projectId: String(projectId),
      currentGoal: currentAmount,
      suggestedGoal: suggested,
      remainingBudget,
      remainingMonths,
      totalMonths,
      savedToDate: saved,
  manualSaved,
      expectedSavedBaseline,
      performanceGap,
      status
  };
  if (req.query.debug === 'true') payload.debug = debugInfo;
    res.json(payload);
  } catch(e) {
    console.error('Failed suggesting goal', e && e.message);
    res.status(500).json({ error: 'failed to suggest goal'});
  }
}

// Suggestion d'un nouvel objectif en fonction de l'avancement (méthode officielle POST)
router.post('/project/:projectId/suggest', buildSuggestion);

// Fallback GET pour tests navigateurs (retourne même contenu) + note d'usage
router.get('/project/:projectId/suggest', (req, res) => {
  // Permettre debug simple depuis navigateur; réutilise la même fonction
  buildSuggestion(req, res);
});

// Création ou mise à jour d'un objectif d'épargne
router.post('/', async (req, res) => {
  try {
    const { projectId, amount, startDate, reason } = req.body;
    
    if (!projectId || amount === undefined || !startDate) {
      return res.status(400).json({ error: 'projectId, amount and startDate are required' });
    }
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Data database not found' });
    }
    
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(buf);
    
    // Fermer l'objectif actuel (s'il existe) avant d'en créer un nouveau
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    const prevLastDay = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(prevMonth.getDate()).padStart(2, '0')}`;
    
    // Fermer les objectifs existants qui n'ont pas de date de fin
    db.run(`UPDATE project_saving_goals SET end_date='${prevLastDay}' 
            WHERE project_id=${parseInt(projectId)} AND end_date IS NULL`);
    
    // Créer le nouvel objectif
    const reasonText = reason || 'Modification manuelle';
    db.run(`INSERT INTO project_saving_goals (project_id, amount, start_date, reason)
            VALUES (${parseInt(projectId)}, ${parseFloat(amount)}, '${startDate}', '${reasonText.replace(/'/g,"''")}')`);
    
    const idRes = db.exec('SELECT last_insert_rowid()');
    const newId = idRes && idRes[0] && idRes[0].values[0] ? idRes[0].values[0][0] : null;
    
    // Sauvegarder les changements
    const data = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(data));
    db.close();
    
    res.json({
      success: true,
      id: String(newId),
      projectId: String(projectId),
      amount: parseFloat(amount),
      startDate,
      reason: reasonText
    });
  } catch (e) {
    console.error('Failed to create saving goal', e && e.message);
    res.status(500).json({ error: 'failed to create saving goal' });
  }
});

// Acceptation d'une suggestion -> clôture objectif courant + insertion nouveau
router.post('/project/:projectId/accept', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { newAmount, reason } = req.body;
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(400).json({ error: 'missing data DB'});
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(buf);
    const today = new Date();
    const monthKeyStr = today.toISOString().slice(0,7);
    const firstOfMonth = monthKeyStr + '-01';
    // Clore l'objectif courant (end_date = dernier jour mois précédent)
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth(), 0); // day 0 => last day previous month
    const prevLastDay = prevMonthDate.toISOString().slice(0,10);
    db.run(`UPDATE project_saving_goals SET end_date='${prevLastDay}'
            WHERE project_id=${parseInt(projectId)}
              AND end_date IS NULL`);
    // Insérer nouveau
    const amt = Math.ceil(Number(newAmount)||0);
    db.run(`INSERT INTO project_saving_goals (project_id, amount, start_date, end_date, reason)
            VALUES (${parseInt(projectId)}, ${amt}, '${firstOfMonth}', NULL, '${(reason||'adjustment').replace(/'/g,"''")}')`);
    const idRes = db.exec('SELECT last_insert_rowid()');
    const newId = idRes && idRes[0] && idRes[0].values[0] ? String(idRes[0].values[0][0]) : '';
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    res.json({ ok: true, goal: { id: newId, projectId: String(projectId), amount: amt, startDate: firstOfMonth, endDate: undefined, reason: reason||'adjustment' } });
  } catch(e) {
    console.error('Failed accepting new goal', e && e.message);
    res.status(500).json({ error: 'failed to accept new goal'});
  }
});

// Performance d'un mois: objectif historique + épargne réelle du mois
// GET /api/saving-goals/project/:projectId/month/:month (month = YYYY-MM)
router.get('/project/:projectId/month/:month', async (req, res) => {
  try {
    const { projectId, month } = req.params;
    const monthKey = month; // attendu YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return res.status(400).json({ error: 'invalid month format' });
    if (!fs.existsSync(config.DATA_DB_PATH) || !fs.existsSync(config.DB_PATH)) return res.status(400).json({ error: 'missing db'});
    const SQL = await initSqlJs();

    // Charger DB data pour récupérer projet + objectif
    const dataBuf = fs.readFileSync(config.DATA_DB_PATH);
    const dataDb = new SQL.Database(dataBuf);
    const projRes = dataDb.exec(`SELECT id, name FROM projects WHERE id = ${parseInt(projectId)}`);
    if (!projRes || !projRes[0] || !projRes[0].values[0]) {
      dataDb.close();
      return res.status(404).json({ error: 'project not found'});
    }
    const pCols = projRes[0].columns; const pRow = projRes[0].values[0];
    const proj = {}; pCols.forEach((c,i)=>proj[c]=pRow[i]);

    const firstOfMonth = monthKey + '-01';
    const goalRes = dataDb.exec(`SELECT amount FROM project_saving_goals
                                  WHERE project_id=${parseInt(projectId)}
                                    AND start_date <= '${firstOfMonth}'
                                    AND (end_date IS NULL OR end_date >= '${firstOfMonth}')
                                  ORDER BY start_date DESC, id DESC LIMIT 1`);
    let goalAmount = null;
    if (goalRes && goalRes[0] && goalRes[0].values[0]) goalAmount = Number(goalRes[0].values[0][0]) || 0;
    dataDb.close();

    // Charger DB principale pour calcul épargne réelle du mois
    const mainBuf = fs.readFileSync(config.DB_PATH);
    const mainDb = new SQL.Database(mainBuf);
    // Tenter de détecter les catégories d'épargne (IDs) sinon fallback sur noms
    function findCategoryId(db, categoryName) {
      try {
        const escaped = categoryName.replace(/'/g, "''");
        const r = db.exec(`SELECT ID FROM ICCategory WHERE Name='${escaped}' LIMIT 1`);
        if (r && r[0] && r[0].values[0]) return r[0].values[0][0];
      } catch {}
      return null;
    }
    const catIdVirements = findCategoryId(mainDb, "Virements d'épargne");
    const catIdEpargne = findCategoryId(mainDb, 'Epargne');
    const escProjectName = String(proj.name).replace(/'/g, "''");
    let savingsQuery;
    if (catIdVirements || catIdEpargne) {
      const ids = [catIdVirements, catIdEpargne].filter(Boolean).map(id => `'${String(id).replace(/'/g,"''")}'`).join(',');
      savingsQuery = `SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s
                       LEFT JOIN ICTransaction t ON s."transaction" = t.ID
                       WHERE s.project='${escProjectName}'
                         AND s.category IN (${ids})
                         AND strftime('%Y-%m', t.date)='${monthKey}'`;
    } else {
      savingsQuery = `SELECT SUM(CAST(s.amount AS REAL)) FROM ICTransactionSplit s
                       LEFT JOIN ICTransaction t ON s."transaction" = t.ID
                       LEFT JOIN ICCategory c ON s.category = c.ID
                       WHERE s.project='${escProjectName}'
                         AND (lower(c.name) LIKE '%virements d''épargne%' OR lower(c.name)='epargne')
                         AND strftime('%Y-%m', t.date)='${monthKey}'`;
    }
    let actual = 0;
    try {
      const actRes = mainDb.exec(savingsQuery);
      if (actRes && actRes[0] && actRes[0].values[0] && actRes[0].values[0][0] != null) {
        actual = Number(actRes[0].values[0][0]) || 0;
      }
    } catch (e) {
      console.error('Error computing monthly actual savings', e && e.message);
    }
    mainDb.close();

    let delta = null; let status = 'no_goal';
    if (goalAmount !== null) {
      delta = actual - goalAmount;
      const tolerance = goalAmount * 0.05; // ±5%
      if (delta > tolerance) status = 'over';
      else if (delta < -tolerance) status = 'under';
      else status = 'on_track';
    }

    res.json({
      projectId: String(projectId),
      month: monthKey,
      goal: goalAmount,
      actualSavings: actual,
      delta,
      status
    });
  } catch (e) {
    console.error('Failed monthly performance endpoint', e && e.message);
    res.status(500).json({ error: 'failed to compute monthly performance'});
  }
});

module.exports = router;