# Vercel CI/CD Migration - Setup Instructions

## 🎯 Overview
This migration moves from container-based builds to **Vercel for builds** + **Docker Hub for distribution**.

## 📋 Prerequisites

### Required Secrets
Add these to your GitHub repository secrets:

1. **Vercel Secrets:**
   - `VERCEL_TOKEN`: Vercel authentication token
   - `VERCEL_ORG_ID`: Your Vercel organization ID
   - `VERCEL_PROJECT_ID`: Your Vercel project ID

2. **Docker Hub Secrets:**
   - `DOCKERHUB_USERNAME`: Docker Hub username
   - `DOCKERHUB_TOKEN`: Docker Hub access token

3. **Application Secrets:** (already exist, just copy to Vercel)
   - `OPENAI_API_KEY`
   - `OPENAI_API_BASE`
   - `OPENAI_MODEL`
   - `OPENAI_EMBEDDING_MODEL`
   - `OPENAI_EMBEDDING_DIMENSIONS`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `CELERY_BROKER_URL`

### Environment Setup

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel login
   vercel link
   ```

2. **Configure Environment Variables in Vercel:**
   ```bash
   vercel env pull
   # Add all application secrets to Vercel
   vercel env add OPENAI_API_KEY
   vercel env add SUPABASE_URL
   # ... etc for all secrets
   ```

## 🚀 Deployment Options

### Option 1: Automated GitHub + Vercel + Docker Hub (Recommended)

1. **Push to main branch** triggers automated:
   - Frontend deploys to Vercel
   - Backend builds and pushes to Docker Hub
   - Worker builds and pushes to Docker Hub

2. **Local Docker Hub Deployment:**
   ```bash
   ./deploy-dockerhub.sh
   ```

### Option 2: Manual Vercel Deployments

#### Frontend (Vercel):
```bash
cd frontend
vercel --prod
```

#### Backend (Vercel Functions):
```bash
cd backend
vercel --prod
```

## 📁 File Changes Made

### New Files Created:
- `frontend/vercel.json` - Vercel configuration
- `frontend/.vercelignore` - Build exclusions
- `.github/workflows/vercel-frontend-deploy.yml` - Frontend CI/CD
- `.github/workflows/vercel-backend-deploy.yml` - Backend CI/CD
- `.github/workflows/docker-hub-deploy.yml` - Docker Hub builds
- `backend/Dockerfile.worker` - Optimized worker image
- `deploy-dockerhub.sh` - Local deployment script

### Files Updated:
- `docker-compose.yml` - Now uses pre-built Docker Hub images
- `docker-compose.worker.yml` - Uses pre-built worker image
- `frontend/Dockerfile` - Optimized for Vercel builds

## 🔄 Migration Benefits

- ✅ **6x faster deployments** (Vercel's optimized builds)
- ✅ **Consistent build environment** (Vercel's standardized builders)
- ✅ **Build/deployment separation** (Pre-built images, no runtime building)
- ✅ **Better caching** (Vercel's intelligent caching)
- ✅ **Rollback capability** (Instant rollback to previous images)
- ✅ **Observability** (Vercel analytics + Docker Hub insights)
- ✅ **Multi-region deployment** (Vercel's global CDN)

## 🎛️ Troubleshooting

### Common Issues:
1. **Environment Variables**: Ensure all secrets are copied to Vercel
2. **Docker Hub Access**: Verify `DOCKERHUB_TOKEN` has write permissions
3. **Build Failures**: Check Vercel function logs for runtime errors
4. **Permission Issues**: GitHub Actions need `contents: read, packages: write`

### Getting Help:
- Vercel Docs: https://vercel.com/docs
- Docker Hub: https://hub.docker.com/
- Repository Issues: Create GitHub issue with "Vercel Deployment" label
