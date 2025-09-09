# Mode Développement - Guide d'utilisation

Ce système permet de désactiver l'authentification temporairement pour faciliter les tests des API pendant le développement.

## 🔧 Commandes disponibles

### Via npm (recommandé)
```bash
# Activer le mode développement
npm run dev-mode:on

# Désactiver le mode développement
npm run dev-mode:off

# Vérifier l'état actuel
npm run dev-mode:status
```

### Via script direct
```bash
# Activer le mode développement
node dev-mode.js on

# Désactiver le mode développement
node dev-mode.js off

# Vérifier l'état actuel
node dev-mode.js status
```

## 🚀 Comment utiliser

1. **Activer le mode développement :**
   ```bash
   cd backend
   npm run dev-mode:on
   ```

2. **Redémarrer le serveur :**
   ```bash
   node index.js
   ```

3. **Tester vos API :**
   Vous pouvez maintenant faire des requêtes à toutes les API sans avoir besoin de token d'authentification :
   ```bash
   # Exemple avec curl
   curl http://localhost:8080/api/projects
   
   # Exemple avec fetch en JavaScript
   fetch('http://localhost:8080/api/projects')
     .then(response => response.json())
     .then(data => console.log(data));
   ```

4. **Désactiver quand vous avez terminé :**
   ```bash
   npm run dev-mode:off
   ```

## ⚠️ Important

- **N'oubliez pas de désactiver le mode développement** avant de déployer en production
- En mode développement, toutes les requêtes utilisent un utilisateur fictif (`dev@test.com`)
- Le serveur doit être redémarré après chaque changement de mode
- Le mode est persistant jusqu'à ce que vous le changiez explicitement

## 🔍 Vérification

Pour vérifier si le mode développement est actif, regardez les logs du serveur :
- Vous verrez `🔓 Mode développement activé - authentification ignorée` dans les logs
- Ou utilisez `npm run dev-mode:status`

## 🧪 Tests rapides

Avec le mode développement activé, vous pouvez tester rapidement :
```bash
# Lister les projets
curl http://localhost:8080/api/projects

# Obtenir les comptes
curl http://localhost:8080/api/accounts

# Vérifier la santé du serveur
curl http://localhost:8080/api/health
```
