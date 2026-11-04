# Auth0 con Terraform

Crea en tu tenant de Auth0: la API (resource server) con sus scopes, una SPA de ejemplo, una
aplicación Machine-to-Machine con su grant, y roles RBAC (`reader`, `writer`).

## Requisitos

- Terraform >= 1.9 (u OpenTofu compatible).
- Una aplicación M2M **dedicada a Terraform** en tu tenant, con acceso a la Auth0 Management API
  (se crea una sola vez a mano en el Dashboard). Scopes mínimos de la Management API:
  `read|create|update|delete` sobre `clients`, `client_grants`, `resource_servers` y `roles`,
  más `read:client_keys`, `read|create|update:client_credentials` y `read:tenant_settings`.

## Uso

```bash
cd infra/terraform
export AUTH0_DOMAIN="tu-tenant.us.auth0.com"
export AUTH0_CLIENT_ID="<client id de la app M2M de Terraform>"
export AUTH0_CLIENT_SECRET="<client secret>"

cp terraform.tfvars.example terraform.tfvars   # y ajusta api_identifier, URLs...
terraform init
terraform plan
terraform apply
```

Después de `terraform init` se genera `.terraform.lock.hcl`: **versiónalo**.

Para obtener los valores que necesita la API y los clientes:

```bash
terraform output api_audience          # -> AUTH0_AUDIENCE
terraform output spa_client_id
terraform output m2m_client_id
terraform output -raw m2m_client_secret
```

## Notas

- El `state` contiene secretos: no lo subas a git. Usa un backend remoto cifrado
  (ver `backend.tf.example`).
- Si cambias los scopes de `local.scopes` en `main.tf`, actualiza también `src/app.ts`.
- Si el tenant ya tiene estos recursos (por ejemplo creados con el Deploy CLI), impórtalos con
  `terraform import` o usa otro `api_name`/`api_identifier`. **No uses Terraform y el Deploy CLI
  sobre los mismos recursos del mismo tenant.**
