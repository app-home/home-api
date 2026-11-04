import { randomUUID } from 'node:crypto';
import { createAuth0Api, requiresAuth } from '@auth0/auth0-express-api';
import type { Auth0ApiOptions } from '@auth0/auth0-express-api';
import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler, Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import type { Config } from './config.ts';

export interface AppOptions {
  config: Config;
  /** Solo para tests: permite simular el discovery/JWKS de Auth0. */
  customFetch?: typeof fetch;
}

const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

function statusOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const status = statusOf(error);
  if (status >= 500) {
    console.error(error);
    res.status(status).json({ error: 'internal_server_error', message: 'Error interno' });
    return;
  }
  const message = error instanceof Error ? error.message : 'Solicitud inválida';
  res.status(status).json({ error: 'bad_request', message });
};

export function createApp({ config, customFetch }: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const auth0Options: Auth0ApiOptions = {
    domain: config.AUTH0_DOMAIN,
    audience: config.AUTH0_AUDIENCE,
  };
  if (customFetch) {
    auth0Options.customFetch = customFetch;
  }
  app.use(createAuth0Api(auth0Options));

  // Rutas públicas
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/public', (_req, res) => {
    res.json({
      message: 'Endpoint público: no necesitas autenticarte.',
      timestamp: new Date().toISOString(),
    });
  });

  // Requiere un access token válido (cualquier scope)
  app.get('/api/private', requiresAuth(), (req, res) => {
    res.json({
      message: 'Endpoint protegido: te autenticaste correctamente.',
      sub: req.auth0.user?.sub,
    });
  });

  // Requieren scopes específicos
  app.get('/api/messages', requiresAuth({ scopes: 'read:messages' }), (_req, res) => {
    res.json({ messages: [] });
  });

  app.post('/api/messages', requiresAuth({ scopes: 'write:messages' }), (req, res) => {
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Cuerpo de la solicitud inválido',
        details: z.flattenError(parsed.error).fieldErrors,
      });
      return;
    }
    res.status(201).json({
      id: randomUUID(),
      text: parsed.data.text,
      author: req.auth0.user?.sub,
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Ruta no encontrada' });
  });
  app.use(errorHandler);

  return app;
}
