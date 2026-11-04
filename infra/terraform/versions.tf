terraform {
  required_version = ">= 1.9"

  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "~> 1.47"
    }
  }

  # Descomenta y ajusta un backend remoto: el state contiene secretos
  # (client secrets) y NO debe versionarse. Ver backend.tf.example.
}

# Credenciales por variables de entorno (aplicación M2M dedicada a Terraform):
#   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
provider "auth0" {}
