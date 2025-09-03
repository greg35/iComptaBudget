
# iCompta Budget

Une application web moderne pour la gestion de budget personnel avec suivi de projets et analyse d'épargne mensuelle, cette application se base sur la superbe application iCompta https://www.icompta-app.fr/.
Elle me permettra de mieux gérer mon budget pour mes différents projets.

![alt text](https://github.com/greg35/iComptaBudget/blob/main/screenshot/01.Accueil.png?raw=true)
![alt text](https://github.com/greg35/iComptaBudget/blob/main/screenshot/02.DetailProjet.png?raw=true)


## ✨ Fonctionnalités

- **📊 Gestion de Projets** : Création, modification et archivage de projets budgétaires avec calculs automatiques
- **💰 Analyse d'Épargne** : Vue mensuelle détaillée avec ventilation par projet et comptes
- **🏦 Gestion des Comptes** : Configuration flexible des comptes à inclure/exclure des calculs
- **☁️ Synchronisation Dropbox** : Mise à jour automatique des données iCompta depuis Dropbox
- **🎨 Interface Moderne** : Interface utilisateur responsive avec thème sombre/clair
- **🚀 Premier Démarrage** : Assistant de configuration pour la première utilisation
- **📈 Tableau de Bord** : Vue d'ensemble avec graphiques et métriques

## 🏗️ Architecture

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le bundling et le développement rapide
- **Tailwind CSS** pour le styling
- **Radix UI** pour les composants accessibles
- **Recharts** pour les graphiques
- **Sonner** pour les notifications toast
- **Lucide React** pour les icônes

### Backend (Architecture Modulaire)
- **Node.js** avec Express
- **Architecture modulaire** avec séparation des responsabilités :
  ```
  backend/
  ├── index.js                    # Point d'entrée principal
  ├── src/
  │   ├── config/                 # Configuration centralisée
  │   ├── middleware/             # Middleware (CORS, etc.)
  │   ├── routes/                 # Routes modulaires par fonctionnalité
  │   │   ├── projects.js         # Gestion des projets
  │   │   ├── transactions.js     # Transactions et calculs
  │   │   ├── accounts.js         # Gestion des comptes
  │   │   ├── settings.js         # Paramètres et synchronisation
  │   │   ├── accountPreferences.js
  │   │   ├── monthlySavings.js
  │   │   ├── autoMap.js
  │   │   └── splitProjects.js
  │   ├── services/               # Services métier
  │   └── utils/                  # Utilitaires (DB, fichiers)
  ```
- **SQLite** avec sql.js pour l'accès aux données
- **Support iCompta** : Lecture native des fichiers .cdb

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation
```bash
git clone <repository-url>
cd iComptaBudget
npm install
```

### Premier Démarrage
```bash
# Démarrage complet (frontend + backend)
npm run dev:all

# Ou séparément :
npm run dev        # Frontend (port 2112)
npm run dev:back   # Backend (port 2113)
```

L'application sera accessible à `http://localhost:2112`

### Configuration Initiale
1. **Premier lancement** : L'assistant vous guidera pour configurer l'URL Dropbox
2. **Synchronisation** : Les données iCompta seront téléchargées et synchronisées
3. **Prêt !** : L'application est opérationnelle

## 📁 Structure du Projet

```
├── components/                  # Composants React
│   ├── ui/                     # Composants UI de base (Radix)
│   ├── FirstStartupView.tsx    # Assistant premier démarrage
│   ├── HomeView.tsx            # Vue d'accueil avec dashboard
│   ├── ProjectsSidebar.tsx     # Sidebar navigation
│   ├── SettingsView.tsx        # Configuration et synchronisation
│   ├── MonthlySavingsView.tsx  # Analyse épargne mensuelle
│   └── ...
├── backend/                    # Backend modulaire
│   ├── index.js               # Point d'entrée
│   └── src/                   # Code source modulaire
├── types/                     # Types TypeScript
├── utils/                     # Utilitaires frontend
├── styles/                    # Styles CSS globaux
└── Comptes.cdb               # Base iCompta (auto-téléchargée)
```

## 🔧 Configuration

### Synchronisation Dropbox
1. Accéder aux **Paramètres**
2. Configurer l'**URL de partage Dropbox** de votre fichier iCompta
3. Cliquer sur **"Mettre à jour les comptes"**
4. La synchronisation se fait automatiquement

### Gestion des Comptes
1. **Paramètres** → **Gestion des comptes**
2. **"Actualiser la liste"** pour charger tous les comptes iCompta
3. **Configurer les exclusions** avec les cases à cocher
4. **Sauvegarder** les préférences

Les comptes exclus ne seront pas pris en compte dans les calculs de solde.

### Utilisation de iCompta
J'utilise iCompta de la façon suivante : 
5 Catégories principales qui contiennent des sous-catégories :
- **00. Revenus** : Contient toutes les catégories de mes rentrées d'argents
- **01. Needs** : Contient les catégories de dépenses obligatoires par mois (courses alimentaire, crédit immo, assurances, eau, EDF...)
- **02. Wants** : Contient les catégories des dépenses que je pourrais considéré comme facultative si pb financier (cadeaux, sortie, travaux, loisirs, restaurant)
- **99. Projets Financés** : Contient les catégories des dépenses de projets qui ne sont pas du quotidien pour faire ces dépenses j'ai épargné tout au long de l'année (Vacances>Trajet, Vacances>Hebergement...Provisions => J'en reparle plus bas)
- **Hors budget** : Contient toutes les catégories qui ne sont pas de l'argent que je compte (virement interne, note de frais remboursées, avance/remboursement d'argent)

Tous les mois je classifie mes dépenses à la fin du mois je fais Revenus - Needs - Wants -> cela donne le montant que j'ai épargné dans le mois. 
Ce montant je vais le virer sur un compte d'épargne type livret et je vais ensuite splité le crédit sur le compte d'épargne en autant d'opération que d'affectation à des projets. Je mets la catégorie Hors budget > Virements d'épargne et je renseigne le projet. 

![alt text](https://github.com/greg35/iComptaBudget/blob/main/screenshot/TransactionEpargne.png?raw=true)

A la fin du mois je fais également un virement d'un compte d'épargne vers mon compte courant pour équilibrer la catégorie "99. Projets financiers"

![alt text](https://github.com/greg35/iComptaBudget/blob/main/screenshot/TransactionProvision.png?raw=true)

## 🗄️ Base de Données

Le projet utilise deux bases de données SQLite :

- **`Comptes.cdb`** : Base de données iCompta (lecture seule, synchronisée depuis Dropbox)
- **`iComptaBudgetData.sqlite`** : Données de l'application (projets, paramètres, préférences)

## 🔌 API Endpoints

### Projets
- `GET /api/projects` - Liste des projets avec calculs
- `POST /api/projects` - Création de projet
- `PATCH /api/projects/:id` - Modification de projet
- `DELETE /api/projects/:id` - Suppression de projet

### Transactions
- `GET /api/transactions/project-transactions?project=:name` - Transactions d'un projet

### Comptes
- `GET /api/accounts` - Liste des comptes
- `GET /api/accounts?filterType=savings` - Comptes inclus dans l'épargne
- `GET /api/accounts?filterType=checking` - Comptes inclus dans les dépenses

### Configuration
- `GET /api/first-startup` - Vérification premier démarrage
- `POST /api/update-accounts` - Synchronisation Dropbox
- `GET /api/account-preferences` - Préférences de comptes
- `POST /api/account-preferences` - Sauvegarde préférences

### Fonctionnalités Avancées
- `GET /api/monthly-savings` - Données d'épargne mensuelle
- `GET /api/auto-map` - Configuration auto-mapping
- `POST /api/split-projects` - Division de projets

## 🏗️ Développement

### Scripts Disponibles
```bash
npm run dev          # Frontend seul (Vite dev server)
npm run dev:back     # Backend seul
npm run dev:all      # Frontend + Backend en parallèle
npm run build        # Build de production
```

### Architecture Backend
Le backend suit une **architecture modulaire** pour faciliter la maintenance :

- **Routes modulaires** : Chaque fonctionnalité a sa propre route
- **Services** : Logique métier centralisée
- **Configuration centralisée** : Paths et paramètres dans `/src/config/`
- **Utilitaires réutilisables** : Base de données, fichiers, etc.

## 🚀 Déploiement

```bash
# Build de production
npm run build

# Les fichiers sont générés dans ./build/
```

## 📝 Notes Importantes

- ✅ **Fichiers exclus** : `.cdb` et `.sqlite` ne sont pas versionnés
- ✅ **Auto-création** : `iComptaBudgetData.sqlite` est créé automatiquement
- ✅ **Premier démarrage** : Assistant intégré pour la configuration initiale
- ✅ **Synchronisation** : Téléchargement automatique depuis Dropbox
- ✅ **Calculs temps réel** : Montants épargne/dépensé calculés automatiquement

## 🔄 Migration et Refactoring

Cette version inclut un **refactoring complet du backend** :
- Migration d'un fichier monolithique (1300+ lignes) vers une architecture modulaire
- Séparation des responsabilités
- Amélioration de la maintenabilité
- Conservation de toutes les fonctionnalités existantes

## 📄 Licence

Ce projet est sous licence privée.
