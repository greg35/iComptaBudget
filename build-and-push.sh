#!/bin/bash
set -e

# Configuration
IMAGE_NAME="ghcr.io/greg35/icomptabudget"
VERSION=$(node -p "require('./package.json').version")

echo "🚀 Building Docker image for version $VERSION..."

# Login check
if ! docker info | grep -q "Username"; then
    echo "⚠️  You might not be logged in to Docker registry."
    echo "   Run: echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin"
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
