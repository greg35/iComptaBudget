#!/bin/bash
set -e

# Configuration
IMAGE_NAME="ghcr.io/greg35/icomptabudget"
VERSION=$(node -p "require('./package.json').version")

echo "🚀 Building Docker image for version $VERSION..."

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Login check
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo "⚠️  Not logged in to Docker registry."
    
    if [ -n "$CR_USER" ] && [ -n "$CR_PAT" ]; then
        echo "🔐 Attempting to login using CR_USER and CR_PAT..."
        echo "$CR_PAT" | docker login ghcr.io -u "$CR_USER" --password-stdin
    else
        echo "❌ Missing credentials. Please create a .env file with CR_USER and CR_PAT, or login manually."
        echo "   Manual login: echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin"
        exit 1
    fi
fi

# Build
echo "🏗️  Building image..."
docker build -t "$IMAGE_NAME:latest" -t "$IMAGE_NAME:$VERSION" .

# Push
echo "⬆️  Pushing to GHCR..."
docker push "$IMAGE_NAME:latest"
docker push "$IMAGE_NAME:$VERSION"

echo "✅ Build and push completed successfully!"
echo "   Images: $IMAGE_NAME:latest, $IMAGE_NAME:$VERSION"

# Release
if command -v gh &> /dev/null; then
    echo "📦 Checking GitHub Release..."
    if ! gh release view "v$VERSION" &> /dev/null; then
        echo "   Creating release v$VERSION..."
        if gh release create "v$VERSION" --title "🚀 Release v$VERSION" --generate-notes; then
            echo "✅ Release created: https://github.com/greg35/iComptaBudget/releases/tag/v$VERSION"
        else
            echo "❌ Failed to create release."
        fi
    else
        echo "ℹ️  Release v$VERSION already exists."
    fi
else
    echo "⚠️  GitHub CLI (gh) not found, skipping release creation."
fi
