#!/bin/bash
# Multi-Instance Provisioning Script
# Usage: ./provision-instance.sh <tenant_id> <subdomain> [vercel_team]
#
# Example: ./provision-instance.sh tenant1 tenant1.example.com
#
# This script automates:
# 1. Creating a new Vercel project
# 2. Configuring environment variables
# 3. Deploying to production
# 4. Adding custom domain
#
# Prerequisites:
# - Vercel CLI installed (npm i -g vercel)
# - Authenticated with Vercel (vercel login)
# - Already created: Supabase project, Azure Storage, Upstash Redis

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
TENANT_ID=$1
SUBDOMAIN=$2
VERCEL_TEAM=${3:-""}

if [ -z "$TENANT_ID" ] || [ -z "$SUBDOMAIN" ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo "Usage: $0 <tenant_id> <subdomain> [vercel_team]"
    echo "Example: $0 tenant1 tenant1.example.com"
    exit 1
fi

PROJECT_NAME="python-agents-$TENANT_ID"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Multi-Instance Provisioning: $TENANT_ID${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Project Name:${NC} $PROJECT_NAME"
echo -e "${YELLOW}Subdomain:${NC} $SUBDOMAIN"
echo -e "${YELLOW}Queue Name:${NC} ${TENANT_ID}_queue"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI not found${NC}"
    echo "Install with: npm i -g vercel"
    exit 1
fi

# Prompt for all required credentials upfront
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 1: Collecting Configuration${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Enter Upstash Redis URL (CELERY_BROKER_URL):${NC}"
echo "Example: redis://default:password@us1-tenant1.upstash.io:12345"  # pragma: allowlist secret
read -r CELERY_BROKER_URL

echo ""
echo -e "${YELLOW}Enter Supabase Project URL:${NC}"
echo "Example: https://xxx.supabase.co"
read -r SUPABASE_URL

echo ""
echo -e "${YELLOW}Enter Supabase Anon Key:${NC}"
read -rs SUPABASE_KEY
echo ""

echo ""
echo -e "${YELLOW}Enter Azure Storage Connection String:${NC}"
read -rs AZURE_CONN
echo ""

echo ""
echo -e "${YELLOW}Enter Azure Storage Account Name:${NC}"
echo "Example: tenant1storage"
read -r AZURE_ACCOUNT_NAME

echo ""
echo -e "${YELLOW}Enter OpenAI API Key (or press Enter to use shared key):${NC}"
read -rs OPENAI_KEY
echo ""

# Optional: Firebase configuration
echo ""
echo -e "${YELLOW}Enter Firebase Project ID (or press Enter to skip):${NC}"
read -r FIREBASE_PROJECT_ID

if [ -n "$FIREBASE_PROJECT_ID" ]; then
    echo -e "${YELLOW}Enter Firebase Private Key (JSON format):${NC}"
    read -rs FIREBASE_PRIVATE_KEY
    echo ""
fi

# Set defaults for optional values
OPENAI_API_BASE=${OPENAI_API_BASE:-"https://api.openai.com/v1"}
OPENAI_MODEL=${OPENAI_MODEL:-"gpt-4o-mini"}
OPENAI_EMBEDDING_MODEL=${OPENAI_EMBEDDING_MODEL:-"text-embedding-3-small"}
OPENAI_EMBEDDING_DIMENSIONS=${OPENAI_EMBEDDING_DIMENSIONS:-"1536"}
AZURE_CONTAINER=${AZURE_CONTAINER:-"documents"}

echo ""
echo -e "${GREEN}✓ Configuration collected${NC}"
echo ""

# Create Vercel project
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 2: Creating Vercel Project${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

VERCEL_ARGS="--name $PROJECT_NAME"
if [ -n "$VERCEL_TEAM" ]; then
    VERCEL_ARGS="$VERCEL_ARGS --scope $VERCEL_TEAM"
fi

echo -e "${YELLOW}Running: vercel $VERCEL_ARGS${NC}"
vercel $VERCEL_ARGS --yes

echo ""
echo -e "${GREEN}✓ Vercel project created${NC}"
echo ""

# Configure environment variables
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 3: Configuring Environment Variables${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

# Helper function to add env var
add_env() {
    local key=$1
    local value=$2
    local env_type=${3:-production}

    echo -e "${YELLOW}Setting $key...${NC}"
    echo "$value" | vercel env add "$key" "$env_type" $VERCEL_ARGS --yes
}

# Required environment variables
add_env "CELERY_BROKER_URL" "$CELERY_BROKER_URL" "production"
add_env "CELERY_QUEUE_NAME" "${TENANT_ID}_queue" "production"
add_env "SUPABASE_URL" "$SUPABASE_URL" "production"
add_env "SUPABASE_KEY" "$SUPABASE_KEY" "production"
add_env "AZURE_STORAGE_CONNECTION_STRING" "$AZURE_CONN" "production"
add_env "AZURE_STORAGE_ACCOUNT_NAME" "$AZURE_ACCOUNT_NAME" "production"
add_env "AZURE_STORAGE_CONTAINER_NAME" "$AZURE_CONTAINER" "production"

# OpenAI configuration
if [ -n "$OPENAI_KEY" ]; then
    add_env "OPENAI_API_KEY" "$OPENAI_KEY" "production"
fi
add_env "OPENAI_API_BASE" "$OPENAI_API_BASE" "production"
add_env "OPENAI_MODEL" "$OPENAI_MODEL" "production"
add_env "OPENAI_EMBEDDING_MODEL" "$OPENAI_EMBEDDING_MODEL" "production"
add_env "OPENAI_EMBEDDING_DIMENSIONS" "$OPENAI_EMBEDDING_DIMENSIONS" "production"

# Optional: Firebase configuration
if [ -n "$FIREBASE_PROJECT_ID" ]; then
    add_env "FIREBASE_PROJECT_ID" "$FIREBASE_PROJECT_ID" "production"
    add_env "FIREBASE_PRIVATE_KEY" "$FIREBASE_PRIVATE_KEY" "production"
fi

# Optional: Vector table name
add_env "VECTOR_TABLE_NAME" "documents" "production"

echo ""
echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# Deploy to production
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 4: Deploying to Production${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Running: vercel --prod${NC}"
DEPLOYMENT_URL=$(vercel --prod $VERCEL_ARGS --yes)

echo ""
echo -e "${GREEN}✓ Deployed to: $DEPLOYMENT_URL${NC}"
echo ""

# Add custom domain
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 5: Adding Custom Domain${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Adding domain: $SUBDOMAIN${NC}"
vercel domains add "$SUBDOMAIN" $VERCEL_ARGS || echo -e "${YELLOW}Note: Domain may already exist or need DNS verification${NC}"

echo ""
echo -e "${GREEN}✓ Domain configured${NC}"
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Instance Provisioned Successfully!${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Instance Details:${NC}"
echo -e "  Tenant ID: ${YELLOW}$TENANT_ID${NC}"
echo -e "  Project: ${YELLOW}$PROJECT_NAME${NC}"
echo -e "  Domain: ${YELLOW}$SUBDOMAIN${NC}"
echo -e "  Queue: ${YELLOW}${TENANT_ID}_queue${NC}"
echo -e "  Deployment: ${YELLOW}$DEPLOYMENT_URL${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Add DNS record for $SUBDOMAIN:"
echo "     Type: CNAME"
echo "     Name: $(echo $SUBDOMAIN | cut -d'.' -f1)"
echo "     Value: cname.vercel-dns.com"
echo "     TTL: 300"
echo ""
echo "  2. Add worker to VPS:"
echo "     Run: ./scripts/add-worker-to-vps.sh $TENANT_ID <vps-ip>"
echo ""
echo "  3. Update VPS .env file with:"
echo "     ${TENANT_ID^^}_CELERY_BROKER_URL=$CELERY_BROKER_URL"
echo "     ${TENANT_ID^^}_OPENAI_API_KEY=<key>"
echo "     ${TENANT_ID^^}_SUPABASE_URL=$SUPABASE_URL"
echo "     ${TENANT_ID^^}_SUPABASE_KEY=<key>"
echo "     ${TENANT_ID^^}_AZURE_STORAGE_CONNECTION_STRING=<connection-string>"
echo "     ${TENANT_ID^^}_AZURE_STORAGE_ACCOUNT_NAME=$AZURE_ACCOUNT_NAME"
echo ""
echo "  4. Restart VPS workers:"
echo "     ssh root@<vps-ip> 'cd /root/workers && docker-compose -f docker-compose.workers-multi.yml up -d'"
echo ""
echo -e "${GREEN}✓ Provisioning complete!${NC}"
