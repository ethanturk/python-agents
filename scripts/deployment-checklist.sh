#!/bin/bash
# Deployment Checklist and Validation Script
# Usage: ./deployment-checklist.sh <tenant_id>
#
# This script validates prerequisites before deploying an instance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TENANT_ID=${1:-"tenant1"}
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Multi-Instance Deployment Checklist${NC}"
echo -e "${BLUE}║  Tenant: $TENANT_ID${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# ============================================
# Section 1: Local Prerequisites
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  1. Local Prerequisites${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Vercel CLI
if command -v vercel &> /dev/null; then
    VERSION=$(vercel --version)
    check_pass "Vercel CLI installed (version: $VERSION)"
else
    check_fail "Vercel CLI not installed"
    echo "         Install with: npm i -g vercel"
fi

# Check Git
if command -v git &> /dev/null; then
    VERSION=$(git --version | cut -d' ' -f3)
    check_pass "Git installed (version: $VERSION)"
else
    check_fail "Git not installed"
fi

# Check Docker (optional, for local testing)
if command -v docker &> /dev/null; then
    VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    check_pass "Docker installed (version: $VERSION)"
else
    check_warn "Docker not installed (optional for local testing)"
fi

# Check if in repository
if [ -f "vercel.json" ] && [ -f "backend/config.py" ]; then
    check_pass "Running from python-agents repository"
else
    check_fail "Not in python-agents repository root"
    echo "         Run from repository root directory"
fi

# Check if scripts exist
if [ -f "scripts/provision-instance.sh" ]; then
    check_pass "Provisioning script found"
else
    check_fail "scripts/provision-instance.sh not found"
fi

if [ -f "scripts/add-worker-to-vps.sh" ]; then
    check_pass "Worker deployment script found"
else
    check_fail "scripts/add-worker-to-vps.sh not found"
fi

# Check if scripts are executable
if [ -x "scripts/provision-instance.sh" ]; then
    check_pass "Provisioning script is executable"
else
    check_warn "Provisioning script not executable"
    echo "         Run: chmod +x scripts/provision-instance.sh"
fi

echo ""

# ============================================
# Section 2: Vercel Account
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  2. Vercel Account${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Vercel authentication
if vercel whoami &> /dev/null; then
    USERNAME=$(vercel whoami)
    check_pass "Logged into Vercel as: $USERNAME"
else
    check_fail "Not logged into Vercel"
    echo "         Run: vercel login"
fi

echo ""
echo -e "${YELLOW}Manual checks required:${NC}"
echo "  [ ] Vercel account has available project slots (Hobby: 5 total, Pro: unlimited)"
echo "  [ ] Domain is configured in registrar for DNS management"
echo ""

# ============================================
# Section 3: Cloud Resources Checklist
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  3. Cloud Resources for $TENANT_ID${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}Supabase:${NC}"
echo "  [ ] Created project: ${TENANT_ID}-db"
echo "  [ ] Run SQL schema (CREATE TABLE documents, match_documents function)"
echo "  [ ] Copied Project URL (https://xxx.supabase.co)"
echo "  [ ] Copied Anon Key (Settings → API → anon key)"
echo "  [ ] Verified pgvector extension enabled"
echo ""

echo -e "${YELLOW}Azure Storage:${NC}"
echo "  [ ] Created storage account: ${TENANT_ID}storage"
echo "  [ ] Created container: documents"
echo "  [ ] Copied connection string (Access Keys → key1 → Connection string)"
echo "  [ ] Set to LRS redundancy (cheapest option)"
echo ""

echo -e "${YELLOW}Upstash Redis:${NC}"
echo "  [ ] Created database: ${TENANT_ID}-queue"
echo "  [ ] Chosen region close to VPS location"
echo "  [ ] Copied Redis URL (redis://default:xxx@...)"  # pragma: allowlist secret
echo ""

echo -e "${YELLOW}OpenAI (or LLM Provider):${NC}"
echo "  [ ] Have API key ready"
echo "  [ ] Decided if sharing key across tenants or per-tenant"
echo "  [ ] Verified billing/quota is sufficient"
echo ""

echo -e "${YELLOW}Firebase (Optional):${NC}"
echo "  [ ] Created Firebase project (or using existing)"
echo "  [ ] Generated service account key JSON"
echo "  [ ] Extracted project ID and private key"
echo ""

# ============================================
# Section 4: VPS Infrastructure
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  4. VPS Infrastructure${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}VPS Setup:${NC}"
echo "  [ ] VPS created (Hetzner CX11 or DigitalOcean Basic)"
echo "  [ ] Ubuntu 24.04 installed"
echo "  [ ] SSH key configured"
echo "  [ ] Docker installed"
echo "  [ ] Directory /root/workers created"
echo "  [ ] docker-compose.workers-multi.yml copied to VPS"
echo "  [ ] .env file created on VPS"
echo ""

# Try to check VPS connectivity if IP provided
read -p "Enter VPS IP address (or press Enter to skip): " VPS_IP
if [ -n "$VPS_IP" ]; then
    echo ""
    echo -e "${YELLOW}Testing VPS connectivity...${NC}"

    if ping -c 1 -W 2 "$VPS_IP" &> /dev/null; then
        check_pass "VPS is reachable at $VPS_IP"
    else
        check_warn "Cannot ping VPS at $VPS_IP (may be normal if ICMP blocked)"
    fi

    if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$VPS_IP" "echo 'SSH OK'" &> /dev/null; then
        check_pass "SSH connection successful"

        # Check Docker on VPS
        if ssh root@"$VPS_IP" "docker --version" &> /dev/null 2>&1; then
            DOCKER_VERSION=$(ssh root@"$VPS_IP" "docker --version" | cut -d' ' -f3 | tr -d ',')
            check_pass "Docker installed on VPS (version: $DOCKER_VERSION)"
        else
            check_fail "Docker not installed on VPS"
        fi

        # Check workers directory
        if ssh root@"$VPS_IP" "[ -d /root/workers ]" 2>/dev/null; then
            check_pass "Workers directory exists on VPS"
        else
            check_warn "Workers directory does not exist on VPS"
            echo "         Create with: ssh root@$VPS_IP 'mkdir -p /root/workers'"
        fi

    else
        check_fail "Cannot connect to VPS via SSH"
        echo "         Check SSH key and VPS firewall"
    fi
fi

echo ""

# ============================================
# Section 5: DNS Configuration
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  5. DNS Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "Enter subdomain for this instance (e.g., tenant1.example.com): " SUBDOMAIN
if [ -n "$SUBDOMAIN" ]; then
    echo ""
    echo -e "${YELLOW}After provisioning, add this DNS record:${NC}"
    echo "  Type: CNAME"
    echo "  Name: $(echo $SUBDOMAIN | cut -d'.' -f1)"
    echo "  Value: cname.vercel-dns.com"
    echo "  TTL: 300"
    echo ""
fi

# ============================================
# Summary
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "Checks passed:  ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks failed:  ${RED}$CHECKS_FAILED${NC}"
echo -e "Warnings:       ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Ensure all manual cloud resources are created"
    echo "  2. Run provisioning script:"
    echo "     ./scripts/provision-instance.sh $TENANT_ID $SUBDOMAIN"
    echo "  3. Configure DNS as shown above"
    echo "  4. Deploy worker to VPS:"
    echo "     ./scripts/add-worker-to-vps.sh $TENANT_ID $VPS_IP --deploy"
    echo "  5. Verify deployment with test script:"
    echo "     ./scripts/verify-instance.sh $TENANT_ID $SUBDOMAIN"
    echo ""
else
    echo -e "${RED}✗ Some checks failed. Please resolve issues before proceeding.${NC}"
    echo ""
    exit 1
fi
