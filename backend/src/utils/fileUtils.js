const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const yauzl = require('yauzl');
const { promisify } = require('util');

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
        fs.unlink(destination, () => {}); // Delete the file async
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to extract ZIP file
function extractZip(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    const extractedFiles = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }
            
            const outputPath = path.join(extractTo, path.basename(entry.fileName));
            const writeStream = fs.createWriteStream(outputPath);
            
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              extractedFiles.push(entry.fileName);
              zipfile.readEntry();
            });
            
            writeStream.on('error', (err) => {
              reject(err);
            });
          });
        }
      });
      
      zipfile.on('end', () => {
        resolve(extractedFiles);
      });
      
      zipfile.on('error', (err) => {
        reject(err);
      });
    });
  });
}

module.exports = {
  downloadFile,
  extractZip
};
