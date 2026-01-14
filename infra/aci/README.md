# Azure Container Instances Infrastructure

This directory contains Bicep templates for deploying the worker to Azure Container Instances (ACI) with Logic App triggers.

## Architecture

```
Azure Storage Queue ──► Azure Logic App ──► Azure Container Instance
       │                     │                      │
       │                     │                      ▼
       │                     │              Worker Container
       │                     │                      │
       │                     ▼                      │
       │              Delete Message ◄──────────────┘
       │                                    (on completion)
       ▼
  Azure Key Vault ◄─── Secrets (API keys, connection strings)
```

## Files

| File | Purpose |
|------|---------|
| `main.bicep` | Main deployment orchestrator - creates ACR, Key Vault, Logic App |
| `logic-app-trigger.bicep` | Logic App workflow that monitors queue and creates ACI |
| `worker-container.bicep` | ACI container group template (used by Logic App) |

## Prerequisites

1. Azure CLI installed and authenticated
2. Resource group created
3. Azure Storage account with queue created
4. Required secrets ready (Storage connection string, Supabase, OpenAI)

## Deployment

### 1. Create Resource Group

```bash
az group create --name rg-worker-prod --location eastus
```

### 2. Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-worker-prod \
  --template-file main.bicep \
  --parameters \
    environment=prod \
    clientId=default \
    storageConnectionString="<your-storage-connection-string>" \
    supabaseUrl="<your-supabase-url>" \
    supabaseKey="<your-supabase-key>" \
    openaiApiKey="<your-openai-key>"
```

### 3. Note Output Values

After deployment, note the outputs:
- `acrLoginServer` - Use this in CI/CD for image push
- `acrName` - ACR name for authentication
- `keyVaultName` - Key Vault for manual secret updates
- `logicAppName` - Logic App to monitor

## CI/CD Integration

Update GitHub secrets with deployment outputs:

```bash
# Get ACR credentials
ACR_LOGIN_SERVER=$(az deployment group show \
  --resource-group rg-worker-prod \
  --name main \
  --query properties.outputs.acrLoginServer.value -o tsv)

ACR_NAME=$(az deployment group show \
  --resource-group rg-worker-prod \
  --name main \
  --query properties.outputs.acrName.value -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query passwords[0].value -o tsv)

echo "Add these to GitHub secrets:"
echo "ACR_LOGIN_SERVER: $ACR_LOGIN_SERVER"
echo "ACR_USERNAME: $ACR_NAME"
echo "ACR_PASSWORD: $ACR_PASSWORD"
```

## Testing

### Manual Container Deployment

Test the worker container manually:

```bash
# Deploy single container with test task
az deployment group create \
  --resource-group rg-worker-prod \
  --template-file worker-container.bicep \
  --parameters \
    taskData='{"task_type":"ingest","task_id":"test-123","payload":{"filename":"test.pdf","document_set":"default"}}' \
    clientId=default \
    acrName=<your-acr-name> \
    keyVaultName=<your-keyvault-name>
```

### Check Container Logs

```bash
# List container groups
az container list --resource-group rg-worker-prod --output table

# Get logs from specific container
az container logs \
  --resource-group rg-worker-prod \
  --name worker-<unique-id>
```

### Monitor Logic App

```bash
# Check Logic App run history
az logic workflow list \
  --resource-group rg-worker-prod \
  --output table

# Get recent runs
az rest --method get \
  --url "https://management.azure.com/subscriptions/{subscription-id}/resourceGroups/rg-worker-prod/providers/Microsoft.Logic/workflows/la-worker-prod-default/runs?api-version=2016-06-01"
```

## Cleanup

Remove completed container groups (they accumulate):

```bash
# List all worker container groups
az container list \
  --resource-group rg-worker-prod \
  --query "[?starts_with(name, 'worker-')].name" -o tsv

# Delete completed containers
az container list \
  --resource-group rg-worker-prod \
  --query "[?starts_with(name, 'worker-') && properties.instanceView.state=='Succeeded'].name" -o tsv | \
  xargs -I {} az container delete --resource-group rg-worker-prod --name {} --yes
```

Consider setting up an Azure Automation runbook to clean up old containers automatically.

## Cost Management

Set up budget alerts:

```bash
az consumption budget create \
  --budget-name worker-budget \
  --amount 10 \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date -d "+1 year" +%Y-%m-01) \
  --resource-group rg-worker-prod \
  --notifications "[{\"enabled\":true,\"threshold\":80,\"contactEmails\":[\"your@email.com\"],\"operator\":\"GreaterThan\"}]"
```

## Troubleshooting

### Logic App Not Triggering

1. Check Logic App is enabled: `az logic workflow show --name <name> --resource-group <rg>`
2. Verify queue has messages: `az storage message peek --queue-name <queue> --connection-string <conn>`
3. Check API connection status in Azure Portal

### Container Fails to Start

1. Check ACR credentials in Key Vault
2. Verify image exists: `az acr repository show-tags --name <acr> --repository worker`
3. Check container logs for startup errors

### Task Processing Fails

1. Check container logs: `az container logs --name <container> --resource-group <rg>`
2. Verify environment variables are set correctly
3. Check Key Vault secret access permissions
