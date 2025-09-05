# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).
## [1.4.8] - 2025-09-05

### Ajouté
- Bouton "+ de détail" dans le panneau des objectifs d'épargne pour afficher/masquer les informations secondaires

### Modifié
- Détails des objectifs repliés par défaut pour alléger l'interface

### Corrigé
- Amélioration mineure de l'ergonomie (réduction du scroll vertical inutile)

## [1.4.7] - 2025-09-03

### Corrigé
- Bug Fixing & improvment

## [1.4.6] - 2025-09-03

### Modifié
- Footer global d'épargne repositionné (largeur calculée sans la sidebar)
- Style sticky ajusté pour éviter le chevauchement avec la barre latérale

### Corrigé
- Problème d'affichage du footer recouvrant le contenu principal

## [1.4.5] - 2025-09-03

### Ajouté
- Footer global présentant : épargne totale, épargne projets, épargne libre

### Modifié
- Ajout d'un padding bas conditionnel lorsque le footer est présent

## [1.4.4] - 2025-09-03

### Modifié
- Calcul "Reste à épargner" déplacé côté frontend (plannedBudget - currentSavings) pour cohérence visuelle immédiate

### Corrigé
- Légère divergence entre la suggestion backend et l'affichage du panneau

## [1.4.3] - 2025-09-03

### Ajouté
- Intégration des transactions d'épargne manuelles (manualSaved) dans la suggestion des objectifs

### Modifié
- Endpoint de suggestion enrichi avec la clé `manualSaved` pour transparence

### Corrigé
- Décalage entre le remainingBudget suggéré et les montants réellement épargnés manuellement

## [1.4.2] - 2025-09-03

### Ajouté
- Création automatique de releases GitHub avec notes générées
- Action GitHub pour automatisation des releases
- Documentation améliorée pour le système de versioning

### Modifié
- Script de release amélioré avec support GitHub CLI
- Prérequis pour les releases GitHub documentés

## [1.4.1] - 2025-09-03

### Corrigé
- Correction du calcul de `projectBreakdown` dans l'API monthly-savings
- Intégration des allocations manuelles dans le breakdown mensuel
- Affichage correct des montants par projet dans MonthlySavingsView

### Technique
- Utilisation correcte de sql.js pour les requêtes d'allocations
- Évitement du double comptage entre données iCompta et allocations manuelles

## [1.4.0] - 2025-09-03

### Ajouté
- Édition inline des noms de projets avec composant NameEditor
- Interface d'édition intuitive avec hover et clic
- Sauvegarde automatique des modifications de nom
- Gestion d'erreurs pour l'édition des noms

### Modifié
- Interface ProjectHeader avec édition de nom intégrée
- Amélioration de l'expérience utilisateur pour l'édition

## [1.3.0] - 2025-09-02

### Ajouté
- Système d'allocation manuelle d'épargne par projet
- API pour la gestion des allocations mensuelles par projet
- Interface d'édition des montants d'épargne avec InlineAmountEditor
- Objectifs d'épargne par projet avec saving goals
- Badges colorés pour le statut des projets

### Modifié
- Logique de calcul de currentSavings pour inclure les allocations manuelles
- Filtrage des transactions avec flag isManual pour éviter le double comptage
- Interface utilisateur plus intuitive pour l'édition des montants

### Corrigé
- Double comptage entre données iCompta et allocations manuelles
- Affichage des badges avec les bonnes couleurs
- Gestion des apostrophes dans les textes français pour les requêtes SQL

## [1.2.0] - 2025-09-01

### Ajouté
- Séparation des préoccupations entre données et code
- Migration des données utilisateur vers un répertoire dédié
- Configuration Docker améliorée avec volumes spécifiques
- Documentation sur les bonnes pratiques de sécurité

### Sécurité
- Déplacement de la base de données hors du répertoire backend
- Permissions restrictives pour les fichiers de données
- Configuration d'environnement sécurisée

## [1.1.0] - 2025-08-31

### Ajouté
- Système de gestion de version automatisé
- Affichage de la version dans l'interface utilisateur
- Scripts de release automatisés
- Documentation de versioning
- Ajout d'un tableau permettant de voir l'épargne par mois et par projet sur les 3, 6 ou 12 derniers mois

### Modifié
- Ordre chronologique dans l'épargne mensuelle (plus ancien → plus récent)
- Optimisation des performances lors du changement de mois

### Corrigé
- Performance lente lors du changement de mois dans l'épargne mensuelle

## [1.0.0] - 2025-08-30

### Ajouté
- Application de gestion de budget initiale
- Gestion des projets et épargne
- Interface de suivi mensuel
- Intégration avec iCompta
- Sidebar avec navigation
- Bouton de mise à jour des comptes

### Fonctionnalités
- Calcul automatique de l'épargne depuis iCompta
- Ventilation par projet
- Interface responsive
- Gestion des comptes Dropbox

## Types de changements

- `Ajouté` pour les nouvelles fonctionnalités
- `Modifié` pour les changements dans les fonctionnalités existantes
- `Obsolète` pour les fonctionnalités qui seront bientôt supprimées
- `Supprimé` pour les fonctionnalités supprimées
- `Corrigé` pour les corrections de bugs
- `Sécurité` pour les vulnérabilités corrigées
- `Technique` pour les changements techniques sans impact utilisateur

## [1.0.0] - 2025-08-30

### Ajouté
- Application de gestion de budget initiale
- Gestion des projets et épargne
- Interface de suivi mensuel
- Intégration avec iCompta
- Sidebar avec navigation
- Bouton de mise à jour des comptes

### Fonctionnalités
- Calcul automatique de l'épargne depuis iCompta
- Ventilation par projet
- Interface responsive
- Gestion des comptes Dropbox
