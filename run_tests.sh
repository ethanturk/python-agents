#!/bin/bash
# Test runner script for python-agents project
# Supports running unit tests, integration tests, and E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="unit"
COVERAGE=false
VERBOSE=false
CONTAINERS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            shift
            ;;
        --e2e)
            TEST_TYPE="e2e"
            shift
            ;;
        --all)
            TEST_TYPE="all"
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --containers)
            CONTAINERS=true
            shift
            ;;
        --help)
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --unit         Run unit tests (default, uses mocks)"
            echo "  --integration  Run integration tests (requires test containers)"
            echo "  --e2e          Run end-to-end tests (requires full system)"
            echo "  --all          Run all tests"
            echo "  --coverage     Generate coverage report"
            echo "  --verbose      Show verbose output"
            echo "  --containers   Start test containers before running"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to start test containers
start_containers() {
    echo -e "${YELLOW}Starting test containers...${NC}"
    docker-compose -f docker-compose.test.yml up -d
    
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 5
    
    # Wait for database
    echo "Waiting for PostgreSQL..."
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec test-db pg_isready -U test_user > /dev/null 2>&1; then
            echo -e "${GREEN}PostgreSQL is ready!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}PostgreSQL did not become ready${NC}"
        exit 1
    fi
    
    # Wait for RabbitMQ
    echo "Waiting for RabbitMQ..."
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec test-rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
            echo -e "${GREEN}RabbitMQ is ready!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}RabbitMQ did not become ready${NC}"
        exit 1
    fi
}

# Function to stop test containers
stop_containers() {
    if [ "$CONTAINERS" = true ]; then
        echo -e "${YELLOW}Stopping test containers...${NC}"
        docker-compose -f docker-compose.test.yml down -v
    fi
}

# Trap to ensure cleanup on exit
trap stop_containers EXIT

# Start containers if requested
if [ "$CONTAINERS" = true ]; then
    start_containers
fi

# Build pytest command
PYTEST_CMD="cd backend && python -m pytest"

# Add test type filter
case $TEST_TYPE in
    unit)
        PYTEST_CMD="$PYTEST_CMD -m unit"
        ;;
    integration)
        PYTEST_CMD="$PYTEST_CMD -m integration"
        export USE_TEST_CONTAINERS=true
        ;;
    e2e)
        PYTEST_CMD="$PYTEST_CMD -m e2e"
        export USE_TEST_CONTAINERS=true
        ;;
    all)
        export USE_TEST_CONTAINERS=true
        ;;
esac

# Add coverage if requested
if [ "$COVERAGE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD --cov=. --cov-report=html --cov-report=term-missing"
fi

# Add verbose flag
if [ "$VERBOSE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -v -s"
fi

# Add other useful options
PYTEST_CMD="$PYTEST_CMD --strict-markers --tb=short"

echo -e "${GREEN}Running tests...${NC}"
echo "Command: $PYTEST_CMD"
echo ""

# Run tests
eval $PYTEST_CMD
TEST_EXIT_CODE=$?

# Print summary
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo ""
    echo -e "${RED}Some tests failed!${NC}"
fi

exit $TEST_EXIT_CODE
