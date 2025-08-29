# 🐳 Guide Docker pour iComptaBudget

Ce guide vous explique comment déployer iComptaBudget avec Docker et Docker Compose.

## 🚀 Démarrage Rapide

### Prérequis
- Docker et Docker Compose installés
- Port 2112 disponible

### Étapes
1. **Cloner le projet**
   ```bash
   git clone https://github.com/greg35/iComptaBudget.git
   cd iComptaBudget
   ```

2. **Configuration (optionnel)**
   ```bash
   cp .env.example .env
   # Éditer .env selon vos besoins
   ```

3. **Démarrer le service**
   ```bash
   # Option 1: Script automatique avec choix
   ./deploy.sh
   
   # Option 2: Script simple
   ./start.sh
   
   # Option 3: Docker Compose direct
   docker compose up -d --build
   ```

4. **Accès à l'application**
   - Interface web : http://localhost:2112
   - API Health check : http://localhost:2112/api/health

## 📁 Fichiers Docker

### docker-compose.yml
Configuration principale pour déploiement local avec le code du répertoire courant.

### docker-compose.github.yml  
Configuration pour déploiement direct depuis GitHub (dernière version).

### docker-compose.simple.yml
Configuration simplifiée pour démarrage rapide sans fichier .env.

### Dockerfile
Image multi-stage optimisée pour la production.

## ⚙️ Configuration

### Variables d'environnement (.env)
```bash
NODE_ENV=production
FRONTEND_PORT=2112        # Port d'exposition
TZ=Europe/Paris          # Timezone
```

### Volumes montés
- `./data` → `/app/data` : Données de l'application
- `./logs` → `/app/logs` : Fichiers de logs  
- `./Comptes.cdb` → `/app/Comptes.cdb` : Base iCompta (lecture seule)
- `./iComptaBudgetData.sqlite` → `/app/iComptaBudgetData.sqlite` : Base application

## 🔧 Commandes Utiles

### Gestion du service
```bash
# Démarrer
./start.sh
# ou
docker compose up -d --build

# Arrêter  
./stop.sh
# ou
docker compose down

# Redémarrer
docker compose restart

# Voir les logs
docker compose logs -f

# Statut des conteneurs
docker compose ps
```

### Maintenance
```bash
# Reconstruction complète
docker compose down
docker compose up --build -d

# Nettoyer les images et volumes inutilisés
docker system prune -f

# Accéder au conteneur
docker compose exec icomptabudget sh
```

### Health check
```bash
# Test de santé de l'API
curl http://localhost:2112/api/health

# Logs du conteneur
docker compose logs icomptabudget
```

## 🗂️ Structure des Données

### Première installation
Si `Comptes.cdb` n'existe pas :
- L'application démarre quand même
- L'assistant de configuration vous guide pour configurer Dropbox
- Les données seront synchronisées automatiquement

### Données persistantes
- `data/` : Base de données SQLite de l'application
- `logs/` : Fichiers de logs
- `iComptaBudgetData.sqlite` : Configuration et projets

## 🐛 Dépannage

### Port déjà utilisé
```bash
# Changer le port dans .env
FRONTEND_PORT=3001
```

### Problème de permissions
```bash
# Donner les permissions aux répertoires
sudo chown -R $USER:$USER data logs
```

### Reconstruction après erreur
```bash
# Nettoyer et reconstruire
docker compose down
docker system prune -f
docker compose up --build -d
```

### Logs d'erreur
```bash
# Voir les logs détaillés
docker compose logs icomptabudget

# Logs en temps réel
docker compose logs -f icomptabudget
```

## 🔒 Sécurité

- ✅ Utilisateur non-root dans le conteneur
- ✅ Port backend (2113) non exposé
- ✅ Fichier iCompta en lecture seule
- ✅ Health check intégré
- ✅ Restart automatique sauf arrêt manuel

## 📋 Architecture

```
┌─────────────────────────────────────┐
│           Frontend (React)          │
│         Port 2112 (exposé)          │
├─────────────────────────────────────┤
│           Backend (Node.js)         │
│         Port interne seulement      │
├─────────────────────────────────────┤
│         Serveur unifié              │
│    (Sert frontend + API /api/*)     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│            Volumes                  │
│  • data/ (SQLite app)              │
│  • logs/ (Fichiers de log)         │
│  • Comptes.cdb (iCompta readonly)   │
└─────────────────────────────────────┘
```

## 📖 Liens Utiles

- [README principal](README.md)
- [Guide de configuration](CONFIGURATION.md)
- [Documentation Docker simple](DOCKER-SIMPLE.md)