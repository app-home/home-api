variable "api_name" {
  description = "Nombre de la API en Auth0 y prefijo de los demás recursos."
  type        = string
  default     = "home-api"
}

variable "api_identifier" {
  description = "Identifier (audience) de la API. Debe coincidir con AUTH0_AUDIENCE. No tiene por qué ser una URL real."
  type        = string
}

variable "access_token_lifetime_seconds" {
  description = "Duración de los access tokens emitidos para la API."
  type        = number
  default     = 3600
}

variable "spa_callbacks" {
  description = "Allowed Callback URLs de la aplicación SPA de ejemplo."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "spa_logout_urls" {
  description = "Allowed Logout URLs de la aplicación SPA de ejemplo."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "spa_web_origins" {
  description = "Allowed Web Origins de la aplicación SPA de ejemplo."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "m2m_scopes" {
  description = "Scopes que se conceden a la aplicación Machine-to-Machine."
  type        = list(string)
  default     = ["read:messages"]

  validation {
    condition     = alltrue([for s in var.m2m_scopes : contains(keys(local.scopes), s)])
    error_message = "m2m_scopes solo puede contener scopes definidos en local.scopes."
  }
}
