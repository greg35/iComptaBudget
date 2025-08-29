#!/bin/bash

# Quick start pour iComptaBudget avec Docker Compose
# Ce script configure et démarre rapidement le service

echo "🐳 iComptaBudget - Démarrage rapide avec Docker"
echo ""

# Créer les répertoires nécessaires
echo "📁 Création des répertoires de données..."
mkdir -p data logs

# Créer un fichier .env s'il n'existe pas
if [ ! -f ".env" ]; then
    echo "📝 Création du fichier .env..."
    cp .env.example .env
    echo "✅ Fichier .env créé depuis .env.example"
else
    echo "✅ Fichier .env existant trouvé"
fi

# Vérifier si le fichier Comptes.cdb existe
if [ ! -f "Comptes.cdb" ]; then
    echo ""
    echo "⚠️  Fichier Comptes.cdb non trouvé"
    echo "   L'application démarrera mais vous devrez :"
    echo "   1. Configurer l'URL Dropbox dans les paramètres"
    echo "   2. Utiliser 'Mettre à jour les comptes' pour synchroniser"
    echo ""
fi

# Démarrer avec docker-compose
echo "🚀 Démarrage du service avec Docker Compose..."
docker compose up -d --build

echo ""
echo "⏱️  Attente du démarrage complet..."
sleep 15

# Vérifier le statut
echo ""
echo "📊 Statut de l'application :"
docker compose ps

echo ""
echo "✅ iComptaBudget est démarré !"
echo ""
echo "🌍 Accès à l'application :"
echo "   • Interface web : http://localhost:3000"
echo "   • Test de santé : http://localhost:3000/api/health"
echo ""
echo "📋 Commandes utiles :"
echo "   docker compose logs -f          # Voir les logs en temps réel"
echo "   docker compose stop             # Arrêter le service"
echo "   docker compose restart          # Redémarrer le service"
echo "   ./stop.sh                       # Script d'arrêt"
echo ""
echo "📖 Pour plus d'aide : voir DOCKER-README.md"