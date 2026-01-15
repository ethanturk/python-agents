@description('Environment name (e.g., dev, staging, prod)')
param environment string = 'prod'

@description('Resource location')
param location string = resourceGroup().location

@description('Queue name to monitor')
param queueName string = 'default-tasks'

@description('Polling interval in seconds')
param pollingIntervalSeconds int = 30

@description('Resource group for container instances')
param containerResourceGroup string = resourceGroup().name

#disable-next-line no-unused-params
@description('Storage account name for the queue')
param storageAccountName string

@description('Storage account key for the queue connection')
@secure()
param storageAccountKey string

@description('Key Vault name')
param keyVaultName string

@description('OpenAI API Base URL')
param openaiApiBase string = 'https://api.openai.com/v1'

#disable-next-line no-hardcoded-env-urls
var managementHost = 'management.azure.com'

// Naming convention (matches main.bicep)
var baseName = 'worker-${environment}'
var acrName = replace('acr${baseName}', '-', '')
var logicAppName = 'la-${baseName}-${split(queueName, '-')[0]}'
var keyVaultResourceId = resourceId('Microsoft.KeyVault/vaults', keyVaultName)

// Reference existing Key Vault from main deployment
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  scope: resourceGroup()
  name: keyVaultName
}

// User-Assigned Managed Identity for ACI to pull from ACR
resource acrPullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${logicAppName}-acr-pull'
  location: location
}

// API connection for Azure Storage Queue - pulls secrets from Key Vault
resource storageConnection 'Microsoft.Web/connections@2016-06-01' = {
  name: 'azurequeues-connection'
  location: location
  properties: {
    displayName: 'Azure Storage Queue Connection'
    api: {
      id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'azurequeues')
    }
    parameterValues: {
      storageaccount: storageAccountName
      sharedkey: storageAccountKey
    }
  }
}

// Logic App workflow
resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: logicAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    state: 'Enabled'
    definition: {
      // Logic App schema requires quoted property names for special characters
      #disable-next-line prefer-unquoted-property-names
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: {
        '$connections': {
          defaultValue: {}
          type: 'Object'
        }
      }
      triggers: {
        'When_messages_are_available_in_queue': {
          type: 'ApiConnection'
          recurrence: {
            frequency: 'Second'
            interval: pollingIntervalSeconds
          }
          inputs: {
            host: {
              connection: {
                name: '@parameters(\'$connections\')[\'azurequeues\'][\'connectionId\']'
              }
            }
            method: 'get'
            path: '/v2/storageAccounts/${storageAccountName}/queues/${queueName}/message_trigger'
          }
        }
      }
      actions: {
        'Select_Messages': {
          type: 'Select'
          inputs: {
            from: '@triggerBody()?[\'QueueMessagesList\']?[\'QueueMessage\']'
            select: '@json(item()?[\'MessageText\'])'
          }
        }
        'Create_Container_Instance': {
          type: 'Http'
          runAfter: {
            Select_Messages: ['Succeeded']
          }
          inputs: {
            method: 'PUT'
            #disable-next-line no-hardcoded-env-urls
            uri: 'https://${managementHost}/subscriptions/${subscription().subscriptionId}/resourceGroups/${containerResourceGroup}/providers/Microsoft.Resources/deployments/worker-@{guid()}?api-version=2021-04-01'
            authentication: {
              type: 'ManagedServiceIdentity'
            }
            body: {
              properties: {
                mode: 'Incremental'
                template: {
                  '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#'
                  contentVersion: '1.0.0.0'
                  parameters: {
                    taskData: { type: 'string' }
                    clientId: { type: 'string' }
                    acrName: { type: 'string' }
                    acrPassword: { type: 'secureString' }
                    azureStorageConnectionString: { type: 'secureString' }
                    supabaseUrl: { type: 'string' }
                                            supabaseKey: { type: 'secureString' }
                                            openaiApiKey: { type: 'secureString' }
                                            openaiApiBase: { type: 'string' }
                                            internalApiKey: { type: 'secureString' }
                                            vectorTableName: { type: 'string', defaultValue: 'documents' }                  }
                  resources: [
                    {
                      type: 'Microsoft.ContainerInstance/containerGroups'
                      apiVersion: '2023-05-01'
                      name: '[deployment().name]'
                      location: '[resourceGroup().location]'
                      identity: {
                        type: 'UserAssigned'
                        userAssignedIdentities: {
                          '${acrPullIdentity.id}': {}
                        }
                      }
                      properties: {
                        containers: [
                          {
                            name: 'worker'
                            properties: {
                              image: '[concat(parameters(\'acrName\'), \'.azurecr.io/worker:latest\')]'
                              resources: {
                                requests: {
                                  cpu: 1
                                  memoryInGB: 2
                                }
                              }
                              environmentVariables: [
                                {
                                  name: 'TASK_DATA'
                                  value: '[parameters(\'taskData\')]'
                                }
                                {
                                  name: 'CLIENT_ID'
                                  value: '[parameters(\'clientId\')]'
                                }
                                {
                                  name: 'WORKER_TASK_TIMEOUT'
                                  value: '1800'
                                }
                                {
                                  name: 'AZURE_STORAGE_CONNECTION_STRING'
                                  secureValue: '[parameters(\'azureStorageConnectionString\')]'
                                }
                                {
                                  name: 'SUPABASE_URL'
                                  value: '[parameters(\'supabaseUrl\')]'
                                }
                                {
                                  name: 'SUPABASE_KEY'
                                  secureValue: '[parameters(\'supabaseKey\')]'
                                }
                                {
                                  name: 'OPENAI_API_KEY'
                                  secureValue: '[parameters(\'openaiApiKey\')]'
                                }
                                {
                                  name: 'INTERNAL_API_KEY'
                                  secureValue: '[parameters(\'internalApiKey\')]'
                                }
                                {
                                  name: 'VECTOR_TABLE_NAME'
                                  value: '[parameters(\'vectorTableName\')]'
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
                                {
                                  name: 'OPENAI_API_BASE'
                                  value: '[parameters(\'openaiApiBase\')]'
                                }
                              ]
                            }
                          }
                        ]
                        osType: 'Linux'
                        restartPolicy: 'Never'
                        imageRegistryCredentials: [
                          {
                            server: '[concat(parameters(\'acrName\'), \'.azurecr.io\')]'
                            username: '[parameters(\'acrName\')]'
                            password: '[parameters(\'acrPassword\')]'
                          }
                        ]
                      }
                    }
                  ]
                }
                parameters: {
                  taskData: { value: '@string(body(\'Select_Messages\'))' }
                  clientId: { value: split(queueName, '-')[0] }
                  acrName: { value: acrName }
                  acrPassword: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'acr-password' // pragma: allowlist secret
                    }
                  }
                  azureStorageConnectionString: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'azure-storage-connection-string' // pragma: allowlist secret
                    }
                  }
                  supabaseUrl: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'supabase-url' // pragma: allowlist secret
                    }
                  }
                  supabaseKey: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'supabase-key' // pragma: allowlist secret
                    }
                  }
                  openaiApiKey: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'openai-api-key' // pragma: allowlist secret
                    }
                  }
                  openaiApiBase: {
                    value: openaiApiBase
                  }
                  internalApiKey: {
                    reference: {
                      keyVault: { id: keyVaultResourceId }
                      secretName: 'internal-api-key' // pragma: allowlist secret
                    }
                  }
                }
              }
            }
          }
        }
        'Delete_Messages': {
          type: 'Foreach'
          runAfter: {
            Create_Container_Instance: ['Succeeded']
          }
          foreach: '@triggerBody()?[\'QueueMessagesList\']?[\'QueueMessage\']'
          actions: {
            'Delete_Message': {
              type: 'ApiConnection'
              runAfter: {}
              inputs: {
                host: {
                  connection: {
                    name: '@parameters(\'$connections\')[\'azurequeues\'][\'connectionId\']'
                  }
                }
                method: 'delete'
                path: '/v2/storageAccounts/${storageAccountName}/queues/${queueName}/messages/@{items(\'Delete_Messages\')?[\'MessageId\']}'
                queries: {
                  popreceipt: '@items(\'Delete_Messages\')?[\'PopReceipt\']'
                }
              }
            }
          }
        }
      }
    }
    parameters: {
      '$connections': {
        value: {
          azurequeues: {
            connectionId: storageConnection.id
            connectionName: 'azurequeues-connection'
            id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'azurequeues')
          }
        }
      }
    }
  }
}

// Role assignment for Logic App to create container instances
resource contributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(logicApp.id, 'Contributor')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor
    principalId: logicApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Key Vault Secrets User role assignment for Logic App identity (to access storage secrets)
resource logicAppKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResourceId, logicApp.id, 'SecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: logicApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// AcrPull role assignment for the managed identity on the ACR
module acrPullRoleAssignment 'acr-role-assignment.bicep' = {
  name: 'acrPullRoleAssignment'
  scope: resourceGroup()
  params: {
    acrName: acrName
    principalId: acrPullIdentity.properties.principalId
  }
}

// Key Vault Secrets User role assignment for ACI identity
resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResourceId, acrPullIdentity.id, 'SecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: acrPullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output logicAppId string = logicApp.id
output logicAppName string = logicApp.name
output logicAppPrincipalId string = logicApp.identity.principalId
