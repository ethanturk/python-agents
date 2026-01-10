# CI/CD Pipeline

This document describes the automated testing and deployment pipeline using GitHub Actions.

## Overview

The CI/CD pipeline automatically runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch (from Actions tab)

## Pipeline Stages

### 1. Backend Linting
- Runs Ruff linter
- Checks code formatting with Black
- Runs type checking with MyPy
- Fast feedback loop (~1-2 minutes)

### 2. Frontend Linting
- Runs ESLint
- Executes frontend tests with Vitest
- Validates code quality (~2-3 minutes)

### 3. Unit Tests
- Runs all unit tests (marked with `@pytest.mark.unit`)
- Uses mocks for external dependencies
- Generates coverage reports
- Uploads coverage to Codecov (~2-3 minutes)

### 4. Integration Tests
- Starts test containers (PostgreSQL, RabbitMQ, Redis)
- Waits for services to be healthy
- Runs integration tests (marked with `@pytest.mark.integration`)
- Uses real database and message broker
- Cleans up containers after tests (~3-5 minutes)

### 5. Docker Build Verification
- Builds backend image
- Builds worker image
- Builds frontend image
- Validates Dockerfile changes (~2-3 minutes)

### 6. Security Checks
- Runs Bandit security linter
- Checks dependencies for known vulnerabilities
- Uploads security reports as artifacts (~1-2 minutes)

## Test Results Summary

The pipeline provides:
- **Status checks** on PRs
- **Automated PR comments** with test results
- **Detailed logs** for debugging
- **Artifacts** for test reports and coverage

## Running Tests Locally

### Before Pushing
```bash
# Run full test suite
./run_tests.sh --all --coverage

# Or use Makefile
make test-all
```

### Quick Checks
```bash
# Unit tests only
make test-unit

# With linting
make lint
make typecheck
```

## Troubleshooting CI Failures

### Unit Tests Fail
```bash
# Run locally
cd backend
pytest -m unit -v

# Check specific test
pytest tests/test_specific.py::test_function -v
```

### Integration Tests Fail
```bash
# Start containers
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
USE_TEST_CONTAINERS=true cd backend && pytest -m integration -v

# Check logs
docker-compose -f docker-compose.test.yml logs
```

### Linting Fails
```bash
# Auto-fix issues
make lint-fix

# Format code
make format

# Type check
make typecheck
```

### Docker Build Fails
```bash
# Test build locally
docker build -t backend-test ./backend
docker build -t worker-test ./backend
docker build -t frontend-test ./frontend
```

## Coverage Reports

Coverage is automatically generated and uploaded to Codecov:
- **Unit tests**: Code coverage for backend code
- **Integration tests**: Additional coverage for integration points

View coverage at: https://codecov.io/gh/YOUR_USERNAME/python-agents

## Artifacts

Failed runs produce downloadable artifacts:
- **Integration test logs**: Docker logs and pytest output
- **Bandit report**: Security scan results
- **Test coverage**: HTML and XML coverage reports

Access artifacts from the GitHub Actions run page.

## Status Checks

Your PR must pass all status checks before merging:
- ✅ Backend Lint
- ✅ Frontend Lint
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ Docker Build
- ⚠️ Security (informational, doesn't block merge)

## Manual Trigger

To manually run the full test suite:

1. Go to Actions tab in GitHub
2. Select "CI/CD Pipeline"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Configuration Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `docker-compose.test.yml` - Test environment
- `pytest.ini` - Test configuration
- `run_tests.sh` - Test runner script
- `Makefile` - Convenience targets

## Best Practices

### Before Committing
1. Run `make lint` to check code style
2. Run `make test-unit` for quick validation
3. Run `make test-all` before pushing to main

### Creating New Tests
1. Add `@pytest.mark.unit` or `@pytest.mark.integration` marker
2. Follow existing test patterns in `backend/tests/`
3. Ensure tests are independent and can run in any order
4. Write descriptive test names

### Integration Tests
1. Use `USE_TEST_CONTAINERS=true` environment variable
2. Leverage fixtures from `conftest.py`
3. Clean up test data after each test
4. Use unique identifiers to avoid conflicts

## Performance

Typical pipeline execution times:
- Backend Lint: ~1-2 minutes
- Frontend Lint: ~2-3 minutes
- Unit Tests: ~2-3 minutes
- Integration Tests: ~3-5 minutes
- Docker Build: ~2-3 minutes
- Security: ~1-2 minutes

**Total**: ~10-15 minutes (parallel execution reduces total time)

## Notifications

- Failed runs will show status checks
- PR comments summarize test results
- GitHub notifications on completion

## Support

For CI/CD issues:
1. Check the Actions tab for detailed logs
2. Review artifact files for error messages
3. Run tests locally with `./run_tests.sh`
4. Check `TESTING.md` for testing guidelines

## Continuous Improvement

The pipeline is regularly updated to:
- Add new test types
- Improve performance
- Add security checks
- Enhance reporting

Suggestions for improvements are welcome!
