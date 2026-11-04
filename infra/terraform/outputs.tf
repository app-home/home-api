output "api_audience" {
  description = "Valor para AUTH0_AUDIENCE."
  value       = auth0_resource_server.api.identifier
}

output "spa_client_id" {
  description = "Client ID de la SPA de ejemplo (público)."
  value       = auth0_client.spa.client_id
}

output "m2m_client_id" {
  description = "Client ID de la aplicación M2M."
  value       = auth0_client.m2m.client_id
}

output "m2m_client_secret" {
  description = "Client secret de la aplicación M2M. Ver con: terraform output -raw m2m_client_secret"
  value       = auth0_client_credentials.m2m.client_secret
  sensitive   = true
}

output "role_names" {
  description = "Roles RBAC creados."
  value       = [for role in auth0_role.api : role.name]
}
