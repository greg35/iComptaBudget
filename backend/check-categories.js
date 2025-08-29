#!/usr/bin/env node

const { openDb } = require('./src/utils/database.js');

async function checkCategories() {
    console.log('🔍 Recherche de la catégorie "Hors Budget"...\n');
    
    try {
        // Ouvrir la base de données principale
        const db = await openDb();
        
        // Rechercher la catégorie "Hors Budget"
        console.log('1️⃣ Recherche de catégories contenant "Hors" ou "Budget"...');
        const searchQuery = `
            SELECT ID, name, parent 
            FROM ICCategory 
            WHERE name LIKE '%Hors%' OR name LIKE '%Budget%'
            ORDER BY name
        `;
        
        const searchResults = db.exec(searchQuery);
        if (searchResults.length > 0 && searchResults[0].values.length > 0) {
            console.log('   📊 Catégories trouvées:');
            searchResults[0].values.forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}", Parent: ${row[2]}`);
            });
        } else {
            console.log('   ❌ Aucune catégorie trouvée avec "Hors" ou "Budget"');
        }
        
        // Afficher toutes les catégories de niveau 1 (sans parent)
        console.log('\n2️⃣ Catégories de niveau 1 (racines)...');
        const rootQuery = `
            SELECT ID, name 
            FROM ICCategory 
            WHERE parent IS NULL OR parent = ''
            ORDER BY name
        `;
        
        const rootResults = db.exec(rootQuery);
        if (rootResults.length > 0 && rootResults[0].values.length > 0) {
            console.log('   📊 Catégories racines:');
            rootResults[0].values.slice(0, 10).forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}"`);
            });
            if (rootResults[0].values.length > 10) {
                console.log(`      ... et ${rootResults[0].values.length - 10} autres`);
            }
        }
        
        // Rechercher par variation du nom
        console.log('\n3️⃣ Recherche de variations possibles...');
        const variationsQuery = `
            SELECT ID, name, parent 
            FROM ICCategory 
            WHERE name LIKE '%Outside%' 
               OR name LIKE '%External%'
               OR name LIKE '%Excluded%'
               OR name LIKE '%Non%'
               OR name LIKE '%Autre%'
               OR name LIKE '%Transfer%'
               OR name LIKE '%Virement%'
               OR name LIKE '%Épargne%'
               OR name LIKE '%Savings%'
            ORDER BY name
        `;
        
        const variationResults = db.exec(variationsQuery);
        if (variationResults.length > 0 && variationResults[0].values.length > 0) {
            console.log('   📊 Variations trouvées:');
            variationResults[0].values.forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}", Parent: ${row[2]}`);
            });
        } else {
            console.log('   ❌ Aucune variation trouvée');
        }
        
        // Chercher des catégories qui pourraient être des transferts
        console.log('\n4️⃣ Recherche de catégories de transferts...');
        const transferQuery = `
            SELECT ID, name, parent 
            FROM ICCategory 
            WHERE name LIKE '%Transfer%' 
               OR name LIKE '%Virement%'
               OR name LIKE '%Épargne%'
               OR name LIKE '%Savings%'
            ORDER BY name
        `;
        
        const transferResults = db.exec(transferQuery);
        if (transferResults.length > 0 && transferResults[0].values.length > 0) {
            console.log('   📊 Catégories de transferts trouvées:');
            transferResults[0].values.forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}", Parent: ${row[2]}`);
            });
        } else {
            console.log('   ❌ Aucune catégorie de transfert trouvée');
        }
        
        db.close();
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkCategories();
