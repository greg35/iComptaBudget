# 🐳 Guide de Démarrage Rapide - Docker Compose

## Résumé
Ce repository contient maintenant un setup Docker Compose complet pour déployer iComptaBudget facilement.

## 🚀 Démarrage en 3 étapes

1. **Cloner et configurer**
   ```bash
   git clone https://github.com/greg35/iComptaBudget.git
   cd iComptaBudget
   cp .env.example .env  # Optionnel, des valeurs par défaut existent
   ```

2. **Démarrer le service**
   ```bash
   ./quick-start.sh
   ```

3. **Accéder à l'application**
   - Interface : http://localhost:2112
   - Santé API : http://localhost:2112/api/health

## 📁 Fichiers Docker Compose

- **`docker-compose.yml`** : Configuration principale (code local)
- **`docker-compose.github.yml`** : Déploiement depuis GitHub  
- **`docker-compose.simple.yml`** : Configuration simplifiée
- **`quick-start.sh`** : Script de démarrage rapide
- **`.env.example`** : Exemple de configuration

## 🎯 Options de Démarrage

```bash
# Option 1: Script automatique (recommandé)
./quick-start.sh

# Option 2: Script avec choix de source
./deploy.sh

# Option 3: Script simple
./start.sh  

# Option 4: Docker Compose direct
docker compose up -d --build
```

## 📖 Documentation

- **`DOCKER-README.md`** : Guide complet Docker
- **`README.md`** : Documentation principale du projet
- **`CONFIGURATION.md`** : Guide de configuration

## ✅ Fonctionnalités

- ✅ Démarrage en une commande
- ✅ Configuration automatique
- ✅ Support Docker Compose V2
- ✅ Health checks intégrés
- ✅ Gestion des volumes et données
- ✅ Scripts de maintenance
- ✅ Documentation complète

Le service crée automatiquement les répertoires nécessaires et configure l'environnement pour un démarrage immédiat.