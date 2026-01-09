#!/bin/bash
# Azure Storage Setup CLI Script
# Usage: ./setup-azure.sh

echo "=== Azure Storage Setup for aidocsrch ==="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI not found. Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Variables (can be set via environment)
STORAGE_ACCOUNT_NAME=${STORAGE_ACCOUNT_NAME:-aidocsrch}
CONTAINER_NAME=${CONTAINER_NAME:-documents}
RESOURCE_GROUP=${RESOURCE_GROUP:-}
LOCATION=${LOCATION:-centralus}

echo "Storage Account: $STORAGE_ACCOUNT_NAME"
echo "Container: $CONTAINER_NAME"

# Check if storage account exists
echo "Checking if storage account exists..."
ACCOUNT_EXISTS=$(az storage account show --name $STORAGE_ACCOUNT_NAME 2>/dev/null && echo "exists" || echo "not_found")

if [ "$ACCOUNT_EXISTS" = "not_found" ]; then
    echo "Creating storage account..."
    if [ -z "$RESOURCE_GROUP" ]; then
        echo "Error: RESOURCE_GROUP not set"
        exit 1
    fi

    az storage account create \
        --name $STORAGE_ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --access-tier Hot
else
    echo "Storage account already exists"
fi

# Check if container exists
echo "Checking if container exists..."
CONTAINER_EXISTS=$(az storage container show \
    --name $CONTAINER_NAME \
    --account-name $STORAGE_ACCOUNT_NAME \
    2>/dev/null && echo "exists" || echo "not_found")

if [ "$CONTAINER_EXISTS" = "not_found" ]; then
    echo "Creating container..."
    az storage container create \
        --name $CONTAINER_NAME \
        --account-name $STORAGE_ACCOUNT_NAME \
        --public-access off
else
    echo "Container already exists"
fi

# Get connection string
echo "Retrieving connection string..."
CONNECTION_STRING=$(az storage account show-connection-string \
    --name $STORAGE_ACCOUNT_NAME \
    --query connectionString \
    --output tsv)

echo ""
echo "=== Setup Complete ==="
echo "Connection String (add to .env):"
echo ""
echo "AZURE_STORAGE_CONNECTION_STRING=\"$CONNECTION_STRING\""
echo ""
echo "AZURE_STORAGE_CONTAINER_NAME=$CONTAINER_NAME"
echo ""
echo "AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME"
echo ""
echo "Run these commands to add to your .env:"
echo "echo 'AZURE_STORAGE_CONNECTION_STRING=\"$CONNECTION_STRING\"' >> .env"
echo "echo 'AZURE_STORAGE_CONTAINER_NAME=$CONTAINER_NAME' >> .env"
echo "echo 'AZURE_STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME' >> .env"
