#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const action = process.argv[2];

if (!action || !['on', 'off', 'status'].includes(action)) {
  console.log('Usage: node dev-mode.js [on|off|status]');
  console.log('');
  console.log('Commands:');
  console.log('  on     - Active le mode développement (désactive l\'authentification)');
  console.log('  off    - Désactive le mode développement (réactive l\'authentification)');
  console.log('  status - Affiche l\'état actuel du mode développement');
  process.exit(1);
}

// Lire le fichier .env existant ou créer un nouveau
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Fonction pour mettre à jour ou ajouter une variable d'environnement
function updateEnvVariable(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  
  if (regex.test(content)) {
    return content.replace(regex, line);
  } else {
    return content + (content.endsWith('\n') ? '' : '\n') + line + '\n';
  }
}

// Fonction pour obtenir la valeur d'une variable d'environnement
function getEnvVariable(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(regex);
  return match ? match[1] : null;
}

switch (action) {
  case 'on':
    envContent = updateEnvVariable(envContent, 'DEV_MODE', 'true');
    fs.writeFileSync(envPath, envContent);
    console.log('🔓 Mode développement ACTIVÉ');
    console.log('   Les API peuvent maintenant être testées sans authentification');
    console.log('   Redémarrez le serveur pour appliquer les changements');
    break;
    
  case 'off':
    envContent = updateEnvVariable(envContent, 'DEV_MODE', 'false');
    fs.writeFileSync(envPath, envContent);
    console.log('🔒 Mode développement DÉSACTIVÉ');
    console.log('   L\'authentification est maintenant requise pour toutes les API');
    console.log('   Redémarrez le serveur pour appliquer les changements');
    break;
    
  case 'status':
    const devMode = getEnvVariable(envContent, 'DEV_MODE');
    if (devMode === 'true') {
      console.log('🔓 Mode développement: ACTIVÉ');
      console.log('   Les API peuvent être testées sans authentification');
    } else {
      console.log('🔒 Mode développement: DÉSACTIVÉ');
      console.log('   L\'authentification est requise pour toutes les API');
    }
    break;
}
