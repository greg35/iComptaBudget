#!/bin/bash

# Script de démarrage avec choix de source

echo "🚀 iComptaBudget - Choix du mode de déploiement"
echo ""
echo "1. 🛠️  Local (code dans ce répertoire)"
echo "2. 🌐 GitHub (dernière version du dépôt)"
echo ""

read -p "Votre choix (1-2) [1]: " choice
choice=${choice:-1}

# Créer les répertoires nécessaires
mkdir -p data logs

# Créer un fichier .env minimal s'il n'existe pas
if [ ! -f ".env" ]; then
    echo "📝 Création du fichier .env..."
    cat > .env << EOF
NODE_ENV=production
FRONTEND_PORT=3000
TZ=Europe/Paris
EOF
fi

case $choice in
    1)
        echo ""
        echo "🛠️  Déploiement depuis le code local..."
        COMPOSE_FILE="docker-compose.yml"
        ;;
    2)
        echo ""
        echo "🌐 Déploiement depuis GitHub..."
        COMPOSE_FILE="docker-compose.github.yml"
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

# Vérifier si le fichier Comptes.cdb existe
if [ ! -f "Comptes.cdb" ]; then
    echo "⚠️  Attention: Fichier Comptes.cdb non trouvé"
    echo "   Ce fichier est nécessaire pour les données iCompta"
    echo "   L'application démarrera mais vous devrez configurer la synchronisation Dropbox"
fi

# Construire et démarrer
echo "🏗️  Construction et démarrage avec $COMPOSE_FILE..."
docker-compose -f "$COMPOSE_FILE" up --build -d

echo "⏱️  Attente du démarrage complet..."
sleep 10

# Vérifier le statut
echo "📊 Statut de l'application :"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "✅ iComptaBudget est maintenant accessible !"
echo "🌍 Frontend : http://localhost:3000"
echo "🔧 API interne (non exposée) : disponible via /api/*"
echo ""
echo "📋 Commandes utiles :"
echo "  docker-compose -f $COMPOSE_FILE logs -f    # Voir les logs"
echo "  docker-compose -f $COMPOSE_FILE stop       # Arrêter"
echo "  docker-compose -f $COMPOSE_FILE restart    # Redémarrer"
echo "  curl http://localhost:3000/api/health      # Test de santé"
