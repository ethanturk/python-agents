#!/bin/bash
# Installation script for queue-worker systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}This script must be run as root or with sudo${NC}"
    exit 1
fi

# Configuration
CLIENT_ID="${1:-default}"
WORKER_DIR="${2:-/opt/worker}"
SERVICE_NAME="queue-worker-${CLIENT_ID}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo -e "${GREEN}Installing queue-worker service for client: ${CLIENT_ID}${NC}"
echo ""

# Check if worker directory exists
if [ ! -d "$WORKER_DIR" ]; then
    echo -e "${YELLOW}Worker directory not found: $WORKER_DIR${NC}"
    echo -e "${YELLOW}Please ensure the worker files are installed first${NC}"
    exit 1
fi

# Check for queue_worker.py
if [ ! -f "$WORKER_DIR/queue_worker.py" ]; then
    echo -e "${RED}queue_worker.py not found in $WORKER_DIR${NC}"
    exit 1
fi

# Create systemd service file from template
if [ ! -f "$WORKER_DIR/queue-worker.service.template" ]; then
    echo -e "${RED}Service template not found: $WORKER_DIR/queue-worker.service.template${NC}"
    exit 1
fi

echo "Creating systemd service file..."
sed "s/{{CLIENT_ID}}/$CLIENT_ID/g" "$WORKER_DIR/queue-worker.service.template" > "$SERVICE_FILE"

# Create worker user if it doesn't exist
if ! id -u worker >/dev/null 2>&1; then
    echo "Creating worker user..."
    useradd -r -s /bin/false -d "$WORKER_DIR" worker
fi

# Set permissions
echo "Setting permissions..."
chown -R worker:worker "$WORKER_DIR"
chmod -R 755 "$WORKER_DIR"

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable service
echo "Enabling service..."
systemctl enable "$SERVICE_NAME"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "To start the service, run:"
echo "  sudo systemctl start $SERVICE_NAME"
echo ""
echo "To check status, run:"
echo "  sudo systemctl status $SERVICE_NAME"
echo ""
echo "To view logs, run:"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo ""
