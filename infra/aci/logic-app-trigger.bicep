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

@description('Key Vault name')
param keyVaultName string

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
      storageaccount: '@Microsoft.KeyVault(${keyVaultName}, storage-account-name)'
      sharedkey: '@Microsoft.KeyVault(${keyVaultName}, storage-account-key)'
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
        'For_Each_Message': {
          type: 'Foreach'
          runAfter: {}
          foreach: '@triggerBody()?[\'QueueMessagesList\']?[\'QueueMessage\']'
          actions: {
            'Parse_Message': {
              type: 'ParseJson'
              runAfter: {}
              inputs: {
                content: '@items(\'For_Each_Message\')?[\'MessageText\']'
                schema: {
                  type: 'object'
                  properties: {
                    task_type: { type: 'string' }
                    task_id: { type: 'string' }
                    payload: { type: 'object' }
                    webhook_url: { type: 'string' }
                  }
                }
              }
            }
            'Create_Container_Instance': {
              type: 'Http'
              runAfter: {
                Parse_Message: ['Succeeded']
              }
              inputs: {
                method: 'PUT'
                #disable-next-line no-hardcoded-env-urls
                uri: 'https://${managementHost}/subscriptions/${subscription().subscriptionId}/resourceGroups/${containerResourceGroup}/providers/Microsoft.ContainerInstance/containerGroups/worker-@{guid()}?api-version=2023-05-01'
                authentication: {
                  type: 'ManagedServiceIdentity'
                }
                body: {
                  location: location
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
                          image: '${acrName}.azurecr.io/worker:latest'
                          resources: {
                            requests: {
                              cpu: 1
                              memoryInGB: 2
                            }
                          }
                          environmentVariables: [
                            {
                              name: 'TASK_DATA'
                              value: '@items(\'For_Each_Message\')?[\'MessageText\']'
                            }
                            {
                              name: 'CLIENT_ID'
                              value: split(queueName, '-')[0]
                            }
                            {
                              name: 'WORKER_TASK_TIMEOUT'
                              value: '1800'
                            }
                            {
                              name: 'AZURE_STORAGE_CONNECTION_STRING'
                              secretReference: {
                                vaultId: keyVaultResourceId
                                secretName: 'azure-storage-connection-string' // pragma: allowlist secret
                              }
                            }
                            {
                              name: 'SUPABASE_URL'
                              secretReference: {
                                vaultId: keyVaultResourceId
                                secretName: 'supabase-url' // pragma: allowlist secret
                              }
                            }
                            {
                              name: 'SUPABASE_KEY'
                              secretReference: {
                                vaultId: keyVaultResourceId
                                secretName: 'supabase-key' // pragma: allowlist secret
                              }
                            }
                            {
                              name: 'OPENAI_API_KEY'
                              secretReference: {
                                vaultId: keyVaultResourceId
                                secretName: 'openai-api-key' // pragma: allowlist secret
                              }
                            }
                            {
                              name: 'INTERNAL_API_KEY'
                              secretReference: {
                                vaultId: keyVaultResourceId
                                secretName: 'internal-api-key' // pragma: allowlist secret
                              }
                            }
                          ]
                        }
                      }
                    ]
                    osType: 'Linux'
                    restartPolicy: 'Never'
                    imageRegistryCredentials: [
                      {
                        server: '${acrName}.azurecr.io'
                        identity: acrPullIdentity.id
                      }
                    ]
                  }
                }
              }
            }
            'Delete_Message': {
              type: 'ApiConnection'
              runAfter: {
                Create_Container_Instance: ['Succeeded']
              }
              inputs: {
                host: {
                  connection: {
                    name: '@parameters(\'$connections\')[\'azurequeues\'][\'connectionId\']'
                  }
                }
                method: 'delete'
                path: '/v2/storageAccounts/${storageAccountName}/queues/${queueName}/messages/@{items(\'For_Each_Message\')?[\'MessageId\']}'
                queries: {
                  popreceipt: '@items(\'For_Each_Message\')?[\'PopReceipt\']'
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
