#!/usr/bin/env node

const fs = require('fs');
const initSqlJs = require('sql.js');

async function checkCategories() {
    console.log('🔍 Recherche de la catégorie "Hors Budget"...\n');
    
    try {
        // Initialiser sql.js
        const SQL = await initSqlJs();
        
        // Ouvrir la base de données Comptes.cdb
        const dbPath = '/Users/greg/Documents/iComptaBudget/Comptes.cdb';
        if (!fs.existsSync(dbPath)) {
            console.error('❌ Base de données non trouvée:', dbPath);
            return;
        }
        
        const filebuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(filebuffer);
        
        // Rechercher la catégorie "Hors Budget"
        console.log('1️⃣ Recherche de catégories contenant "Hors" ou "Budget"...');
        const searchQuery = `
            SELECT categoryId, categoryName, parent_categoryId 
            FROM ICCategory 
            WHERE categoryName LIKE '%Hors%' OR categoryName LIKE '%Budget%'
            ORDER BY categoryName
        `;
        
        const searchResults = db.exec(searchQuery);
        if (searchResults.length > 0) {
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
            SELECT categoryId, categoryName 
            FROM ICCategory 
            WHERE parent_categoryId IS NULL 
            ORDER BY categoryName
        `;
        
        const rootResults = db.exec(rootQuery);
        if (rootResults.length > 0) {
            console.log('   📊 Catégories racines:');
            rootResults[0].values.forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}"`);
            });
        }
        
        // Rechercher par variation du nom
        console.log('\n3️⃣ Recherche de variations possibles...');
        const variationsQuery = `
            SELECT categoryId, categoryName, parent_categoryId 
            FROM ICCategory 
            WHERE categoryName LIKE '%Outside%' 
               OR categoryName LIKE '%External%'
               OR categoryName LIKE '%Excluded%'
               OR categoryName LIKE '%Non%'
               OR categoryName LIKE '%Autre%'
            ORDER BY categoryName
        `;
        
        const variationResults = db.exec(variationsQuery);
        if (variationResults.length > 0) {
            console.log('   📊 Variations trouvées:');
            variationResults[0].values.forEach(row => {
                console.log(`      - ID: ${row[0]}, Nom: "${row[1]}", Parent: ${row[2]}`);
            });
        } else {
            console.log('   ❌ Aucune variation trouvée');
        }
        
        db.close();
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkCategories();
