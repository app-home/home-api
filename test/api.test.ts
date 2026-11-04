import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { createApp } from '../src/app.ts';
import type { Config } from '../src/config.ts';

const DOMAIN = 'test-tenant.example.auth0.com';
const ISSUER = `https://${DOMAIN}/`;
const AUDIENCE = 'https://home-api.test';
const KID = 'test-key';
const ALLOWED_ORIGIN = 'https://app.example.com';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' };

// Simula el discovery y el JWKS del tenant de Auth0 sin salir a la red.
const fakeAuth0Fetch: typeof fetch = (input) => {
  const request = new Request(input);
  const { pathname } = new URL(request.url);
  if (pathname === '/.well-known/openid-configuration') {
    return Promise.resolve(
      Response.json({ issuer: ISSUER, jwks_uri: `${ISSUER}.well-known/jwks.json` }),
    );
  }
  if (pathname === '/.well-known/jwks.json') {
    return Promise.resolve(Response.json({ keys: [jwk] }));
  }
  return Promise.resolve(new Response('not found', { status: 404 }));
};

interface TokenOptions {
  scope?: string;
  sub?: string;
  aud?: string;
  iss?: string;
  iat?: number;
  exp?: number;
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(options.scope === undefined ? {} : { scope: options.scope })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(options.sub ?? 'auth0|user-1')
    .setIssuer(options.iss ?? ISSUER)
    .setAudience(options.aud ?? AUDIENCE)
    .setIssuedAt(options.iat ?? now)
    .setExpirationTime(options.exp ?? now + 300)
    .sign(privateKey);
}

const config: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  AUTH0_DOMAIN: DOMAIN,
  AUTH0_AUDIENCE: AUDIENCE,
  CORS_ORIGINS: [ALLOWED_ORIGIN],
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 10_000,
  TRUST_PROXY: false,
};

describe('home-api', () => {
  const server = createApp({ config, customFetch: fakeAuth0Fetch }).listen(0);
  let baseUrl = '';

  before(async () => {
    if (!server.listening) {
      await new Promise<void>((resolve) => server.once('listening', resolve));
    }
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const get = (path: string, token?: string, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    });

  describe('rutas públicas', () => {
    it('GET /health responde ok', async () => {
      const res = await get('/health');
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: 'ok' });
    });

    it('GET /api/public no requiere token', async () => {
      const res = await get('/api/public');
      assert.equal(res.status, 200);
    });

    it('rutas desconocidas devuelven 404 en JSON', async () => {
      const res = await get('/no-existe');
      assert.equal(res.status, 404);
      assert.equal(((await res.json()) as { error: string }).error, 'not_found');
    });
  });

  describe('autenticación', () => {
    it('sin token devuelve 401 con WWW-Authenticate', async () => {
      const res = await get('/api/private');
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    });

    it('con token válido devuelve el sub', async () => {
      const res = await get('/api/private', await signToken({ sub: 'auth0|abc' }));
      assert.equal(res.status, 200);
      assert.equal(((await res.json()) as { sub: string }).sub, 'auth0|abc');
    });

    it('rechaza un audience incorrecto', async () => {
      const res = await get('/api/private', await signToken({ aud: 'https://otra-api' }));
      assert.equal(res.status, 401);
    });

    it('rechaza un issuer incorrecto', async () => {
      const res = await get(
        '/api/private',
        await signToken({ iss: 'https://otro-tenant.auth0.com/' }),
      );
      assert.equal(res.status, 401);
    });

    it('rechaza un token expirado', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await get('/api/private', await signToken({ iat: now - 600, exp: now - 300 }));
      assert.equal(res.status, 401);
    });

    it('rechaza un token firmado con otra clave', async () => {
      const other = await generateKeyPair('RS256');
      const forged = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setSubject('auth0|atacante')
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(other.privateKey);
      const res = await get('/api/private', forged);
      assert.equal(res.status, 401);
    });
  });

  describe('autorización por scope', () => {
    it('GET /api/messages sin el scope devuelve 403', async () => {
      const res = await get('/api/messages', await signToken({ scope: 'write:messages' }));
      assert.equal(res.status, 403);
    });

    it('GET /api/messages con el scope devuelve 200', async () => {
      const res = await get('/api/messages', await signToken({ scope: 'read:messages' }));
      assert.equal(res.status, 200);
    });

    it('POST /api/messages crea un mensaje con write:messages', async () => {
      const res = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await signToken({ scope: 'write:messages', sub: 'auth0|w' })}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: ' hola ' }),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { text: string; author: string };
      assert.equal(body.text, 'hola');
      assert.equal(body.author, 'auth0|w');
    });

    it('POST /api/messages valida el cuerpo', async () => {
      const res = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await signToken({ scope: 'write:messages' })}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: '' }),
      });
      assert.equal(res.status, 400);
    });
  });

  describe('CORS', () => {
    it('permite el origen configurado', async () => {
      const res = await get('/api/public', undefined, { Origin: ALLOWED_ORIGIN });
      assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    });

    it('no permite otros orígenes', async () => {
      const res = await get('/api/public', undefined, { Origin: 'https://malo.example.com' });
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    });
  });
});
