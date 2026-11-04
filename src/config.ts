import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  /** Dominio del tenant de Auth0, sin https:// (p. ej. mi-tenant.us.auth0.com). */
  AUTH0_DOMAIN: z
    .string()
    .trim()
    .min(1, 'es obligatorio')
    .refine((value) => !/^https?:\/\//i.test(value) && !value.endsWith('/'), {
      message: 'debe ir sin https:// y sin barra final',
    }),
  /** Identifier de la API en Auth0 (el "audience" de los access tokens). */
  AUTH0_AUDIENCE: z.string().trim().min(1, 'es obligatorio'),
  /** Orígenes permitidos por CORS, separados por comas. Vacío = ninguno. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  /** Poner en true detrás de un proxy o balanceador de confianza. */
  TRUST_PROXY: z.stringbool().default(false),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Configuración inválida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
