#!/usr/bin/env node

const { openDb } = require('./src/utils/database.js');

async function checkCategoryStructure() {
    console.log('🔍 Vérification de la structure de la table ICCategory...\n');
    
    try {
        // Ouvrir la base de données principale
        const db = await openDb();
        
        // Vérifier la structure de la table ICCategory
        console.log('1️⃣ Structure de la table ICCategory...');
        const structureQuery = `PRAGMA table_info(ICCategory)`;
        
        const structureResults = db.exec(structureQuery);
        if (structureResults.length > 0 && structureResults[0].values.length > 0) {
            console.log('   📊 Colonnes de la table ICCategory:');
            structureResults[0].values.forEach(row => {
                console.log(`      - ${row[1]} (${row[2]}) - ${row[3] ? 'NOT NULL' : 'NULL'} ${row[4] ? `DEFAULT ${row[4]}` : ''} ${row[5] ? 'PRIMARY KEY' : ''}`);
            });
        } else {
            console.log('   ❌ Table ICCategory non trouvée');
        }
        
        // Afficher quelques enregistrements avec SELECT *
        console.log('\n2️⃣ Premiers enregistrements de ICCategory...');
        const sampleQuery = `SELECT * FROM ICCategory LIMIT 5`;
        
        const sampleResults = db.exec(sampleQuery);
        if (sampleResults.length > 0 && sampleResults[0].values.length > 0) {
            console.log('   📊 Colonnes:', sampleResults[0].columns.join(', '));
            console.log('   📊 Exemples:');
            sampleResults[0].values.forEach((row, index) => {
                console.log(`      ${index + 1}. ${row.join(' | ')}`);
            });
        } else {
            console.log('   ❌ Aucun enregistrement trouvé');
        }
        
        db.close();
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkCategoryStructure();
