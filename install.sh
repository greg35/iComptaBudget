#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/greg35/iComptaBudget.git"
INSTALL_DIR="iComptaBudget"
BRANCH="main"

echo "🚀 Starting iComptaBudget deployment..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker does not appear to be installed or in PATH."
    echo "    The script will proceed, but deployment may fail."
fi

if [ -d "$INSTALL_DIR" ]; then
    echo "📂 Directory $INSTALL_DIR exists. Updating..."
    cd "$INSTALL_DIR"
    
    # Check if it's a git repo
    if [ -d ".git" ]; then
        echo "⬇️  Pulling latest changes..."
        git fetch origin
        git reset --hard origin/$BRANCH || echo "⚠️  Could not reset to origin/$BRANCH. Trying simple pull..." && git pull
    else
        echo "⚠️  $INSTALL_DIR is not a git repository. Aborting update safely."
        exit 1
    fi
else
    echo "📂 Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Ensure data directory exists
mkdir -p data logs

# Setup .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating default .env..."
    cat > .env << EOF
NODE_ENV=production
FRONTEND_PORT=2112
TZ=Europe/Paris
EOF
fi

# Verify critical files
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "⚠️  docker-compose.prod.yml not found. Using default docker-compose.yml as fallback or failing..."
    # If we just cloned, it should be there. If not, maybe the repo doesn't have it yet?
    # In a real scenario, we might want to curl it down if it's not in the repo, 
    # but since I am adding it to the repo now, it should be there after git clone/pull.
fi

echo "🏗️  Building and starting application..."
# Force recreation to ensure latest code is used
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "⏳ Waiting for service to be healthy..."
sleep 10

if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Deployment successful!"
    echo "🌍 Application is running at http://localhost:2112"
else
    echo "⚠️  Container might not be running correctly. Check logs with:"
    echo "   cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml logs -f"
fi
