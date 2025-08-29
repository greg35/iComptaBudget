#!/bin/bash

# Script d'arrêt pour iComptaBudget

echo "🛑 Arrêt d'iComptaBudget..."

docker compose down

echo "✅ Application arrêtée"
echo ""
echo "Pour redémarrer : ./start.sh"
