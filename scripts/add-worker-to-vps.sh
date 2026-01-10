#!/bin/bash
# Add Worker to VPS Script
# Usage: ./add-worker-to-vps.sh <tenant_id> <vps_ip>
#
# Example: ./add-worker-to-vps.sh tenant1 192.168.1.100
#
# This script:
# 1. Generates worker configuration for docker-compose.workers-multi.yml
# 2. Generates .env template for the tenant
# 3. Provides instructions for deployment
#
# Note: This script generates configuration locally.
# You'll need to manually add it to the VPS or use the --deploy flag.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
TENANT_ID=$1
VPS_IP=$2
DEPLOY_FLAG=${3:-""}

if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}Error: Missing tenant ID${NC}"
    echo "Usage: $0 <tenant_id> [vps_ip] [--deploy]"
    echo "Example: $0 tenant1 192.168.1.100"
    echo "Example: $0 tenant1 192.168.1.100 --deploy"
    exit 1
fi

TENANT_ID_UPPER=$(echo "$TENANT_ID" | tr '[:lower:]' '[:upper:]')
QUEUE_NAME="${TENANT_ID}_queue"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Adding Worker Configuration: $TENANT_ID${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Generate worker configuration
WORKER_CONFIG=$(cat <<EOF

  # Worker for $TENANT_ID
  worker-$TENANT_ID:
    image: ethanturk/python-agents-worker:latest
    container_name: worker-$TENANT_ID
    pull_policy: always
    command: ["celery", "-A", "async_tasks", "worker", "--loglevel=info", "-Q", "$QUEUE_NAME"]
    environment:
      CELERY_BROKER_URL: \${${TENANT_ID_UPPER}_CELERY_BROKER_URL}
      CELERY_QUEUE_NAME: $QUEUE_NAME
      OPENAI_API_KEY: \${${TENANT_ID_UPPER}_OPENAI_API_KEY}
      OPENAI_API_BASE: \${${TENANT_ID_UPPER}_OPENAI_API_BASE:-https://api.openai.com/v1}
      OPENAI_MODEL: \${${TENANT_ID_UPPER}_OPENAI_MODEL:-gpt-4o-mini}
      OPENAI_EMBEDDING_MODEL: \${${TENANT_ID_UPPER}_OPENAI_EMBEDDING_MODEL:-text-embedding-3-small}
      OPENAI_EMBEDDING_DIMENSIONS: \${${TENANT_ID_UPPER}_OPENAI_EMBEDDING_DIMENSIONS:-1536}
      SUPABASE_URL: \${${TENANT_ID_UPPER}_SUPABASE_URL}
      SUPABASE_KEY: \${${TENANT_ID_UPPER}_SUPABASE_KEY}
      AZURE_STORAGE_CONNECTION_STRING: \${${TENANT_ID_UPPER}_AZURE_STORAGE_CONNECTION_STRING}
      AZURE_STORAGE_ACCOUNT_NAME: \${${TENANT_ID_UPPER}_AZURE_STORAGE_ACCOUNT_NAME}
      AZURE_STORAGE_CONTAINER_NAME: \${${TENANT_ID_UPPER}_AZURE_STORAGE_CONTAINER_NAME:-documents}
      VECTOR_TABLE_NAME: \${${TENANT_ID_UPPER}_VECTOR_TABLE_NAME:-documents}
    restart: unless-stopped
    networks:
      - workers
    healthcheck:
      test: ["CMD-SHELL", "celery -A async_tasks inspect ping -d celery@\\\$\\\$HOSTNAME || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF
)

# Generate .env template
ENV_TEMPLATE=$(cat <<EOF

# ============================================
# $TENANT_ID_UPPER Configuration
# ============================================
${TENANT_ID_UPPER}_CELERY_BROKER_URL=redis://default:password@us1-$TENANT_ID.upstash.io:12345  # pragma: allowlist secret
${TENANT_ID_UPPER}_OPENAI_API_KEY=sk-proj-xxx
${TENANT_ID_UPPER}_OPENAI_API_BASE=https://api.openai.com/v1
${TENANT_ID_UPPER}_OPENAI_MODEL=gpt-4o-mini
${TENANT_ID_UPPER}_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
${TENANT_ID_UPPER}_OPENAI_EMBEDDING_DIMENSIONS=1536
${TENANT_ID_UPPER}_SUPABASE_URL=https://xxx.supabase.co
${TENANT_ID_UPPER}_SUPABASE_KEY=eyJhbGci...
${TENANT_ID_UPPER}_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=${TENANT_ID}storage;AccountKey=xxx;EndpointSuffix=core.windows.net
${TENANT_ID_UPPER}_AZURE_STORAGE_ACCOUNT_NAME=${TENANT_ID}storage
${TENANT_ID_UPPER}_AZURE_STORAGE_CONTAINER_NAME=documents
${TENANT_ID_UPPER}_VECTOR_TABLE_NAME=documents
EOF
)

# Save configurations to temporary files
TEMP_WORKER_FILE="/tmp/worker-$TENANT_ID.yml"
TEMP_ENV_FILE="/tmp/worker-$TENANT_ID.env"

echo "$WORKER_CONFIG" > "$TEMP_WORKER_FILE"
echo "$ENV_TEMPLATE" > "$TEMP_ENV_FILE"

echo -e "${GREEN}✓ Worker configuration generated${NC}"
echo ""

# Display the configurations
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Docker Compose Worker Configuration${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Add the following to docker-compose.workers-multi.yml:${NC}"
echo "$WORKER_CONFIG"
echo ""

echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Environment Variables Template${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Add the following to /root/workers/.env on VPS:${NC}"
echo "$ENV_TEMPLATE"
echo ""

# If VPS IP provided and deploy flag set, attempt deployment
if [ -n "$VPS_IP" ] && [ "$DEPLOY_FLAG" == "--deploy" ]; then
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Deploying to VPS${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${YELLOW}Connecting to $VPS_IP...${NC}"

    # Check SSH connection
    if ! ssh -o ConnectTimeout=5 root@"$VPS_IP" "echo 'SSH connection successful'" > /dev/null 2>&1; then
        echo -e "${RED}Error: Cannot connect to VPS at $VPS_IP${NC}"
        echo "Please check:"
        echo "  - VPS IP is correct"
        echo "  - SSH key is configured"
        echo "  - VPS is accessible"
        exit 1
    fi

    echo -e "${YELLOW}Backing up existing configuration...${NC}"
    ssh root@"$VPS_IP" "cd /root/workers && cp docker-compose.workers-multi.yml docker-compose.workers-multi.yml.backup-$(date +%Y%m%d-%H%M%S)"

    echo -e "${YELLOW}Adding worker configuration...${NC}"
    ssh root@"$VPS_IP" "cd /root/workers && cat >> docker-compose.workers-multi.yml" < "$TEMP_WORKER_FILE"

    echo -e "${YELLOW}Adding environment variables...${NC}"
    echo -e "${RED}WARNING: You need to manually update the .env file with actual credentials${NC}"
    ssh root@"$VPS_IP" "cd /root/workers && cat >> .env.template" < "$TEMP_ENV_FILE"

    echo ""
    echo -e "${GREEN}✓ Configuration deployed to VPS${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. SSH to VPS: ssh root@$VPS_IP"
    echo "  2. Edit .env file: nano /root/workers/.env"
    echo "  3. Add the credentials from .env.template"
    echo "  4. Restart workers: docker-compose -f docker-compose.workers-multi.yml up -d"
    echo "  5. Check logs: docker logs worker-$TENANT_ID -f"

elif [ -n "$VPS_IP" ]; then
    # VPS IP provided but no deploy flag
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Manual Deployment Instructions${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}To deploy manually:${NC}"
    echo ""
    echo "1. Copy worker configuration to VPS:"
    echo "   scp $TEMP_WORKER_FILE root@$VPS_IP:/root/workers/worker-$TENANT_ID.yml"
    echo ""
    echo "2. SSH to VPS and append to docker-compose.workers-multi.yml:"
    echo "   ssh root@$VPS_IP"
    echo "   cd /root/workers"
    echo "   cat worker-$TENANT_ID.yml >> docker-compose.workers-multi.yml"
    echo ""
    echo "3. Add environment variables to .env file:"
    echo "   nano .env"
    echo "   # Copy the environment template shown above"
    echo ""
    echo "4. Restart workers:"
    echo "   docker-compose -f docker-compose.workers-multi.yml up -d"
    echo ""
    echo "5. Verify worker is running:"
    echo "   docker ps | grep worker-$TENANT_ID"
    echo "   docker logs worker-$TENANT_ID -f"
    echo ""
    echo -e "${YELLOW}Or run with --deploy flag for automated deployment:${NC}"
    echo "   $0 $TENANT_ID $VPS_IP --deploy"

else
    # No VPS IP provided
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Deployment Instructions${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Configuration files saved:${NC}"
    echo "  Worker config: $TEMP_WORKER_FILE"
    echo "  Environment template: $TEMP_ENV_FILE"
    echo ""
    echo -e "${YELLOW}To deploy:${NC}"
    echo "  1. Manually copy the configurations shown above to your VPS"
    echo "  2. Or run: $0 $TENANT_ID <vps_ip> --deploy"
fi

echo ""
echo -e "${GREEN}✓ Worker configuration complete!${NC}"
