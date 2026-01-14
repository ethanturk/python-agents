@description('Environment name (e.g., dev, staging, prod)')
param environment string = 'prod'

@description('Client ID for multi-tenancy')
param clientId string = 'default'

@description('Resource location')
param location string = resourceGroup().location

@description('Supabase URL (optional if already in Key Vault)')
param supabaseUrl string = ''

@description('Supabase service key (optional if already in Key Vault)')
@secure()
param supabaseKey string = ''

@description('OpenAI API key (optional if already in Key Vault)')
@secure()
param openaiApiKey string = ''

@description('Internal API key for webhook authentication (optional if already in Key Vault)')
@secure()
param internalApiKey string = ''

@description('Storage account name')
param storageAccountName string = 'aidocsrch'

// Naming convention
var baseName = 'worker-${environment}'
var keyVaultName = 'kv-${baseName}'
var queueName = '${clientId}-tasks'

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acr${replace(baseName, '-', '')}'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// Azure Storage account for queues and blob storage
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Storage queue for tasks
resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  name: '${storageAccount.name}/${queueName}'
}

// Storage blob container for documents
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/documents'
}

// Key Vault for secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForDeployment: true
    enabledForTemplateDeployment: true
  }
}

// Get storage account key
var storageAccountKey = storageAccount.listKeys('2023-01-01').keys[0].value

// Storage account secrets for Logic App connection
resource secretStorageAccountName 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-account-name' // pragma: allowlist secret
  properties: {
    value: storageAccount.name
  }
}

resource secretStorageAccountKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-account-key' // pragma: allowlist secret
  properties: {
    value: storageAccountKey
  }
}

resource secretStorageConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-storage-connection-string' // pragma: allowlist secret
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net'
  }
}

// Supabase secrets (only create if values provided)
resource secretSupabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(supabaseUrl)) {
  parent: keyVault
  name: 'supabase-url' // pragma: allowlist secret
  properties: {
    value: supabaseUrl
  }
}

resource secretSupabaseKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(supabaseKey)) {
  parent: keyVault
  name: 'supabase-key' // pragma: allowlist secret
  properties: {
    value: supabaseKey
  }
}

// OpenAI and Internal API secrets (only create if values provided)
resource secretOpenaiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openaiApiKey)) {
  parent: keyVault
  name: 'openai-api-key' // pragma: allowlist secret
  properties: {
    value: openaiApiKey
  }
}

resource secretInternalApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(internalApiKey)) {
  parent: keyVault
  name: 'internal-api-key' // pragma: allowlist secret
  properties: {
    value: internalApiKey
  }
}

resource secretAcrPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'acr-password' // pragma: allowlist secret
  properties: {
    value: acr.listCredentials().passwords[0].value
  }
}

// Deploy Logic App
module logicApp 'logic-app-trigger.bicep' = {
  name: 'deploy-logic-app'
  params: {
    environment: environment
    location: location
    queueName: queueName
    pollingIntervalSeconds: 30
    containerResourceGroup: resourceGroup().name
    storageAccountName: storageAccount.name
    keyVaultName: keyVault.name
  }
}

// Outputs
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output storageAccountName string = storageAccount.name
output logicAppName string = logicApp.outputs.logicAppName
output logicAppId string = logicApp.outputs.logicAppId
