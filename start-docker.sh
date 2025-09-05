#!/usr/bin/env bash
set -euo pipefail

# Script de démarrage local pour iComptaBudget via docker-compose.local.yml
# Usage:
#   ./start-docker.sh                # build + up (si déjà build, skip cache)
#   ./start-docker.sh --rebuild      # force rebuild (no cache)
#   ./start-docker.sh --logs         # attache les logs après démarrage
#   FRONTEND_PORT=3000 ./start-docker.sh  # changer le port exposé
#
# Variables d'environnement supportées:
#   FRONTEND_PORT   (défaut: 2112)
#   TZ              (défaut: Europe/Paris)
#
# Le conteneur expose l'UI sur http://localhost:${FRONTEND_PORT}
# L'API est accessible sur http://localhost:${FRONTEND_PORT}/api
# Le volume de données est monté sur /docker/icomptabudget/data (modifiable dans docker-compose.local.yml)

COMPOSE_FILE="docker-compose.local.yml"
SERVICE_NAME="icomptabudget"
CONTAINER_NAME="icomptabudget_local"
FRONTEND_PORT="${FRONTEND_PORT:-2112}"
REBUILD=0
TAIL_LOGS=0

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ; shift ;;
    --logs) TAIL_LOGS=1 ; shift ;;
    -h|--help)
      grep '^# ' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

# Détection de la commande docker compose
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  DC="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  echo "[ERREUR] docker compose (plugin) ou docker-compose introuvable" >&2
  exit 1
fi

echo "[INFO] Utilisation de: $DC -f $COMPOSE_FILE"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[ERREUR] Fichier $COMPOSE_FILE introuvable à la racine du projet" >&2
  exit 1
fi

echo "[INFO] FRONTEND_PORT=$FRONTEND_PORT"

# Export pour substitution dans le compose
export FRONTEND_PORT

if [[ $REBUILD -eq 1 ]]; then
  echo "[INFO] Rebuild forcé (no-cache)" 
  $DC -f "$COMPOSE_FILE" build --no-cache "$SERVICE_NAME"
else
  echo "[INFO] Build (cache autorisé)"
  $DC -f "$COMPOSE_FILE" build "$SERVICE_NAME"
fi

echo "[INFO] Démarrage du service..."
$DC -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"

# Attente healthcheck
echo -n "[INFO] Attente du healthcheck (max ~60s)"
ATTEMPTS=0
STATUS="starting"
while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo 'inconnu')
  if [[ "$STATUS" == "healthy" ]]; then
    echo -e "\n[OK] Conteneur healthy"
    break
  fi
  if [[ "$STATUS" == "unhealthy" ]]; then
    echo -e "\n[ERREUR] Conteneur en statut unhealthy" >&2
    $DC -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE_NAME" || true
    exit 1
  fi
  if (( ATTEMPTS > 60 )); then
    echo -e "\n[AVERTISSEMENT] Timeout healthcheck (dernier statut: $STATUS)"
    break
  fi
  ((ATTEMPTS++))
  echo -n "."
  sleep 1
done

URL="http://localhost:${FRONTEND_PORT}"
echo "[INFO] Application disponible (si healthy) : $URL"
echo "[INFO] API: $URL/api/health"

echo "[ASTUCE] Arrêt: $DC -f $COMPOSE_FILE down"
echo "[ASTUCE] Logs: $DC -f $COMPOSE_FILE logs -f $SERVICE_NAME"

if [[ $TAIL_LOGS -eq 1 ]]; then
  echo "[INFO] Attachement aux logs (Ctrl+C pour détacher)"
  $DC -f "$COMPOSE_FILE" logs -f "$SERVICE_NAME"
fi
