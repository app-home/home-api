# Auth0 con el Deploy CLI

Define el mismo conjunto de recursos que la versión de Terraform (API con scopes, SPA, M2M con
grant y roles RBAC) en `tenant.yaml`, y lo aplica con `a0deploy` (paquete `auth0-deploy-cli`, ya
incluido como devDependency).

## Requisitos

Una aplicación M2M **dedicada al Deploy CLI** en tu tenant, con acceso a la Auth0 Management API
y los scopes para los recursos que gestionamos (`clients`, `client_grants`, `resource_servers`,
`roles`: leer, crear y actualizar). Se crea una sola vez a mano en el Dashboard.

## Uso

```bash
export AUTH0_DOMAIN="tu-tenant.us.auth0.com"
export AUTH0_CLIENT_ID="<client id de la app M2M del Deploy CLI>"
export AUTH0_CLIENT_SECRET="<client secret>"

# Ajusta API_AUDIENCE y las URLs en config.dev.json / config.prod.json
npm run deploy-cli:import:dev      # o deploy-cli:import:prod
```

Para ver el estado actual del tenant (se guarda en `infra/deploy-cli/export/`, ignorado por git):

```bash
npm run deploy-cli:export
```

## Notas

- `AUTH0_ALLOW_DELETE` está en `false`: el CLI crea y actualiza, pero no borra lo que no esté en
  el YAML. La propia documentación de Auth0 advierte de que esta herramienta puede ser destructiva;
  pruébala primero en un tenant de desarrollo antes de usar `prod`.
- Los client secrets no viven en el YAML: tómalos del Dashboard de Auth0.
- Si cambias los scopes en `tenant.yaml`, actualiza también `src/app.ts`.
- **No uses el Deploy CLI y Terraform sobre los mismos recursos del mismo tenant**: elige uno por
  tenant (por ejemplo, Terraform en `dev` y Deploy CLI en `prod`) o usa otro `API_NAME`/audience.
