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



@description('ACR password')
@secure()
param acrPassword string

@description('Azure Storage connection string')
@secure()
param azureStorageConnectionString string

@description('Supabase URL')
param supabaseUrl string

@description('Supabase key')
@secure()
param supabaseKey string

@description('OpenAI API key')
@secure()
param openaiApiKey string

@description('CPU cores for the container')
param cpuCores int = 1

@description('Memory in GB for the container')
param memoryInGB int = 2

@description('Maximum execution time in seconds')
param taskTimeout int = 1800

// Generate unique container group name based on task data hash
var containerGroupName = 'worker-${uniqueString(taskData)}'
var acrServer = '${acrName}.azurecr.io'
var workerImage = '${acrServer}/worker:${imageTag}'



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
              secureValue: azureStorageConnectionString
            }
            {
              name: 'SUPABASE_URL'
              value: supabaseUrl
            }
            {
              name: 'SUPABASE_KEY'
              secureValue: supabaseKey
            }
            {
              name: 'OPENAI_API_KEY'
              secureValue: openaiApiKey
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
        password: acrPassword
      }
    ]
  }
  tags: {
    purpose: 'worker-task'
    clientId: clientId
  }
}

output containerGroupId string = containerGroup.id
output containerGroupName string = containerGroup.name
