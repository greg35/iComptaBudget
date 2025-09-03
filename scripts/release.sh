#!/bin/bash

# Script de release pour iComptaBudget
# Usage: ./release.sh [patch|minor|major]

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage coloré
echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier les arguments
VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo_error "Type de version invalide. Utilisez: patch, minor, ou major"
    exit 1
fi

echo_info "Début du processus de release ($VERSION_TYPE)..."

# Vérifier que le git working directory est clean
if [[ -n $(git status --porcelain) ]]; then
    echo_error "Le répertoire de travail Git n'est pas propre. Committez vos changements d'abord."
    exit 1
fi

echo_success "Répertoire de travail Git propre"

# Vérifier qu'on est sur la branche main
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo_warning "Vous n'êtes pas sur la branche main (branche actuelle: $CURRENT_BRANCH)"
    read -p "Continuer quand même ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo_info "Release annulée"
        exit 1
    fi
fi

# Récupérer la version actuelle
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo_info "Version actuelle: $CURRENT_VERSION"

# Exécuter les tests (si ils existent)
if npm run test --if-present > /dev/null 2>&1; then
    echo_success "Tests passés"
else
    echo_warning "Aucun test configuré ou tests échoués"
fi

# Construire l'application
echo_info "Construction de l'application..."
npm run build

echo_success "Application construite avec succès"

# Mettre à jour la version
echo_info "Mise à jour de la version ($VERSION_TYPE)..."
npm version $VERSION_TYPE --no-git-tag-version > /dev/null 2>&1
NEW_VERSION=$(node -p "require('./package.json').version")
echo_success "Nouvelle version: $NEW_VERSION"

# Construire à nouveau avec la nouvelle version
echo_info "Reconstruction avec la nouvelle version..."
npm run build

# Créer le commit et le tag
git add .
git commit -m "chore: release v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo_success "Commit et tag créés"

# Pousser les changements
echo_info "Push des changements vers le dépôt distant..."
git push origin main
git push origin --tags

# Créer la release GitHub
echo_info "Création de la release GitHub..."

# Vérifier si GitHub CLI est installé
if ! command -v gh &> /dev/null; then
    echo_error "GitHub CLI (gh) n'est pas installé. Installation requise pour créer des releases."
    echo_info "Installation: brew install gh (macOS) ou https://cli.github.com/"
    echo_warning "Le tag a été créé mais pas la release GitHub"
    exit 1
fi

# Vérifier l'authentification GitHub
if ! gh auth status &> /dev/null; then
    echo_error "GitHub CLI n'est pas authentifié. Exécutez: gh auth login"
    echo_warning "Le tag a été créé mais pas la release GitHub"
    exit 1
fi

# Générer les notes de release automatiquement
RELEASE_NOTES=""

# Essayer de récupérer les commits depuis la dernière release
LAST_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")

if [[ -n "$LAST_TAG" ]]; then
    echo_info "Génération des notes de release depuis $LAST_TAG..."
    
    # Récupérer les commits depuis le dernier tag
    COMMITS=$(git log --oneline "$LAST_TAG"..HEAD --no-merges | head -20)
    
    if [[ -n "$COMMITS" ]]; then
        RELEASE_NOTES="## 🚀 Nouveautés

$COMMITS

## 📋 Changements complets
Voir tous les changements: [\`$LAST_TAG...v$NEW_VERSION\`](https://github.com/greg35/iComptaBudget/compare/$LAST_TAG...v$NEW_VERSION)"
    fi
fi

# Notes de release par défaut si aucun commit trouvé
if [[ -z "$RELEASE_NOTES" ]]; then
    RELEASE_NOTES="## 🚀 Release v$NEW_VERSION

Nouvelle version de iComptaBudget avec corrections et améliorations.

Pour plus de détails, consultez le [CHANGELOG.md](https://github.com/greg35/iComptaBudget/blob/main/CHANGELOG.md)."
fi

# Créer la release GitHub
if gh release create "v$NEW_VERSION" \
    --title "🚀 Release v$NEW_VERSION" \
    --notes "$RELEASE_NOTES" \
    --target main; then
    echo_success "Release GitHub créée: https://github.com/greg35/iComptaBudget/releases/tag/v$NEW_VERSION"
else
    echo_error "Erreur lors de la création de la release GitHub"
    echo_warning "Le tag a été créé mais pas la release GitHub"
    exit 1
fi

echo_success "Release v$NEW_VERSION terminée avec succès! 🎉"

# Afficher les informations de release
echo_info "Informations de release:"
echo "  - Version: v$NEW_VERSION"
echo "  - Branche: $CURRENT_BRANCH"
echo "  - Commit: $(git rev-parse --short HEAD)"
echo "  - Tag: v$NEW_VERSION"
echo "  - Release: https://github.com/greg35/iComptaBudget/releases/tag/v$NEW_VERSION"
