@description('Task data JSON to process')
param taskData string

@description('Client ID for multi-tenancy')
param clientId string = 'default'

@description('Azure Container Registry name')
param acrName string

@description('Worker image tag')
param imageTag string = 'latest'

@description('Resource location')
param location string = resourceGroup().location

@description('Key Vault name for secrets')
param keyVaultName string

@description('CPU cores for the container')
param cpuCores int = 1

@description('Memory in GB for the container')
param memoryInGB int = 2

@description('Maximum execution time in seconds')
param taskTimeout int = 1800

// Generate unique container group name based on task data hash
var containerGroupName = 'worker-${uniqueString(taskData, utcNow())}'
var acrServer = '${acrName}.azurecr.io'
var workerImage = '${acrServer}/worker:${imageTag}'

// Reference existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Container group for single-task execution
resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: containerGroupName
  location: location
  properties: {
    containers: [
      {
        name: 'worker'
        properties: {
          image: workerImage
          resources: {
            requests: {
              cpu: cpuCores
              memoryInGB: memoryInGB
            }
            limits: {
              cpu: cpuCores
              memoryInGB: memoryInGB
            }
          }
          environmentVariables: [
            {
              name: 'TASK_DATA'
              value: taskData
            }
            {
              name: 'CLIENT_ID'
              value: clientId
            }
            {
              name: 'WORKER_TASK_TIMEOUT'
              value: string(taskTimeout)
            }
            {
              name: 'AZURE_STORAGE_CONNECTION_STRING'
              secureValue: keyVault.getSecret('azure-storage-connection-string')
            }
            {
              name: 'SUPABASE_URL'
              value: keyVault.getSecret('supabase-url')
            }
            {
              name: 'SUPABASE_KEY'
              secureValue: keyVault.getSecret('supabase-key')
            }
            {
              name: 'OPENAI_API_KEY'
              secureValue: keyVault.getSecret('openai-api-key')
            }
            {
              name: 'OPENAI_API_BASE'
              value: 'https://api.openai.com/v1'
            }
            {
              name: 'OPENAI_MODEL'
              value: 'gpt-4o-mini'
            }
            {
              name: 'OPENAI_EMBEDDING_MODEL'
              value: 'text-embedding-3-small'
            }
            {
              name: 'OPENAI_EMBEDDING_DIMENSIONS'
              value: '1536'
            }
          ]
        }
      }
    ]
    osType: 'Linux'
    restartPolicy: 'Never'
    imageRegistryCredentials: [
      {
        server: acrServer
        username: acrName
        password: keyVault.getSecret('acr-password')
      }
    ]
  }
  tags: {
    purpose: 'worker-task'
    clientId: clientId
    createdAt: utcNow()
  }
}

output containerGroupId string = containerGroup.id
output containerGroupName string = containerGroup.name
