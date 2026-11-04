locals {
  # Permisos (scopes) de la API. Mantener sincronizado con src/app.ts.
  scopes = {
    "read:messages"  = "Leer mensajes"
    "write:messages" = "Crear mensajes"
  }

  # Roles RBAC para usuarios finales (flujos con login).
  roles = {
    reader = {
      description = "Puede leer mensajes"
      permissions = ["read:messages"]
    }
    writer = {
      description = "Puede leer y crear mensajes"
      permissions = ["read:messages", "write:messages"]
    }
  }
}

# --- API (Resource Server) ---------------------------------------------------

resource "auth0_resource_server" "api" {
  name       = var.api_name
  identifier = var.api_identifier

  signing_alg                                     = "RS256"
  token_lifetime                                  = var.access_token_lifetime_seconds
  allow_offline_access                            = false
  skip_consent_for_verifiable_first_party_clients = true

  # RBAC: el access token solo lleva los permisos asignados al usuario.
  enforce_policies = true
  token_dialect    = "access_token_authz"
}

resource "auth0_resource_server_scopes" "api" {
  resource_server_identifier = auth0_resource_server.api.identifier

  dynamic "scopes" {
    for_each = local.scopes
    content {
      name        = scopes.key
      description = scopes.value
    }
  }
}

# --- Aplicación SPA de ejemplo (frontends) ------------------------------------

resource "auth0_client" "spa" {
  name            = "${var.api_name} SPA"
  description     = "Aplicación SPA de ejemplo que consume ${var.api_name}"
  app_type        = "spa"
  is_first_party  = true
  oidc_conformant = true

  callbacks           = var.spa_callbacks
  allowed_logout_urls = var.spa_logout_urls
  web_origins         = var.spa_web_origins

  grant_types                = ["authorization_code", "refresh_token"]
  token_endpoint_auth_method = "none"

  jwt_configuration {
    alg = "RS256"
  }

  refresh_token {
    rotation_type   = "rotating"
    expiration_type = "expiring"
    token_lifetime  = 2592000
  }
}

# --- Aplicación Machine-to-Machine (otros sistemas) ---------------------------

resource "auth0_client" "m2m" {
  name        = "${var.api_name} M2M"
  description = "Cliente machine-to-machine para sistemas que llaman a ${var.api_name}"
  app_type    = "non_interactive"
  grant_types = ["client_credentials"]

  jwt_configuration {
    alg = "RS256"
  }
}

resource "auth0_client_credentials" "m2m" {
  client_id             = auth0_client.m2m.id
  authentication_method = "client_secret_post"
}

resource "auth0_client_grant" "m2m" {
  client_id = auth0_client.m2m.id
  audience  = auth0_resource_server.api.identifier
  scopes    = var.m2m_scopes

  depends_on = [auth0_resource_server_scopes.api]
}

# --- Roles y permisos para usuarios ------------------------------------------

resource "auth0_role" "api" {
  for_each = local.roles

  name        = "${var.api_name}-${each.key}"
  description = each.value.description
}

resource "auth0_role_permissions" "api" {
  for_each = local.roles

  role_id = auth0_role.api[each.key].id

  dynamic "permissions" {
    for_each = each.value.permissions
    content {
      resource_server_identifier = auth0_resource_server.api.identifier
      name                       = permissions.value
    }
  }

  depends_on = [auth0_resource_server_scopes.api]
}
