output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "kubernetes_cluster_name" {
  description = "GKE Cluster Name"
  value       = google_container_cluster.primary.name
}

output "kubernetes_cluster_endpoint" {
  description = "GKE Cluster Endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "artifact_registry_repository" {
  description = "Artifact Registry Repository ID"
  value       = google_artifact_registry_repository.containers.repository_id
}

output "artifact_registry_location" {
  description = "Artifact Registry Location"
  value       = google_artifact_registry_repository.containers.location
}

output "gke_service_account_email" {
  description = "GKE Service Account Email"
  value       = google_service_account.gke_sa.email
}
