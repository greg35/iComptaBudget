# Configuration de l'Application de Gestion du Budget

## Prérequis

1. **Fichier iCompta** : Vous devez avoir un fichier `Comptes.cdb` exporté depuis iCompta
2. **Node.js** : Version 16 ou supérieure
3. **Dropbox** (optionnel) : Pour la synchronisation automatique des données

## Configuration Initiale

### 1. Base de Données iCompta

Placez votre fichier `Comptes.cdb` à la racine du projet :
```
NewiComptaBudget/
├── Comptes.cdb          # ← Votre fichier iCompta ici
├── package.json
└── ...
```

### 2. Premier Démarrage

```bash
npm install
npm run dev
```

L'application créera automatiquement :
- `iComptaBudgetData.sqlite` : Base de données des préférences
- Structure des tables nécessaires

### 3. Configuration des Paramètres

1. **URL Dropbox** (optionnel)
   - Allez dans Paramètres
   - Entrez l'URL de partage Dropbox de votre fichier ZIP iCompta
   - Format : `https://www.dropbox.com/s/[key]/Comptes.zip?dl=0`

2. **Gestion des Comptes**
   - Dans Paramètres → Gestion des comptes
   - Cliquez "Actualiser la liste" pour charger vos comptes
   - Cochez "Exclure" pour les comptes à ignorer dans les calculs d'épargne
   - Cliquez "Sauvegarder" pour enregistrer vos préférences

### 4. Structure des Données Attendue

L'application s'attend à trouver dans votre base iCompta :

#### Tables principales :
- `comptes` : Liste des comptes
- `ICCategory` : Catégories de transactions
- `ICTransaction` : Transactions
- `ICTransactionSplit` : Détails des transactions

#### Champs requis :
- `comptes.id` et `comptes.compteNom`
- `ICTransactionSplit.project` : Nom du projet (optionnel)
- `ICTransactionSplit.amount` : Montant de la transaction
- `ICTransaction.date` : Date de la transaction

## Fonctionnalités Avancées

### Synchronisation Dropbox

1. Exportez votre base iCompta en ZIP
2. Uploadez sur Dropbox et obtenez le lien de partage
3. Configurez l'URL dans l'application
4. Utilisez "Mettre à jour les comptes" pour synchroniser

### Filtrage des Catégories

L'application exclut automatiquement :
- Catégories contenant "Hors Budget"
- Catégories contenant "99. Projets Financés"
- Ces filtres peuvent être modifiés dans le code backend

### Calculs d'Épargne

- Seuls les comptes non-exclus sont pris en compte
- Les montants négatifs sont ignorés (dépenses)
- Ventilation possible par projet sur 3, 6 ou 12 mois

## Dépannage

### Base de données non trouvée
- Vérifiez que `Comptes.cdb` est bien à la racine
- Redémarrez le serveur backend

### Comptes non visibles
- Utilisez "Actualiser la liste" dans les paramètres
- Vérifiez la structure de votre base iCompta

### Calculs incorrects
- Vérifiez les exclusions de comptes
- Contrôlez les filtres de catégories
- Consultez les logs backend pour les erreurs SQL

