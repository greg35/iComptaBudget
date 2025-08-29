#!/bin/bash

# Script de déploiement robuste avec gestion d'erreurs Docker

set -e

echo "🚀 iComptaBudget - Déploiement robuste"
echo "====================================="

# Fonction pour gérer les erreurs Docker
handle_docker_error() {
    local exit_code=$1
    echo ""
    echo "❌ Erreur Docker détectée (code: $exit_code)"
    echo ""
    echo "🔧 Solutions possibles :"
    echo "1. Problème BuildKit - Désactivation..."
    export DOCKER_BUILDKIT=0
    export COMPOSE_DOCKER_CLI_BUILD=0
    
    echo "2. Nettoyage du cache Docker..."
    docker builder prune -f 2>/dev/null || true
    docker system prune -f 2>/dev/null || true
    
    echo "3. Redémarrage du daemon Docker recommandé"
    echo ""
    return $exit_code
}

# Fonction de déploiement
deploy_app() {
    local compose_file=$1
    local description=$2
    
    echo "🏗️  Tentative de déploiement $description..."
    
    # Désactiver BuildKit par précaution
    export DOCKER_BUILDKIT=0
    export COMPOSE_DOCKER_CLI_BUILD=0
    
    if docker-compose -f "$compose_file" up --build -d; then
        echo "✅ Déploiement réussi avec $compose_file"
        return 0
    else
        echo "❌ Échec avec $compose_file"
        return 1
    fi
}

# Créer les répertoires nécessaires
mkdir -p data logs

# Créer un fichier .env minimal s'il n'existe pas
if [ ! -f ".env" ]; then
    echo "📝 Création du fichier .env..."
    cat > .env << EOF
NODE_ENV=production
FRONTEND_PORT=2112
TZ=Europe/Paris
DOCKER_BUILDKIT=0
COMPOSE_DOCKER_CLI_BUILD=0
EOF
fi

echo ""
echo "Choisissez votre mode de déploiement :"
echo ""
echo "1. 🛠️  Local (code dans ce répertoire)"
echo "2. 🌐 GitHub (dernière version - standard)"
echo "3. 🌐 GitHub (méthode alternative)"
echo "4. 🔧 Méthode simple (clone dans conteneur)"
echo ""

read -p "Votre choix (1-4) [1]: " choice
choice=${choice:-1}

# Vérifier si le fichier Comptes.cdb existe
if [ ! -f "Comptes.cdb" ]; then
    echo "⚠️  Attention: Fichier Comptes.cdb non trouvé"
    echo "   L'application fonctionnera mais sans données iCompta"
fi

echo ""

case $choice in
    1)
        if deploy_app "docker-compose.yml" "depuis le code local"; then
            COMPOSE_FILE="docker-compose.yml"
        else
            echo "❌ Échec du déploiement local"
            exit 1
        fi
        ;;
    2)
        if deploy_app "docker-compose.github.yml" "depuis GitHub (standard)"; then
            COMPOSE_FILE="docker-compose.github.yml"
        else
            echo "🔄 Tentative avec méthode alternative..."
            if deploy_app "docker-compose.simple.yml" "depuis GitHub (simple)"; then
                COMPOSE_FILE="docker-compose.simple.yml"
            else
                echo "❌ Toutes les méthodes GitHub ont échoué"
                echo "💡 Essayez le déploiement local (option 1)"
                exit 1
            fi
        fi
        ;;
    3)
        if deploy_app "docker-compose.simple.yml" "depuis GitHub (alternative)"; then
            COMPOSE_FILE="docker-compose.simple.yml"
        else
            echo "❌ Échec de la méthode alternative"
            exit 1
        fi
        ;;
    4)
        echo "🛠️  Méthode simple avec clone dans conteneur..."
        # Créer un docker-compose temporaire très simple
        cat > docker-compose.temp.yml << 'EOF'
version: '3.8'
services:
  icomptabudget:
    image: node:18-alpine
    container_name: icomptabudget_temp
    working_dir: /app
    command: sh -c "
      apk add --no-cache git &&
      git clone https://github.com/greg35/iComptaBudget.git . &&
      npm install &&
      cd backend && npm install && cd .. &&
      npm run build &&
      echo 'Application prête sur http://localhost:2112' &&
      npm run dev
    "
    ports:
      - "2112:2112"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./Comptes.cdb:/app/Comptes.cdb:ro
      - ./iComptaBudgetData.sqlite:/app/iComptaBudgetData.sqlite
    environment:
      - NODE_ENV=development
EOF
        
        if docker-compose -f docker-compose.temp.yml up -d; then
            COMPOSE_FILE="docker-compose.temp.yml"
            echo "✅ Déploiement simple réussi"
        else
            echo "❌ Échec de la méthode simple"
            rm -f docker-compose.temp.yml
            exit 1
        fi
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo ""
echo "⏱️  Attente du démarrage complet..."
sleep 15

# Vérifier le statut
echo "📊 Statut de l'application :"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "✅ iComptaBudget est maintenant accessible !"
echo "🌍 Frontend : http://localhost:2112"
echo ""
echo "📋 Commandes utiles :"
echo "  docker-compose -f $COMPOSE_FILE logs -f    # Voir les logs"
echo "  docker-compose -f $COMPOSE_FILE stop       # Arrêter"
echo "  docker-compose -f $COMPOSE_FILE restart    # Redémarrer"
echo "  curl http://localhost:2112/api/health      # Test de santé"
echo ""
echo "🔧 En cas de problème :"
echo "  ./fix-docker.sh                            # Corriger les problèmes Docker"
