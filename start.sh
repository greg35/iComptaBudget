#!/bin/bash

# Script de démarrage simple pour iComptaBudget avec Docker

echo "🚀 Démarrage d'iComptaBudget..."

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

# Vérifier si le fichier Comptes.cdb existe
if [ ! -f "Comptes.cdb" ]; then
    echo "⚠️  Attention: Fichier Comptes.cdb non trouvé"
    echo "   Ce fichier est nécessaire pour les données iCompta"
    echo "   L'application démarrera mais vous devrez configurer la synchronisation Dropbox"
fi

# Construire et démarrer
echo "🏗️  Construction et démarrage de l'application..."
docker compose up --build -d

echo "⏱️  Attente du démarrage complet..."
sleep 10

# Vérifier le statut
echo "📊 Statut de l'application :"
docker compose ps

echo ""
echo "✅ iComptaBudget est maintenant accessible !"
echo "🌍 Frontend : http://localhost:3000"
echo "🔧 API interne (non exposée) : disponible via /api/*"
echo ""
echo "📋 Commandes utiles :"
echo "  docker compose logs -f    # Voir les logs"
echo "  docker compose stop       # Arrêter"
echo "  docker compose restart    # Redémarrer"
echo "  curl http://localhost:3000/api/health  # Test de santé"
