#!/bin/bash
# Setup script for pre-commit hooks
# Run this to install and configure pre-commit for the project

set -e

echo "🚀 Setting up pre-commit hooks..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."

    # Try pip first
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit --user
    elif command -v pip &> /dev/null; then
        pip install pre-commit --user
    elif command -v python3 &> /dev/null; then
        python3 -m pip install pre-commit --user
    else
        echo "❌ ERROR: Could not find pip3 or python3. Please install pre-commit manually:"
        echo "   pip3 install pre-commit"
        exit 1
    fi

    # Add user bin to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
        echo "📌 Added $HOME/.local/bin to PATH (you may want to add this to your ~/.bashrc or ~/.zshrc)"
    fi
fi

# Verify pre-commit is available
if ! command -v pre-commit &> /dev/null; then
    echo "❌ ERROR: pre-commit installation failed. Please install manually:"
    echo "   pip3 install pre-commit"
    exit 1
fi

# Initialize secrets baseline if it doesn't exist
if [ ! -f .secrets.baseline ]; then
    echo "🔐 Creating secrets detection baseline..."
    pre-commit run detect-secrets --all-files || true
fi

# Create .bandit config if it doesn't exist
if [ ! -f backend/.bandit ]; then
    echo "🛡️ Creating bandit config..."
    cat > backend/.bandit << 'EOF'
[bandit]
exclude_dirs = ['/tests', '/venv', '/env', '.git']
skips = ['B101', 'B601']
EOF
fi

# Install pre-commit hooks
echo "🔗 Installing pre-commit hooks..."
pre-commit install

# Optional: Install pre-commit commit-msg hook for conventional commits
echo "📝 Setting up conventional commits hook..."
pre-commit install --hook-type commit-msg

echo ""
echo "✅ Pre-commit hooks installed successfully!"
echo ""
echo "📚 Usage:"
echo "   • Hooks run automatically on commit"
echo "   • Run manually on all files: pre-commit run --all-files"
echo "   • Run on specific files: pre-commit run --files <file>"
echo "   • Update hooks: pre-commit autoupdate"
echo "   • Skip hooks (not recommended): git commit --no-verify"
echo ""
echo "🔍 Hooks configured:"
echo "   • Black (Python formatting)"
echo "   • Ruff (Python linting)"
echo "   • ESLint (JavaScript/TypeScript linting)"
echo "   • Prettier (JavaScript/TypeScript formatting)"
echo "   • Backend unit tests"
echo "   • Frontend tests"
echo "   • Bandit (Security scanning)"
echo "   • Detect-secrets (Secrets detection)"
echo ""
