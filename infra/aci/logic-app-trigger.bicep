@description('Logic App name')
param logicAppName string = 'worker-task-trigger'

@description('Resource location')
param location string = resourceGroup().location

@description('Azure Storage connection string')
@secure()
param storageConnectionString string

@description('Queue name to monitor')
param queueName string = 'default-tasks'

@description('Polling interval in seconds')
param pollingIntervalSeconds int = 30

@description('Resource group for container instances')
param containerResourceGroup string = resourceGroup().name

@description('ACR name for worker images')
param acrName string

@description('Key Vault name for secrets')
param keyVaultName string

// API connection for Azure Storage Queue
resource storageConnection 'Microsoft.Web/connections@2016-06-01' = {
  name: 'azurequeues-connection'
  location: location
  properties: {
    displayName: 'Azure Storage Queue Connection'
    api: {
      id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'azurequeues')
    }
    parameterValues: {
      storageaccount: split(split(storageConnectionString, 'AccountName=')[1], ';')[0]
      sharedkey: split(split(storageConnectionString, 'AccountKey=')[1], ';')[0]
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
            path: '/v2/storageAccounts/@{encodeURIComponent(encodeURIComponent(\'${split(split(storageConnectionString, 'AccountName=')[1], ';')[0]}\'))}/queues/@{encodeURIComponent(\'${queueName}\')}/message_trigger'
          }
        }
      }
      actions: {
        'Parse_Message': {
          type: 'ParseJson'
          runAfter: {}
          inputs: {
            content: '@triggerBody()?[\'MessageText\']'
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
            uri: 'https://management.azure.com/subscriptions/@{subscription().subscriptionId}/resourceGroups/${containerResourceGroup}/providers/Microsoft.ContainerInstance/containerGroups/worker-@{guid()}?api-version=2023-05-01'
            authentication: {
              type: 'ManagedServiceIdentity'
            }
            body: {
              location: location
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
                          value: '@{triggerBody()?[\'MessageText\']}'
                        }
                        {
                          name: 'CLIENT_ID'
                          value: split(queueName, '-')[0]
                        }
                        {
                          name: 'WORKER_TASK_TIMEOUT'
                          value: '1800'
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
                    username: acrName
                    password: '@{listSecrets(resourceId(\'Microsoft.KeyVault/vaults/secrets\', \'${keyVaultName}\', \'acr-password\'), \'2023-07-01\').value}'
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
            path: '/v2/storageAccounts/@{encodeURIComponent(encodeURIComponent(\'${split(split(storageConnectionString, 'AccountName=')[1], ';')[0]}\'))}/queues/@{encodeURIComponent(\'${queueName}\')}/messages/@{encodeURIComponent(triggerBody()?[\'MessageId\'])}'
            queries: {
              popreceipt: '@triggerBody()?[\'PopReceipt\']'
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

output logicAppId string = logicApp.id
output logicAppName string = logicApp.name
output logicAppPrincipalId string = logicApp.identity.principalId
