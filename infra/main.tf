terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  default = "eastus"
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-python-agents"
  location = var.location
}

resource "random_id" "acr_suffix" {
  byte_length = 4
  keepers = {
    rg_id = azurerm_resource_group.rg.id
  }
}

resource "azurerm_container_registry" "acr" {
  name                = "acrpythonagents${random_id.acr_suffix.hex}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Standard"
  admin_enabled       = true
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-python-agents"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "pythonagents"

  default_node_pool {
    name       = "default"
    node_count = 1
    vm_size    = "Standard_B2s"
    upgrade_settings {
      max_surge = "10%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    Environment = "Development"
  }
}

# Grant pull access to AKS managed identity on ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.acr.id
  skip_service_principal_aad_check = true
}
