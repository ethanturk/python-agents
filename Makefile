.PHONY: help test test-unit test-integration test-e2e test-all test-coverage lint lint-fix format format-check clean build dev dev-stop dev-logs

# Default target
help:
	@echo "Available targets:"
	@echo "  make test-unit      - Run unit tests only"
	@echo "  make test-integration - Run integration tests (requires containers)"
	@echo "  make test-e2e       - Run end-to-end tests"
	@echo "  make test-all       - Run all tests"
	@echo "  make test-coverage  - Run tests with coverage report"
	@echo "  make lint           - Run linting checks"
	@echo "  make lint-fix       - Auto-fix linting issues"
	@echo "  make format         - Format code"
	@echo "  make format-check   - Check code formatting"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make build          - Build all Docker containers"
	@echo "  make dev            - Start development environment"
	@echo "  make dev-stop       - Stop development environment"
	@echo "  make dev-logs       - Show development logs"

# Test targets
test-unit:
	@echo "Running unit tests..."
	./run_tests.sh --unit

test-integration:
	@echo "Running integration tests..."
	./run_tests.sh --integration --containers

test-e2e:
	@echo "Running E2E tests..."
	./run_tests.sh --e2e --containers

test-all:
	@echo "Running all tests..."
	./run_tests.sh --all --containers --coverage

test-coverage:
	@echo "Running tests with coverage..."
	./run_tests.sh --all --containers --coverage
	@echo "Coverage report available at backend/htmlcov/index.html"

# Linting and formatting
lint:
	@echo "Running linting checks..."
	cd backend && ruff check .

lint-fix:
	@echo "Auto-fixing linting issues..."
	cd backend && ruff check --fix .

format:
	@echo "Formatting code..."
	cd backend && black .
	cd frontend && npm run format || echo "No format script defined in frontend"

format-check:
	@echo "Checking code formatting..."
	cd backend && black --check .
	cd frontend && npm run lint || echo "Running lint check..."

# Type checking
typecheck:
	@echo "Running type checking..."
	cd backend && mypy .

# Clean
clean:
	@echo "Cleaning build artifacts..."
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name htmlcov -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .coverage -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/.coverage backend/.pytest_cache backend/htmlcov

# Docker targets
build:
	@echo "Building all Docker containers..."
	docker-compose -f docker-compose.yml build
	docker-compose -f docker-compose.worker.yml build
	docker-compose -f docker-compose.frontend.yml build
	docker-compose -f docker-compose.test.yml build

# Development targets
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.yml up -d
	docker-compose -f docker-compose.worker.yml up -d
	docker-compose -f docker-compose.frontend.yml up -d
	@echo "Waiting for services to be ready..."
	sleep 5
	@echo "Services:"
	@echo "  Backend: http://localhost:9999"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Flower (Celery): http://localhost:5555"

dev-stop:
	@echo "Stopping development environment..."
	docker-compose -f docker-compose.yml down
	docker-compose -f docker-compose.worker.yml down
	docker-compose -f docker-compose.frontend.yml down

dev-logs:
	@echo "Showing development logs (Ctrl+C to exit)..."
	docker-compose -f docker-compose.yml -f docker-compose.worker.yml -f docker-compose.frontend.yml logs -f

# Quick test for CI
ci: lint typecheck test-unit
	@echo "CI checks passed!"

# Full CI test
ci-full: lint typecheck test-all
	@echo "Full CI checks passed!"
