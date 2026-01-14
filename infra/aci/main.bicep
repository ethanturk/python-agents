@description('Environment name (e.g., dev, staging, prod)')
param environment string = 'prod'

@description('Client ID for multi-tenancy')
param clientId string = 'default'

@description('Resource location')
param location string = resourceGroup().location

@description('Azure Storage connection string')
@secure()
param storageConnectionString string

@description('Supabase URL')
param supabaseUrl string

@description('Supabase service key')
@secure()
param supabaseKey string

@description('OpenAI API key')
@secure()
param openaiApiKey string

@description('Internal API key for webhook authentication')
@secure()
param internalApiKey string

// Naming convention
var baseName = 'worker-${environment}'
var acrName = replace('acr${baseName}', '-', '')
var keyVaultName = 'kv-${baseName}'
var queueName = '${clientId}-tasks'

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
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

// Store secrets in Key Vault
resource secretAzureStorage 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-storage-connection-string' // pragma: allowlist secret
  properties: {
    value: storageConnectionString
  }
}

resource secretSupabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'supabase-url' // pragma: allowlist secret
  properties: {
    value: supabaseUrl
  }
}

resource secretSupabaseKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'supabase-key' // pragma: allowlist secret
  properties: {
    value: supabaseKey
  }
}

resource secretOpenaiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'openai-api-key' // pragma: allowlist secret
  properties: {
    value: openaiApiKey
  }
}

resource secretInternalApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
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
    storageConnectionString: storageConnectionString
    queueName: queueName
    pollingIntervalSeconds: 30
    containerResourceGroup: resourceGroup().name
  }
  dependsOn: [
    acr
    keyVault
  ]
}

// Outputs
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output logicAppName string = logicApp.outputs.logicAppName
output logicAppId string = logicApp.outputs.logicAppId
