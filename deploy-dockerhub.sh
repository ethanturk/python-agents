#!/bin/bash

# Docker Hub Deployment Script
# This script pulls pre-built images from Docker Hub and deploys them

set -e

# Configuration
BACKEND_IMAGE="ethanturk/python-agents-backend:latest"
WORKER_IMAGE="ethanturk/python-agents-worker:latest"
FRONTEND_DEPLOY_URL="https://aidocs.ethanturk.com"  # Vercel frontend URL

echo "🚀 Starting Docker Hub deployment..."
echo "Using pre-built images from Docker Hub"
echo "Backend image: $BACKEND_IMAGE"
echo "Worker image: $WORKER_IMAGE"
echo "Frontend URL: $FRONTEND_DEPLOY_URL"

# Update API_URL in backend compose file to point to deployed frontend
echo "📝 Updating backend compose file with production API_URL..."
sed -i.bak "s|API_URL:.*|API_URL: $FRONTEND_DEPLOY_URL|g" docker-compose.yml

# Pull latest images
echo "📦 Pulling Docker images..."
docker pull $BACKEND_IMAGE
docker pull $WORKER_IMAGE

# Stop existing containers
echo "⏹ Stopping existing containers..."
docker-compose down || true

# Start new containers
echo "▶️ Starting containers with pre-built images..."
docker-compose up -d

echo "✅ Deployment complete!"
echo "🔍 Checking container status..."
sleep 10
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "Frontend: $FRONTEND_DEPLOY_URL"
echo "Backend API: http://localhost:${BACKEND_PORT:-8000}"
echo "Flower (Celery monitor): http://localhost:${FLOWER_PORT:-5555}"
echo ""
echo "💡 To update API URL after deployment, run:"
echo "   API_URL=https://yourdomain.com docker-compose up -d"
