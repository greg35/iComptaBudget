
# Application de Gestion du Budget

Une application web moderne pour la gestion de budget personnel avec suivi de projets et analyse d'épargne mensuelle.

## Fonctionnalités

- **Gestion de Projets** : Création, modification et archivage de projets budgétaires
- **Analyse d'Épargne** : Vue mensuelle détaillée avec ventilation par projet
- **Gestion des Comptes** : Configuration flexible des comptes à inclure/exclure des calculs
- **Synchronisation Dropbox** : Mise à jour automatique des données comptables
- **Interface Moderne** : Interface utilisateur responsive avec thème sombre/clair

## Architecture

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le bundling et le développement
- **Tailwind CSS** pour le styling
- **Radix UI** pour les composants
- **Lucide React** pour les icônes
- **Sonner** pour les notifications

### Backend
- **Node.js** avec Express
- **SQLite** pour la persistance des données
- **sql.js** pour l'accès aux bases de données
- Support des fichiers iCompta (.cdb)

## Installation

1. Cloner le repository
```bash
git clone [url-du-repository]
cd NewiComptaBudget
```

2. Installer les dépendances
```bash
npm install
```

3. Configuration de la base de données
   - Placer votre fichier `Comptes.cdb` (iCompta) à la racine du projet
   - La base de données `iComptaBudgetData.sqlite` sera créée automatiquement

## Développement

### Démarrage en mode développement

```bash
# Frontend et backend ensemble
npm run dev

# Frontend seulement
npm run dev:front

# Backend seulement
npm run dev:back
```

### Structure du projet

```
├── components/           # Composants React
│   ├── ui/              # Composants UI de base
│   ├── ProjectsSidebar.tsx
│   ├── SettingsView.tsx
│   └── MonthlySavingsView.tsx
├── backend/             # Serveur Express
│   └── index.js
├── types/               # Définitions TypeScript
└── styles/             # Styles CSS
```

## Configuration

### URL Dropbox
1. Aller dans Paramètres
2. Configurer l'URL de partage Dropbox
3. Utiliser "Mettre à jour les comptes" pour synchroniser

### Gestion des Comptes
1. Dans Paramètres → Gestion des comptes
2. Cliquer sur "Actualiser la liste" pour charger les comptes
3. Configurer les exclusions avec les cases à cocher
4. Sauvegarder les préférences

## Base de Données

Le projet utilise deux bases de données :

- **Comptes.cdb** : Base iCompta (lecture seule)
- **iComptaBudgetData.sqlite** : Données de l'application (projets, paramètres, préférences)

## API Endpoints

- `GET /api/projects` - Liste des projets
- `POST /api/projects` - Création de projet
- `PUT /api/projects/:id` - Modification de projet
- `GET /api/monthly-savings` - Données d'épargne mensuelle
- `GET /api/account-preferences` - Préférences de comptes
- `POST /api/account-preferences/save-all` - Sauvegarde des préférences

## Déploiement

1. Build de production
```bash
npm run build
```

2. Les fichiers de base de données sont automatiquement exclus via `.gitignore`

## Notes Importantes

- Les fichiers `.cdb` et `.sqlite` sont exclus du versioning
- Assurez-vous d'avoir votre propre fichier `Comptes.cdb` pour le développement
- La base `iComptaBudgetData.sqlite` est créée automatiquement au premier lancement

## License

Ce projet est sous licence privée.