#!/bin/bash

# Script de migration des bases de données vers /data
# Usage: ./scripts/migrate-to-data.sh

set -e

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Migration des bases de données vers /data${NC}"

# Créer le répertoire data s'il n'existe pas
mkdir -p data

# Déplacer Comptes.cdb si il existe à la racine
if [ -f "Comptes.cdb" ]; then
    echo -e "${YELLOW}📦 Déplacement de Comptes.cdb vers data/...${NC}"
    mv Comptes.cdb data/
    echo -e "${GREEN}✅ Comptes.cdb déplacé${NC}"
else
    echo -e "${GREEN}✅ Comptes.cdb déjà dans data/ ou inexistant${NC}"
fi

# Vérifier iComptaBudgetData.sqlite
if [ -f "iComptaBudgetData.sqlite" ]; then
    echo -e "${YELLOW}📦 Déplacement de iComptaBudgetData.sqlite vers data/...${NC}"
    mv iComptaBudgetData.sqlite data/
    echo -e "${GREEN}✅ iComptaBudgetData.sqlite déplacé${NC}"
elif [ -f "backend/iComptaBudgetData.sqlite" ]; then
    echo -e "${YELLOW}📦 Déplacement de iComptaBudgetData.sqlite depuis backend/ vers data/...${NC}"
    mv backend/iComptaBudgetData.sqlite data/
    echo -e "${GREEN}✅ iComptaBudgetData.sqlite déplacé${NC}"
else
    echo -e "${GREEN}✅ iComptaBudgetData.sqlite déjà dans data/ ou inexistant${NC}"
fi

# Afficher la structure finale
echo -e "${BLUE}📁 Structure finale du répertoire data/:${NC}"
ls -la data/ 2>/dev/null || echo "Répertoire data/ vide"

echo -e "${GREEN}🎉 Migration terminée !${NC}"
echo -e "${BLUE}ℹ️  Les bases de données sont maintenant dans /data pour une meilleure compatibilité Docker${NC}"
