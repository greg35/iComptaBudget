# Gestion des Versions - iComptaBudget

Ce document explique comment gérer les versions de l'application iComptaBudget.

## 📋 Vue d'ensemble

L'application utilise le [Semantic Versioning](https://semver.org/lang/fr/) (semver) :

- **MAJOR** (`X.0.0`) : Changements incompatibles avec les versions précédentes
- **MINOR** (`0.X.0`) : Nouvelles fonctionnalités compatibles avec les versions précédentes  
- **PATCH** (`0.0.X`) : Corrections de bugs compatibles

## 🚀 Commandes disponibles

### Afficher la version actuelle
```bash
npm run version:show
```

### Incrémenter la version manuellement
```bash
# Correction de bug (0.1.0 → 0.1.1)
npm run version:patch

# Nouvelle fonctionnalité (0.1.0 → 0.2.0)
npm run version:minor

# Changement majeur (0.1.0 → 1.0.0)
npm run version:major
```

### Créer une release complète (recommandé)
```bash
# Release patch (0.1.0 → 0.1.1)
npm run release:patch

# Release minor (0.1.0 → 0.2.0)
npm run release:minor

# Release major (0.1.0 → 1.0.0)
npm run release:major
```

## 🔄 Processus de release automatisé

Le script `release.sh` effectue automatiquement :

1. ✅ Vérification que le répertoire Git est propre
2. 🏗️ Construction de l'application
3. 📦 Incrémentation de la version
4. 🏗️ Reconstruction avec la nouvelle version
5. 📝 Création du commit de release
6. 🏷️ Création du tag Git
7. 📤 Push vers le dépôt distant
8. 🚀 **Création automatique de la release GitHub**
9. 📋 **Génération des notes de release**

### 📋 Notes de release automatiques

Le script génère automatiquement :
- **Liste des commits** depuis la dernière release
- **Liens de comparaison** entre versions
- **Notes formatées** avec emojis et sections

### 🛠️ Prérequis pour les releases GitHub

Pour que la création de release GitHub fonctionne, vous devez installer et configurer GitHub CLI :

```bash
# 1. Installer GitHub CLI (macOS)
brew install gh

# 1. Installer GitHub CLI (Linux/WSL)
# Ubuntu/Debian
sudo apt install gh
# Ou avec snap
sudo snap install gh

# 1. Installer GitHub CLI (Windows)
# Télécharger depuis https://cli.github.com/
# Ou avec Chocolatey: choco install gh

# 2. S'authentifier avec votre compte GitHub
gh auth login

# 3. Vérifier l'authentification
gh auth status
```

**⚠️ Important :** Si GitHub CLI n'est pas installé ou configuré, le script continuera et créera seulement le tag Git local, sans la release GitHub.

## 📱 Affichage dans l'interface

La version est affichée automatiquement :
- Dans le footer de la sidebar (badge discret)
- Accessible via la fonction `getAppVersion()`

## 📝 Changelog

Maintenez le fichier `CHANGELOG.md` à jour :

1. Ajoutez vos modifications dans la section `[Non publié]`
2. Lors d'une release, déplacez les changements vers la nouvelle version
3. Créez une nouvelle section `[Non publié]`

## 🎯 Bonnes pratiques

### Quand utiliser chaque type de version :

**PATCH (0.0.X)**
- Correction de bugs
- Optimisations de performance
- Corrections de sécurité mineures

**MINOR (0.X.0)**
- Nouvelles fonctionnalités
- Améliorations d'interface
- Ajout d'API

**MAJOR (X.0.0)**
- Changements d'architecture
- Modifications incompatibles
- Suppression de fonctionnalités

### Workflow recommandé

1. **Développement** : Travaillez sur votre fonctionnalité
2. **Test** : Assurez-vous que tout fonctionne
3. **Documentation** : Mettez à jour le CHANGELOG.md
4. **Release** : Utilisez `npm run release:[type]`

## 🛠️ Configuration technique

### Vite configuration
```typescript
define: {
  __APP_VERSION__: JSON.stringify(packageJson.version),
}
```

### Composant React
```tsx
import { VersionInfo } from "./VersionInfo";

// Utilisation
<VersionInfo className="opacity-70" />
```

## 📋 Exemple complet

```bash
# 1. Développer une nouvelle fonctionnalité
git checkout -b feature/nouvelle-fonctionnalite

# 2. Faire vos modifications...
# 3. Committer vos changements
git commit -m "feat: ajouter nouvelle fonctionnalité"

# 4. Merger sur main
git checkout main
git merge feature/nouvelle-fonctionnalite

# 5. Créer une release
npm run release:minor

# ✅ Done! Nouvelle version déployée avec tag Git
```

## 🔍 Debugging

Si la version ne s'affiche pas correctement :

1. Vérifiez que Vite est redémarré après modification du `vite.config.ts`
2. Vérifiez la console pour les erreurs TypeScript
3. Assurez-vous que `__APP_VERSION__` est défini dans la config Vite

### ❌ Problèmes de release GitHub

Si la création de release GitHub échoue :

```bash
# Vérifier l'installation de GitHub CLI
gh --version

# Vérifier l'authentification
gh auth status

# Re-authentifier si nécessaire
gh auth login

# Créer une release manuellement
gh release create v1.0.0 --title "Release v1.0.0" --notes "Description"
```

**Note :** Si GitHub CLI n'est pas disponible, le script continuera et créera seulement le tag Git.

## 📚 Ressources

- [Semantic Versioning](https://semver.org/lang/fr/)
- [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
- [Conventional Commits](https://www.conventionalcommits.org/fr/)
