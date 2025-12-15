#!/bin/bash
set -e

BASE_URL="https://raw.githubusercontent.com/greg35/iComptaBudget/main"
COMPOSE_FILE="docker-compose.yml"

echo "🚀 Starting iComptaBudget simple deployment..."

# Check docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Please install Docker first."
fi

# Create directory if needed
if [ ! -d "iComptaBudget-release" ]; then
    mkdir -p iComptaBudget-release
fi
cd iComptaBudget-release

echo "⬇️  Downloading configuration..."
curl -sL "$BASE_URL/$COMPOSE_FILE" -o docker-compose.yml

# Setup .env
if [ ! -f ".env" ]; then
    echo "📝 Creating .env..."
    cat > .env << EOF
NODE_ENV=production
FRONTEND_PORT=2112
TZ=Europe/Paris
EOF
fi

# Create data dir
mkdir -p data logs

echo "♻️  Pulling latest image and restarting..."
docker compose pull
docker compose up -d --remove-orphans

echo "✅ App runs at http://localhost:2112"
