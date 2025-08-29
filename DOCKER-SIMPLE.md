# Docker - iComptaBudget

Configuration Docker simplifiée pour iComptaBudget avec serveur unifié.

## 🎯 Architecture

- **Serveur unifié** : Un seul port exposé (3000) qui sert le frontend et l'API
- **Backend intégré** : L'API backend est accessible via `/api/*` mais non exposée directement
- **Sécurité** : Seul le port frontend est accessible de l'extérieur

## 🚀 Démarrage rapide

### Option 1 : Script simple
```bash
./start.sh
```

### Option 2 : Script avec choix
```bash
./deploy.sh
# Choisir entre code local ou GitHub
```

### Option 3 : Manuel
```bash
# Code local
docker-compose up --build -d

# Depuis GitHub
docker-compose -f docker-compose.github.yml up --build -d
```

## 🌍 Accès à l'application

- **Frontend** : http://localhost:3000
- **API** : http://localhost:3000/api/health (test)
- **Backend** : Non exposé directement (seulement via /api/*)

## 📁 Fichiers Docker

- `Dockerfile` - Image multi-stage avec serveur unifié
- `docker-compose.yml` - Déploiement local
- `docker-compose.github.yml` - Déploiement depuis GitHub
- `start.sh` - Démarrage simple
- `stop.sh` - Arrêt simple
- `deploy.sh` - Démarrage avec choix de source

## 🔧 Configuration

### Variables d'environnement (.env)
```bash
NODE_ENV=production
FRONTEND_PORT=3000
TZ=Europe/Paris
```

### Volumes
- `./data:/app/data` - Données de l'application
- `./logs:/app/logs` - Fichiers de logs
- `./Comptes.cdb:/app/Comptes.cdb:ro` - Base iCompta (lecture seule)
- `./iComptaBudgetData.sqlite:/app/iComptaBudgetData.sqlite` - Base application

## 📋 Commandes utiles

```bash
# Démarrage
./start.sh

# Arrêt
./stop.sh

# Voir les logs
docker-compose logs -f

# Redémarrer
docker-compose restart

# Nettoyer
docker-compose down
docker system prune

# Test de santé
curl http://localhost:3000/api/health
```

## 🏗️ Construction de l'image

Le Dockerfile utilise un build multi-stage :
1. **deps** - Installation des dépendances
2. **builder** - Build du frontend avec Vite
3. **runner** - Serveur de production unifié

## 🔒 Sécurité

- Utilisateur non-root dans le conteneur
- Port backend (4000) non exposé
- Fichier iCompta en lecture seule
- Variables d'environnement sécurisées

## 🐛 Dépannage

### Port déjà utilisé
```bash
# Changer le port dans .env
FRONTEND_PORT=3001
```

### Logs d'erreur
```bash
docker-compose logs icomptabudget
```

### Reconstruction complète
```bash
docker-compose down
docker system prune -f
./start.sh
```
