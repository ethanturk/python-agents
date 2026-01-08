variable "location" {
  description = "The Azure Region to deploy resources"
  type        = string
  default     = "eastus"
}

variable "node_count" {
  description = "Number of nodes in the AKS cluster"
  type        = number
  default     = 1
}
