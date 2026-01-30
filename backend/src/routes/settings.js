const express = require('express');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const multer = require('multer');
const config = require('../config');
const { downloadFile, extractZip } = require('../utils/fileUtils');
const { syncProjectsFromMainDb } = require('../services/projectService');

const router = express.Router();

// Ensure backup directory exists
function ensureBackupDir() {
  try {
    if (!fs.existsSync(config.BACKUP_DIR)) {
      console.log('Creating backup directory:', config.BACKUP_DIR);
      fs.mkdirSync(config.BACKUP_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Error ensuring backup directory:', error);
    throw error;
  }
}

// Configure Multer for backup imports
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      ensureBackupDir();
      cb(null, config.BACKUP_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // Keep original filename but prevent overwriting existing files?
    // For now, let's prepend a timestamp if it exists, or just keep it simple.
    // Let's use the original name.
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only sqlite files or similar if needed.
    // For now, accepting everything or check extension
    if (file.originalname.endsWith('.sqlite') || file.originalname.endsWith('.db') || file.originalname.endsWith('.cdb')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .sqlite, .db, .cdb files are allowed.'));
    }
  }
});

// First startup detection endpoint
router.get('/first-startup', async (req, res) => {
  try {
    if (fs.existsSync(config.DATA_DB_PATH)) {
      try {
        const SQL = await initSqlJs();
        const filebuffer = fs.readFileSync(config.DATA_DB_PATH);
        const db = new SQL.Database(filebuffer);

        // Check if users exist
        let userCount = 0;
        try {
          const result = db.exec("SELECT COUNT(*) FROM users");
          if (result && result[0] && result[0].values) {
            userCount = result[0].values[0][0];
          }
        } catch (e) {
          // Table might not exist yet if migration failed, assume 0
        }

        // Check if dropbox_url is configured
        let hasDropbox = false;
        try {
          const result = db.exec("SELECT value FROM settings WHERE key = 'dropbox_url'");
          if (result && result[0] && result[0].values && result[0].values.length > 0) {
            hasDropbox = !!result[0].values[0][0];
          }
        } catch (e) {
          // Table might not exist
        }

        db.close();

        // Consider it first startup if NO users AND NO dropbox configured
        if (userCount === 0 && !hasDropbox) {
          return res.json({ isFirstStartup: true, reason: 'no_users_and_no_dropbox' });
        }
        
        return res.json({ isFirstStartup: false, reason: 'app_initialized' });

      } catch (e) {
        console.error('Error reading DB for first-startup check:', e);
        // If DB exists but is unreadable, might be corrupted, let's say not first startup to avoid loop? 
        // Or true to allow re-init? Let's say true to allow restore.
        return res.json({ isFirstStartup: true, reason: 'db_unreadable' });
      }
    }

    // If main iCompta database exists, also not first startup (legacy check, but we prioritize app DB now)
    if (fs.existsSync(config.DB_PATH)) {
       // If we have the CDB file but no Data DB (or empty), we might still want to configure?
       // But ensureDataDbExists would have populated it.
       // Let's stick to the DB content check above.
    }

    // Otherwise, we need to bootstrap
    return res.json({ isFirstStartup: true, reason: 'no_database_found' });
  } catch (e) {
    console.error('Error checking first startup:', e);
    return res.json({ isFirstStartup: false, reason: 'check_error' });
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

// Backup endpoints
// Create backup
router.post('/settings/backup', async (req, res) => {
  try {
    ensureBackupDir();
    
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sqlite`;
    const backupPath = path.join(config.BACKUP_DIR, filename);
    
    fs.copyFileSync(config.DATA_DB_PATH, backupPath);
    
    const stats = fs.statSync(backupPath);
    
    res.json({ 
      success: true, 
      backup: {
        filename,
        path: backupPath,
        size: stats.size,
        createdAt: stats.birthtime
      }
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Import backup
router.post('/settings/import-backup', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({ 
      success: true, 
      message: 'Backup imported successfully',
      file: {
        filename: req.file.filename,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Error importing backup:', error);
    res.status(500).json({ error: error.message || 'Failed to import backup' });
  }
});

// List backups
router.get('/settings/backups', async (req, res) => {
  try {
    ensureBackupDir();
    
    const files = fs.readdirSync(config.BACKUP_DIR);
    const backups = files
      .filter(file => file.endsWith('.sqlite'))
      .map(file => {
        const filePath = path.join(config.BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
      
    res.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Restore backup
router.post('/settings/restore', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const backupPath = path.join(config.BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Create a safety backup before restoring
    if (fs.existsSync(config.DATA_DB_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safetyBackupPath = path.join(config.BACKUP_DIR, `pre-restore-${timestamp}.sqlite`);
      fs.copyFileSync(config.DATA_DB_PATH, safetyBackupPath);
    }
    
    // Restore
    fs.copyFileSync(backupPath, config.DATA_DB_PATH);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Delete backup
router.delete('/settings/backup/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(config.BACKUP_DIR, filename);
    
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Download backup
router.get('/settings/backup/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(config.BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(backupPath, filename);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

module.exports = router;
