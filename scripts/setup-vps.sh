#!/bin/bash
# VPS Setup Automation Script
# Usage: ./setup-vps.sh <vps_ip>
#
# This script automates the initial VPS setup:
# 1. Install Docker and Docker Compose
# 2. Create workers directory structure
# 3. Copy configuration files
# 4. Configure firewall
# 5. Pull worker Docker images

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VPS_IP=$1

if [ -z "$VPS_IP" ]; then
    echo -e "${RED}Error: VPS IP address required${NC}"
    echo "Usage: $0 <vps_ip>"
    echo "Example: $0 192.168.1.100"
    exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  VPS Setup Automation${NC}"
echo -e "${BLUE}║  Target: $VPS_IP${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we can connect
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=10 root@"$VPS_IP" "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to VPS via SSH${NC}"
    echo "Please check:"
    echo "  - VPS IP is correct: $VPS_IP"
    echo "  - SSH key is configured"
    echo "  - VPS is running and accessible"
    echo "  - Firewall allows SSH (port 22)"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"
echo ""

# ============================================
# Step 1: System Update
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 1: Updating System${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ssh root@"$VPS_IP" bash << 'EOF'
export DEBIAN_FRONTEND=noninteractive
echo "Updating package lists..."
apt-get update -qq

echo "Upgrading packages..."
apt-get upgrade -y -qq

echo "Installing prerequisites..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release
EOF

echo -e "${GREEN}✓ System updated${NC}"
echo ""

# ============================================
# Step 2: Install Docker
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 2: Installing Docker${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ssh root@"$VPS_IP" bash << 'EOF'
# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "Docker is already installed: $(docker --version)"
    exit 0
fi

echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

echo "Enabling Docker service..."
systemctl enable docker
systemctl start docker

echo "Docker installed: $(docker --version)"
echo "Docker Compose installed: $(docker-compose --version)"
EOF

echo -e "${GREEN}✓ Docker installed${NC}"
echo ""

# ============================================
# Step 3: Create Directory Structure
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 3: Creating Directory Structure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ssh root@"$VPS_IP" bash << 'EOF'
echo "Creating /root/workers directory..."
mkdir -p /root/workers
cd /root/workers

echo "Directory created: /root/workers"
EOF

echo -e "${GREEN}✓ Directory structure created${NC}"
echo ""

# ============================================
# Step 4: Copy Configuration Files
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 4: Copying Configuration Files${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if files exist locally
if [ ! -f "docker-compose.workers-multi.yml" ]; then
    echo -e "${RED}✗ docker-compose.workers-multi.yml not found${NC}"
    echo "Run this script from the repository root"
    exit 1
fi

if [ ! -f ".env.workers-multi.example" ]; then
    echo -e "${RED}✗ .env.workers-multi.example not found${NC}"
    echo "Run this script from the repository root"
    exit 1
fi

echo "Copying docker-compose.workers-multi.yml..."
scp docker-compose.workers-multi.yml root@"$VPS_IP":/root/workers/

echo "Copying .env.workers-multi.example as .env..."
scp .env.workers-multi.example root@"$VPS_IP":/root/workers/.env

echo -e "${GREEN}✓ Configuration files copied${NC}"
echo ""

# ============================================
# Step 5: Pull Docker Images
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 5: Pulling Docker Images${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ssh root@"$VPS_IP" bash << 'EOF'
cd /root/workers

echo "Pulling worker image..."
docker pull ethanturk/python-agents-worker:latest

echo "Pulling Flower image..."
docker pull mher/flower:latest

echo "Images pulled successfully"
docker images | grep -E "worker|flower"
EOF

echo -e "${GREEN}✓ Docker images pulled${NC}"
echo ""

# ============================================
# Step 6: Configure Firewall (Optional)
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 6: Configuring Firewall${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "Configure UFW firewall? (y/N): " CONFIGURE_UFW
if [[ "$CONFIGURE_UFW" =~ ^[Yy]$ ]]; then
    ssh root@"$VPS_IP" bash << 'EOF'
echo "Configuring UFW firewall..."

# Install UFW if not present
if ! command -v ufw &> /dev/null; then
    apt-get install -y ufw
fi

# Allow SSH
ufw allow 22/tcp

# Don't allow Flower from external (use SSH tunnel instead)
# ufw allow 5555/tcp

# Enable firewall
echo "y" | ufw enable

# Show status
ufw status
EOF
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ Skipping firewall configuration${NC}"
fi

echo ""

# ============================================
# Step 7: Create Initial .env Template
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 7: Environment Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}IMPORTANT: Update /root/workers/.env with actual credentials${NC}"
echo ""
echo "Current .env file is a template. You need to:"
echo "  1. SSH to VPS: ssh root@$VPS_IP"
echo "  2. Edit .env: nano /root/workers/.env"
echo "  3. Replace placeholder values with actual credentials"
echo "  4. Save and exit (Ctrl+O, Enter, Ctrl+X)"
echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  VPS Setup Complete!${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ System updated${NC}"
echo -e "${GREEN}✓ Docker installed${NC}"
echo -e "${GREEN}✓ Directory structure created${NC}"
echo -e "${GREEN}✓ Configuration files copied${NC}"
echo -e "${GREEN}✓ Docker images pulled${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Update environment variables:"
echo "   ssh root@$VPS_IP"
echo "   nano /root/workers/.env"
echo ""
echo "2. Add tenant-specific workers:"
echo "   ./scripts/add-worker-to-vps.sh tenant1 $VPS_IP --deploy"
echo ""
echo "3. Start workers:"
echo "   ssh root@$VPS_IP 'cd /root/workers && docker-compose -f docker-compose.workers-multi.yml up -d'"
echo ""
echo "4. Monitor workers:"
echo "   ssh root@$VPS_IP 'docker ps'"
echo "   ssh -L 5555:localhost:5555 root@$VPS_IP  # Then visit http://localhost:5555"
echo ""
echo -e "${GREEN}VPS is ready for multi-instance worker deployment!${NC}"
