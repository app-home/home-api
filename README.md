# home-api

API REST protegida con JWT de [Auth0](https://auth0.com). Cualquier frontend o sistema puede
consumirla presentando un access token emitido para el audience de la API.

- **Runtime:** Node.js 26.13.0 (LTS "Lithium"), ESM
- **Lenguaje:** TypeScript (Node ejecuta los `.ts` directamente en desarrollo y tests)
- **Framework:** Express 5
- **Auth:** [`@auth0/auth0-express-api`](https://www.npmjs.com/package/@auth0/auth0-express-api)
- **Infraestructura de Auth0 como código:** Terraform **o** Auth0 Deploy CLI (carpeta `infra/`)

## Inicio rápido

```bash
# 1. Usa la versión de Node del proyecto (fnm, nvm-windows, Volta...)
node --version   # v26.13.0

# 2. Instala dependencias
npm install

# 3. Crea los recursos en Auth0 (ver "Auth0 como código") y configura el entorno
cp .env.example .env   # completa AUTH0_DOMAIN y AUTH0_AUDIENCE

# 4. Arranca en modo desarrollo (recarga automática)
npm run dev
```

## Variables de entorno

| Variable                                  | Obligatoria | Descripción                                         |
| ----------------------------------------- | ----------- | --------------------------------------------------- |
| `AUTH0_DOMAIN`                            | Sí          | Dominio del tenant, **sin** `https://`              |
| `AUTH0_AUDIENCE`                          | Sí          | Identifier de la API en Auth0                       |
| `PORT`                                    | No          | Puerto (por defecto `3001`)                         |
| `CORS_ORIGINS`                            | No          | Orígenes permitidos, separados por comas            |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | No          | Ventana y máximo de peticiones por IP (60 s / 100)  |
| `TRUST_PROXY`                             | No          | `true` solo detrás de un proxy o balanceador propio |

La configuración se valida con Zod al arrancar: si falta algo, la API no inicia.

## Endpoints

| Método | Ruta            | Acceso                 |
| ------ | --------------- | ---------------------- |
| GET    | `/health`       | Público                |
| GET    | `/api/public`   | Público                |
| GET    | `/api/private`  | Access token válido    |
| GET    | `/api/messages` | Scope `read:messages`  |
| POST   | `/api/messages` | Scope `write:messages` |

Sin token se responde `401` con `WWW-Authenticate: Bearer`; con token válido pero sin el scope
requerido, `403` (`insufficient_scope`).

## Cómo consumir la API

**Desde un frontend (SPA)** con `@auth0/auth0-spa-js`:

```ts
const auth0 = await createAuth0Client({
  domain: 'tu-tenant.us.auth0.com',
  clientId: '<spa_client_id>',
  authorizationParams: { audience: 'https://home-api.example.com', redirect_uri: location.origin },
});
const token = await auth0.getTokenSilently();
const res = await fetch('http://localhost:3001/api/messages', {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Desde otro sistema (Machine-to-Machine):**

```bash
TOKEN=$(curl -s --request POST "https://$AUTH0_DOMAIN/oauth/token" \
  --header 'content-type: application/json' \
  --data '{"client_id":"<m2m_client_id>","client_secret":"<m2m_client_secret>","audience":"'"$AUTH0_AUDIENCE"'","grant_type":"client_credentials"}' \
  | jq -r .access_token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/messages
```

Errores típicos: usar un **ID token** en lugar de un access token, o pedir el token sin `audience`.
El `iss` del token incluye barra final (`https://tu-tenant.us.auth0.com/`).

## Auth0 como código

En `infra/` hay dos implementaciones equivalentes que crean la API (con sus scopes), una SPA de
ejemplo, una aplicación M2M con su grant y los roles `reader` / `writer`:

- [`infra/terraform`](infra/terraform/README.md): provider `auth0/auth0`. Da `plan` antes de aplicar.
- [`infra/deploy-cli`](infra/deploy-cli/README.md): `auth0-deploy-cli` con `tenant.yaml`.

> Usa **uno por tenant**. Ambos definen los mismos recursos y no deben gestionarse a la vez sobre
> el mismo tenant. Si cambias los scopes, actualiza también `src/app.ts`.

## Scripts

| Script                            | Qué hace                                        |
| --------------------------------- | ----------------------------------------------- |
| `npm run dev`                     | Servidor con recarga (`node --watch`)           |
| `npm run build` / `npm start`     | Compila a `dist/` y ejecuta                     |
| `npm test`                        | Tests con `node:test` (sin red, Auth0 simulado) |
| `npm run lint` / `typecheck`      | ESLint (type-aware) y `tsc --noEmit`            |
| `npm run format`                  | Prettier                                        |
| `npm run deploy-cli:import:<env>` | Aplica `tenant.yaml` (`dev` o `prod`)           |

## Contenedor

```bash
podman build -t home-api .
podman run --rm -p 3001:3001 --env-file .env home-api
```

La imagen usa `node:26.13.0-slim`, build multi-stage y se ejecuta con el usuario no root `node`.

## CI

- `ci.yml`: formato, lint, typecheck, tests y build en cada push y PR.
- `infra-terraform.yml`: `fmt` y `validate` en PRs; `plan`/`apply` manual con un Environment protegido.
- `infra-deploy-cli.yml`: despliegue manual a `dev` o `prod`.
- Dependabot para npm, GitHub Actions, Terraform y Docker.

Secrets necesarios para la infra: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
(de la app M2M dedicada a IaC). Para Terraform, además la variable `API_IDENTIFIER` y un backend remoto.
