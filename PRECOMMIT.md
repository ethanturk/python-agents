# Pre-Commit Hooks Configuration

This project uses pre-commit hooks to ensure code quality before changes are committed.

## Installation

Run the setup script:

```bash
./setup-precommit.sh
```

Or install manually:

```bash
pip3 install pre-commit
pre-commit install
```

## Hooks Overview

The following hooks are configured:

### General Hooks
- **Trailing whitespace**: Removes trailing whitespace
- **End-of-file fixer**: Ensures files end with newline
- **Check YAML/JSON/TOML**: Validates configuration files
- **Check large files**: Prevents files > 5MB from being committed
- **Detect private keys**: Scans for leaked private keys
- **Mixed line ending**: Ensures consistent line endings (LF)

### Backend (Python) Hooks
- **Black**: Code formatting (Python 3.11)
- **Ruff**: Fast Python linter with auto-fix
- **Bandit**: Security vulnerability scanner
- **Unit Tests**: Runs backend unit tests on commit

### Frontend (JavaScript/TypeScript) Hooks
- **ESLint**: Lints JavaScript/TypeScript code
- **Prettier**: Formats code consistently
- **Tests**: Runs frontend tests on commit

### Security Hooks
- **Detect-secrets**: Scans for leaked secrets/API keys
- **Bandit**: Python security scanner

## Usage

### Automatic Hook Execution

Hooks run automatically when you commit changes:

```bash
git add .
git commit -m "feat: add new feature"
```

If a hook fails, the commit is blocked with an error message.

### Manual Execution

Run hooks on all files:

```bash
pre-commit run --all-files
```

Run hooks on specific files:

```bash
pre-commit run --files backend/services/agent.py
```

Run a specific hook:

```bash
pre-commit run black --all-files
```

### Updating Hooks

Update hook versions:

```bash
pre-commit autoupdate
```

### Skipping Hooks (Not Recommended)

If you absolutely need to skip hooks:

```bash
git commit --no-verify -m "message"
```

## Troubleshooting

### Pre-commit not found after installation

Add `~/.local/bin` to your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Add this to your `~/.bashrc` or `~/.zshrc` to persist.

### Hook failing but you can't fix it

Skip the hook temporarily:

```bash
SKIP=eslint-frontend git commit -m "message"
```

### Pre-commit uses the wrong Python version

Ensure you're using the correct Python environment before installing:

```bash
python3 --version
pip3 install pre-commit
```

## GitHub Integration

This pre-commit config works with GitHub Actions CI/CD. However, hooks run **before** commits locally, catching issues before they reach remote.

## Configuration Files

- `.pre-commit-config.yaml` - Main hook configuration
- `.secrets.baseline` - Known secrets (generated automatically)
- `backend/.bandit` - Bandit security scanner config

## Best Practices

1. **Always run hooks locally** - Don't rely on CI to catch issues
2. **Fix issues early** - Hooks auto-fix many problems (Black, Prettier)
3. **Don't skip hooks** - `--no-verify` should be rare
4. **Update regularly** - Run `pre-commit autoupdate` monthly
5. **Review baseline** - Check `.secrets.baseline` before committing

## Adding New Hooks

Add new hooks to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/example/hook-repo
    rev: v1.0.0
    hooks:
      - id: hook-name
        args: ['--option']
```

Then update:

```bash
pre-commit autoupdate
pre-commit install
```
