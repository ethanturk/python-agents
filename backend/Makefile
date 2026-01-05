.PHONY: help install install-dev format lint type-check security test test-cov clean run-dev

# Default target
help:
	@echo "Available commands:"
	@echo "  make install         - Install production dependencies"
	@echo "  make install-dev     - Install development dependencies"
	@echo "  make format          - Format code with black"
	@echo "  make lint            - Lint code with ruff"
	@echo "  make type-check      - Run mypy type checking"
	@echo "  make security        - Run bandit security scan"
	@echo "  make test            - Run tests"
	@echo "  make test-cov        - Run tests with coverage report"
	@echo "  make quality         - Run all quality checks (format, lint, type-check, security)"
	@echo "  make clean           - Clean up generated files"
	@echo "  make run-dev         - Run development server"
	@echo "  make setup-hooks     - Setup pre-commit hooks"

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

format:
	black .
	ruff check --fix .

lint:
	ruff check .

type-check:
	mypy .

security:
	bandit -c .bandit -r .

test:
	pytest

test-cov:
	pytest --cov=. --cov-report=html --cov-report=term-missing

quality: format lint type-check security
	@echo "✅ All quality checks passed!"

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	rm -rf htmlcov/ .coverage 2>/dev/null || true
	@echo "✅ Cleanup complete!"

run-dev:
	uvicorn backend_app:app --reload --host 0.0.0.0 --port 9999

setup-hooks:
	pre-commit install
	@echo "✅ Pre-commit hooks installed!"

# CI/CD target - runs all checks
ci: quality test-cov
	@echo "✅ CI checks passed!"
