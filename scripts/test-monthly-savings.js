#!/usr/bin/env node

// Script de test pour vérifier le calcul d'épargne mensuelle avec filtrage des comptes

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function curlApi(url) {
  try {
    const { stdout, stderr } = await execAsync(`curl -s "${url}"`);
    if (stderr) {
      console.error('Curl stderr:', stderr);
      return null;
    }
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Erreur lors de l'appel à ${url}:`, error.message);
    return null;
  }
}

async function testMonthlySavingsCalculation() {
  console.log('🧮 Test du calcul d\'épargne mensuelle avec filtrage des comptes...\n');
  
  try {
    // 1. Tester l'API des préférences de comptes
    console.log('1️⃣ Vérification des préférences de comptes...');
    const prefs = await curlApi('http://127.0.0.1:2113/api/account-preferences');
    if (prefs) {
      console.log(`✅ ${prefs.length} préférences de comptes trouvées`);
      
      const includedInChecking = prefs.filter(p => p.includeChecking === true);
      console.log(`   📊 ${includedInChecking.length} comptes inclus dans les dépenses:`);
      includedInChecking.forEach(p => {
        console.log(`      - ${p.accountName} (ID: ${p.accountId})`);
      });
    } else {
      console.log('❌ Impossible de récupérer les préférences de comptes');
    }
    
    // 2. Tester l'API d'épargne mensuelle
    console.log('\n2️⃣ Test du calcul d\'épargne mensuelle...');
    const savingsData = await curlApi('http://127.0.0.1:2113/api/monthly-savings?months=3');
    if (savingsData && !savingsData.error) {
      console.log(`✅ Données d'épargne calculées pour ${savingsData.length} mois`);
      
      savingsData.forEach(month => {
        console.log(`\n📅 ${month.label} (${month.month}):`);
        console.log(`   💰 Total épargne: ${month.totalSavings.toFixed(2)}€`);
        
        const projects = Object.keys(month.projectBreakdown);
        if (projects.length > 0) {
          console.log(`   📋 Répartition par projet (${projects.length} projets):`);
          projects.forEach(project => {
            const amount = month.projectBreakdown[project];
            console.log(`      - ${project}: ${amount.toFixed(2)}€`);
          });
        } else {
          console.log(`   📋 Aucun projet avec épargne ce mois`);
        }
      });
      
      // Calcul du total global
      const totalGlobal = savingsData.reduce((sum, month) => sum + month.totalSavings, 0);
      console.log(`\n💎 Total épargne sur ${savingsData.length} mois: ${totalGlobal.toFixed(2)}€`);
      
    } else {
      console.log(`❌ Erreur API épargne mensuelle:`, savingsData?.error || 'Réponse invalide');
    }
    
    // 3. Tester l'API des comptes avec filtrage
    console.log('\n3️⃣ Test des comptes filtrés pour les dépenses...');
    const accounts = await curlApi('http://127.0.0.1:2113/api/accounts?filterType=checking');
    if (accounts && !accounts.error) {
      console.log(`✅ ${accounts.length} comptes inclus dans les calculs de dépenses:`);
      accounts.forEach(acc => {
        console.log(`   - ${acc.name} (${acc.type}): ${acc.balance.toFixed(2)}€`);
      });
    } else {
      console.log('❌ Impossible de récupérer les comptes filtrés');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Exécuter le test si appelé directement
if (require.main === module) {
  testMonthlySavingsCalculation();
}

module.exports = { testMonthlySavingsCalculation };
