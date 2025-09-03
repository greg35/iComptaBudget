# Configuration des Bases de Données

Ce document explique la configuration des chemins de base de données pour iComptaBudget.

## 📁 Structure des données

Depuis la version 1.4.2, toutes les bases de données sont stockées dans le répertoire `/data` :

```
iComptaBudget/
├── data/
│   ├── Comptes.cdb              # Base principale iCompta
│   └── iComptaBudgetData.sqlite # Données utilisateur (projets, allocations, etc.)
├── backend/
├── components/
└── ...
```

## 🐳 Configuration Docker

### Variables d'environnement

Les chemins de base de données sont configurables via les variables d'environnement :

```bash
# Chemin vers la base de données principale iCompta
DB_PATH=/app/data/Comptes.cdb

# Chemin vers la base de données des données utilisateur  
DATA_DB_PATH=/app/data/iComptaBudgetData.sqlite
```

### docker-compose.yml

```yaml
services:
  icomptabudget:
    image: ghcr.io/greg35/icomptabudget:latest
    volumes:
      - /docker/icomptabudget/data:/app/data
    environment:
      - DB_PATH=/app/data/Comptes.cdb
      - DATA_DB_PATH=/app/data/iComptaBudgetData.sqlite
```

## 🔄 Migration depuis les versions précédentes

Si vous migrez depuis une version antérieure où les fichiers étaient à d'autres emplacements :

### Automatique
```bash
# Utiliser le script de migration
./scripts/migrate-to-data.sh
```

### Manuel
```bash
# Créer le répertoire
mkdir -p data

# Déplacer les fichiers
mv Comptes.cdb data/
mv backend/iComptaBudgetData.sqlite data/  # si applicable
```

## 💾 Sauvegarde

Pour sauvegarder vos données, il suffit de sauvegarder le répertoire `/data` :

```bash
# Sauvegarde locale
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Sauvegarde avec Docker
docker run --rm -v /docker/icomptabudget/data:/data -v $(pwd):/backup \
  alpine tar -czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 🔒 Sécurité

- **Permissions** : Les fichiers de base de données ont des permissions restrictives (600)
- **Séparation** : Code et données sont complètement séparés
- **Volume Docker** : Données persistantes même lors des mises à jour du conteneur
- **Gitignore** : Le répertoire `/data` est exclu du contrôle de version

## 🛠️ Dépannage

### Erreur "ENOENT: no such file or directory"

1. Vérifiez que les fichiers existent dans `/data` :
   ```bash
   ls -la data/
   ```

2. Vérifiez les permissions :
   ```bash
   chmod 600 data/*.cdb data/*.sqlite
   ```

3. Vérifiez les variables d'environnement :
   ```bash
   echo $DB_PATH
   echo $DATA_DB_PATH
   ```

### Le serveur ne trouve pas les bases de données

Assurez-vous de démarrer le serveur depuis la **racine du projet**, pas depuis `/backend` :

```bash
# ✅ Correct
cd /path/to/iComptaBudget
node backend/index.js

# ❌ Incorrect
cd /path/to/iComptaBudget/backend
node index.js
```

## 📝 Configuration locale vs Docker

### Développement local
```bash
# Variables d'environnement (optionnel)
export DB_PATH="./data/Comptes.cdb"
export DATA_DB_PATH="./data/iComptaBudgetData.sqlite"

# Démarrage
node backend/index.js
```

### Production Docker
Les chemins sont automatiquement configurés via le docker-compose.yml avec les volumes montés.
