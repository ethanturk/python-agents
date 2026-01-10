#!/bin/bash
# Instance Verification Script
# Usage: ./verify-instance.sh <tenant_id> <subdomain> [vps_ip]
#
# This script verifies that an instance is correctly deployed and operational

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TENANT_ID=$1
SUBDOMAIN=$2
VPS_IP=${3:-""}

if [ -z "$TENANT_ID" ] || [ -z "$SUBDOMAIN" ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo "Usage: $0 <tenant_id> <subdomain> [vps_ip]"
    echo "Example: $0 tenant1 tenant1.example.com 192.168.1.100"
    exit 1
fi

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Instance Verification${NC}"
echo -e "${BLUE}║  Tenant: $TENANT_ID${NC}"
echo -e "${BLUE}║  Domain: $SUBDOMAIN${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

test_skip() {
    echo -e "${YELLOW}⊘${NC} $1"
    ((TESTS_SKIPPED++))
}

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required for testing${NC}"
    echo "Install with: sudo apt-get install curl"
    exit 1
fi

# ============================================
# Section 1: DNS Resolution
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  1. DNS Resolution${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test DNS resolution
if host "$SUBDOMAIN" > /dev/null 2>&1; then
    IP=$(host "$SUBDOMAIN" | grep "has address" | awk '{print $4}' | head -1)
    if [ -n "$IP" ]; then
        test_pass "DNS resolves: $SUBDOMAIN → $IP"
    else
        IP=$(host "$SUBDOMAIN" | grep "is an alias" | awk '{print $6}' | head -1)
        if [ -n "$IP" ]; then
            test_pass "DNS resolves: $SUBDOMAIN (CNAME: $IP)"
        else
            test_fail "DNS configured but no A/CNAME record found"
        fi
    fi
else
    test_fail "DNS resolution failed for $SUBDOMAIN"
    echo "         Add CNAME record: $(echo $SUBDOMAIN | cut -d'.' -f1) → cname.vercel-dns.com"
fi

echo ""

# ============================================
# Section 2: Frontend Accessibility
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  2. Frontend Accessibility${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test HTTPS connection
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$SUBDOMAIN" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_pass "Frontend accessible (HTTP 200)"
elif [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    test_pass "Frontend redirects (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
    test_fail "Cannot connect to https://$SUBDOMAIN"
else
    test_fail "Frontend returned HTTP $HTTP_CODE"
fi

# Test SSL certificate
if curl -s -k "https://$SUBDOMAIN" > /dev/null 2>&1; then
    CERT_INFO=$(echo | openssl s_client -servername "$SUBDOMAIN" -connect "$SUBDOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    if [ -n "$CERT_INFO" ]; then
        test_pass "SSL certificate valid"
    else
        test_skip "Could not verify SSL certificate"
    fi
else
    test_fail "SSL connection failed"
fi

# Test if React app loads
CONTENT=$(curl -s "https://$SUBDOMAIN" || echo "")
if echo "$CONTENT" | grep -q "<!doctype html>" || echo "$CONTENT" | grep -q "<div id=\"root\""; then
    test_pass "HTML content returned (React app structure detected)"
else
    test_fail "Unexpected content returned (may not be React app)"
fi

echo ""

# ============================================
# Section 3: API Endpoints
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  3. API Endpoints${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test API health endpoint
API_RESPONSE=$(curl -s "https://$SUBDOMAIN/api/health" || echo "")
if [ -n "$API_RESPONSE" ]; then
    test_pass "API endpoint responds"
    echo "         Response: $API_RESPONSE"
else
    test_fail "API health endpoint not responding"
fi

# Test API docs (FastAPI Swagger)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$SUBDOMAIN/api/docs" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_pass "API documentation accessible at /api/docs"
elif [ "$HTTP_CODE" = "307" ]; then
    test_pass "API documentation accessible (redirects)"
else
    test_skip "API documentation not accessible (may be disabled)"
fi

echo ""

# ============================================
# Section 4: Worker Status (if VPS IP provided)
# ============================================
if [ -n "$VPS_IP" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  4. Worker Status (VPS: $VPS_IP)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Test SSH connectivity
    if ssh -o ConnectTimeout=5 root@"$VPS_IP" "echo 'SSH OK'" > /dev/null 2>&1; then
        test_pass "VPS accessible via SSH"

        # Check if worker container exists
        CONTAINER_EXISTS=$(ssh root@"$VPS_IP" "docker ps -a --filter name=worker-$TENANT_ID --format '{{.Names}}'" 2>/dev/null || echo "")
        if [ "$CONTAINER_EXISTS" = "worker-$TENANT_ID" ]; then
            test_pass "Worker container exists: worker-$TENANT_ID"

            # Check if worker is running
            CONTAINER_STATUS=$(ssh root@"$VPS_IP" "docker ps --filter name=worker-$TENANT_ID --format '{{.Status}}'" 2>/dev/null || echo "")
            if [[ "$CONTAINER_STATUS" =~ "Up" ]]; then
                test_pass "Worker container is running"
                echo "         Status: $CONTAINER_STATUS"
            else
                test_fail "Worker container is not running"
                echo "         Start with: docker start worker-$TENANT_ID"
            fi

            # Check worker health
            HEALTH_STATUS=$(ssh root@"$VPS_IP" "docker inspect --format='{{.State.Health.Status}}' worker-$TENANT_ID" 2>/dev/null || echo "none")
            if [ "$HEALTH_STATUS" = "healthy" ]; then
                test_pass "Worker health check: healthy"
            elif [ "$HEALTH_STATUS" = "none" ]; then
                test_skip "Worker health check not configured"
            else
                test_fail "Worker health check: $HEALTH_STATUS"
            fi

            # Check Celery worker is responding
            CELERY_PING=$(ssh root@"$VPS_IP" "docker exec worker-$TENANT_ID celery -A async_tasks inspect ping 2>/dev/null" || echo "")
            if echo "$CELERY_PING" | grep -q "pong"; then
                test_pass "Celery worker responds to ping"
            else
                test_fail "Celery worker not responding"
                echo "         Check logs: docker logs worker-$TENANT_ID"
            fi

        else
            test_fail "Worker container not found: worker-$TENANT_ID"
            echo "         Deploy with: ./scripts/add-worker-to-vps.sh $TENANT_ID $VPS_IP --deploy"
        fi

    else
        test_fail "Cannot connect to VPS via SSH"
    fi

    echo ""
fi

# ============================================
# Section 5: Environment Configuration
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  $(if [ -n "$VPS_IP" ]; then echo "5"; else echo "4"; fi). Environment Configuration Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}Vercel Environment Variables:${NC}"
echo "  Check in Vercel dashboard or run:"
echo "  vercel env ls production --project python-agents-$TENANT_ID"
echo ""

if [ -n "$VPS_IP" ]; then
    echo -e "${YELLOW}VPS Environment Variables:${NC}"
    echo "  SSH to VPS and check .env file:"
    echo "  ssh root@$VPS_IP 'cat /root/workers/.env | grep ${TENANT_ID^^}'"
fi

echo ""

# ============================================
# Section 6: Integration Test (Optional)
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  $(if [ -n "$VPS_IP" ]; then echo "6"; else echo "5"; fi). Integration Test (Optional)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "Run integration test (requires authentication)? (y/N): " RUN_INTEGRATION
if [[ "$RUN_INTEGRATION" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Integration test requires:${NC}"
    echo "  1. Valid authentication token"
    echo "  2. Test document to upload"
    echo "  3. Configured Supabase and Azure Storage"
    echo ""
    echo "Manual test steps:"
    echo "  1. Open browser: https://$SUBDOMAIN"
    echo "  2. Log in with Firebase credentials"
    echo "  3. Upload a test document"
    echo "  4. Verify file appears in Azure Storage"
    echo "  5. Trigger ingestion task"
    echo "  6. Check worker logs: docker logs worker-$TENANT_ID -f"
    echo "  7. Verify embeddings in Supabase"
    echo "  8. Test RAG query"
    echo ""
else
    echo -e "${YELLOW}⊘${NC} Integration test skipped"
fi

echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "Tests passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed:  ${RED}$TESTS_FAILED${NC}"
echo -e "Tests skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Instance appears to be operational.${NC}"
    echo ""
    echo -e "${BLUE}Access Points:${NC}"
    echo "  Frontend: https://$SUBDOMAIN"
    echo "  API Docs: https://$SUBDOMAIN/api/docs"
    if [ -n "$VPS_IP" ]; then
        echo "  Flower:   ssh -L 5555:localhost:5555 root@$VPS_IP (then http://localhost:5555)"
        echo "  Logs:     docker logs worker-$TENANT_ID -f"
    fi
    echo ""
else
    echo -e "${RED}✗ Some tests failed. Review errors above.${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check Vercel deployment logs: vercel logs python-agents-$TENANT_ID"
    echo "  2. Check environment variables: vercel env ls production"
    echo "  3. Verify DNS propagation: dig $SUBDOMAIN"
    if [ -n "$VPS_IP" ]; then
        echo "  4. Check worker logs: ssh root@$VPS_IP 'docker logs worker-$TENANT_ID -f'"
        echo "  5. Check worker env vars: ssh root@$VPS_IP 'docker exec worker-$TENANT_ID env | grep CELERY'"
    fi
    echo ""
    exit 1
fi
