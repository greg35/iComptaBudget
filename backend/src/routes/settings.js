const express = require('express');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');
const { downloadFile, extractZip } = require('../utils/fileUtils');
const { syncProjectsFromMainDb } = require('../services/projectService');

const router = express.Router();

// First startup detection endpoint
router.get('/first-startup', async (req, res) => {
  try {
    // Consider not first-startup if our app data DB exists and looks valid
    const dataDbExists = fs.existsSync(config.DATA_DB_PATH);
    let dataDbValid = false;
    if (dataDbExists) {
      try {
        const stat = fs.statSync(config.DATA_DB_PATH);
        if (stat.isFile() && stat.size >= 100) {
          const fd = fs.openSync(config.DATA_DB_PATH, 'r');
          const buf = Buffer.alloc(16);
          fs.readSync(fd, buf, 0, 16, 0);
          fs.closeSync(fd);
          dataDbValid = buf.toString('utf8') === 'SQLite format 3\0';
        }
      } catch {}
    }

    if (dataDbValid) {
      return res.json({ isFirstStartup: false, reason: 'data_database_exists' });
    }

    // If main iCompta database exists, also not first startup
    if (fs.existsSync(config.DB_PATH)) {
      return res.json({ isFirstStartup: false, reason: 'main_database_exists' });
    }

    // Otherwise, we need to bootstrap
    return res.json({ isFirstStartup: true, reason: 'no_database_found' });
  } catch (e) {
    console.error('Error checking first startup:', e);
    // Be conservative: if there is any error checking, assume not first-startup to avoid blocking usage
    return res.json({ isFirstStartup: false, reason: 'check_error_treated_as_not_first_startup' });
  }
});

// Settings endpoints
router.get('/settings', async (req, res) => {
  try {
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
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

router.post('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    
    if (!fs.existsSync(config.DATA_DB_PATH)) return res.status(500).json({ error: 'data DB missing' });
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(config.DATA_DB_PATH);
    const db = new SQL.Database(buf);
    
    // Escape the key and value to prevent SQL injection
    const escapedKey = key.replace(/'/g, "''");
    const escapedValue = (value || '').replace(/'/g, "''");
    
    db.exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('${escapedKey}', '${escapedValue}')`);
    
    const binary = db.export();
    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(binary));
    db.close();
    
    return res.json({ ok: true, key, value });
  } catch (e) {
    console.error('Failed to save setting', e && e.message);
    return res.status(500).json({ error: 'failed to save setting' });
  }
});

// Update accounts endpoint
router.post('/update-accounts', async (req, res) => {
  try {
    // Get Dropbox URL from settings
    const SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
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
    const tempZipPath = path.join(__dirname, '..', '..', 'temp_accounts.zip');
    await downloadFile(directUrl, tempZipPath);
    
    console.log('Fichier téléchargé, décompression en cours...');
    
    // Extract the ZIP file
    const extractedFiles = await extractZip(tempZipPath, path.dirname(tempZipPath));
    
    // Find the .cdb file in extracted files
    const cdbFile = extractedFiles.find(file => file.endsWith('.cdb'));
    if (!cdbFile) {
      // Cleanup
      fs.unlinkSync(tempZipPath);
      extractedFiles.forEach(file => {
        const fullPath = path.join(path.dirname(tempZipPath), path.basename(file));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      });
      return res.status(400).json({ error: 'Aucun fichier .cdb trouvé dans l\'archive ZIP' });
    }
    
    console.log('Fichier .cdb trouvé:', cdbFile);
    
    // Backup existing Comptes.cdb if it exists
    if (fs.existsSync(config.DB_PATH)) {
      const backupPath = config.DB_PATH + '.backup.' + Date.now();
      fs.copyFileSync(config.DB_PATH, backupPath);
      console.log('Sauvegarde créée:', backupPath);
    }
    
    // Move the extracted .cdb file to replace Comptes.cdb
    const extractedCdbPath = path.join(path.dirname(tempZipPath), path.basename(cdbFile));
    fs.copyFileSync(extractedCdbPath, config.DB_PATH);
    
    // Cleanup temporary files
    fs.unlinkSync(tempZipPath);
    extractedFiles.forEach(file => {
      const fullPath = path.join(path.dirname(tempZipPath), path.basename(file));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
    
    console.log('Mise à jour des comptes terminée, synchronisation des projets...');
    
    // Synchronize projects from the updated main database
    const projectCount = await syncProjectsFromMainDb();
    
    console.log('Mise à jour terminée avec succès');
    
    res.json({ 
      success: true, 
      message: `Comptes mis à jour avec succès. ${projectCount} projets synchronisés.`,
      cdbFile: path.basename(cdbFile),
      projectCount: projectCount
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour des comptes:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour des comptes', 
      details: error.message 
    });
  }
});

module.exports = router;
