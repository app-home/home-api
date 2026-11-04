import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  it('aplica valores por defecto y parsea CORS_ORIGINS', () => {
    const config = loadConfig({
      AUTH0_DOMAIN: 'tenant.us.auth0.com',
      AUTH0_AUDIENCE: 'https://home-api.example.com',
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });
    assert.equal(config.PORT, 3001);
    assert.equal(config.TRUST_PROXY, false);
    assert.deepEqual(config.CORS_ORIGINS, ['http://a.test', 'http://b.test']);
  });

  it('falla si faltan variables obligatorias', () => {
    assert.throws(() => loadConfig({}), /AUTH0_DOMAIN/);
  });

  it('rechaza AUTH0_DOMAIN con https://', () => {
    assert.throws(
      () =>
        loadConfig({
          AUTH0_DOMAIN: 'https://tenant.us.auth0.com',
          AUTH0_AUDIENCE: 'https://home-api.example.com',
        }),
      /sin https/,
    );
  });
});
