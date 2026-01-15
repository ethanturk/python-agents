.PHONY: help test test-unit test-integration test-e2e test-all test-coverage lint lint-fix format format-check clean build dev dev-stop dev-logs pre-commit-setup pre-commit-run pre-commit-update

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
	@echo "  make pre-commit-setup - Install pre-commit hooks"
	@echo "  make pre-commit-run  - Run pre-commit hooks manually"
	@echo "  make pre-commit-update - Update pre-commit hooks"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make build          - Build all Docker containers"

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
	cd frontend && pnpm run format || echo "No format script defined in frontend"

format-check:
	@echo "Checking code formatting..."
	cd backend && black --check .
	cd frontend && pnpm run lint || echo "Running lint check..."

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
	@echo "Building Docker containers..."
	docker-compose -f docker-compose.test.yml build

# Quick test for CI
ci: lint typecheck test-unit
	@echo "CI checks passed!"

# Full CI test
ci-full: lint typecheck test-all
	@echo "Full CI checks passed!"

# Pre-commit hooks
pre-commit-setup:
	@echo "Installing pre-commit hooks..."
	./setup-precommit.sh

pre-commit-run:
	@echo "Running pre-commit hooks on all files..."
	pre-commit run --all-files

pre-commit-update:
	@echo "Updating pre-commit hooks..."
	pre-commit autoupdate
	pre-commit install
