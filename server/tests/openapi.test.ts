import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const SPEC = path.join(__dirname, '..', 'openapi.yaml');

async function loadOpenApi() {
  const { default: $RefParser } = await import('@apidevtools/json-schema-ref-parser');
  return (await $RefParser.dereference(SPEC)) as any;
}

function extractExpressRoutes(app: any): Array<{ path: string; method: string }> {
  const routes: Array<{ path: string; method: string }> = [];
  const knownPrefixes = [
    '/api/v1/health',
    '/api/v1/auth',
    '/api/v1/books',
    '/api/v1/tickets',
    '/api/v1/admin',
  ];

  for (const layer of app.router.stack) {
    if (layer.name === 'router' && layer.handle?.stack) {
      let matchedPrefix = '';
      for (const prefix of knownPrefixes) {
        if (layer.matchers?.[0]?.(prefix)) {
          matchedPrefix = prefix;
          break;
        }
      }
      for (const subLayer of layer.handle.stack) {
        if (subLayer.route) {
          const subPath = subLayer.route.path === '/' ? '' : subLayer.route.path;
          const fullPath = (matchedPrefix + subPath).replace(/\/+/g, '/');
          for (const method of Object.keys(subLayer.route.methods)) {
            const openApiPath = fullPath
              .replace(/^\/api\/v1/, '')
              .replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
            routes.push({ path: openApiPath, method: method.toLowerCase() });
          }
        }
      }
    }
  }
  return routes;
}

describe('openapi.yaml & Swagger UI', () => {
  it('is a valid OpenAPI 3 document (schema + all $refs resolve)', async () => {
    const api = await loadOpenApi();
    expect(api.openapi).toMatch(/^3\./);
  });

  it('compares the Express route list against openapi.yaml and fails on a mismatch', async () => {
    const app = createApp();
    const expressRoutes = extractExpressRoutes(app);
    const api = await loadOpenApi();

    expect(expressRoutes.length).toBeGreaterThanOrEqual(18);

    for (const r of expressRoutes) {
      const openApiOp = api.paths[r.path]?.[r.method];
      expect(
        openApiOp,
        `Express route ${r.method.toUpperCase()} ${r.path} is missing from openapi.yaml`,
      ).toBeDefined();
    }

    // Verify all routes in openapi.yaml exist in Express
    for (const [openPath, methods] of Object.entries(api.paths)) {
      for (const method of Object.keys(methods as Record<string, unknown>)) {
        if (['get', 'post', 'patch', 'put', 'delete'].includes(method.toLowerCase())) {
          const match = expressRoutes.find(
            (r) => r.path === openPath && r.method === method.toLowerCase(),
          );
          expect(
            match,
            `OpenAPI path ${method.toUpperCase()} ${openPath} is documented in openapi.yaml but not registered in Express`,
          ).toBeDefined();
        }
      }
    }
  });

  it('declares bearerAuth globally, with public endpoints opting out', async () => {
    const api = await loadOpenApi();
    expect(api.components.securitySchemes.bearerAuth).toBeDefined();
    expect(api.security).toEqual([{ bearerAuth: [] }]);
    expect(api.paths['/health']!.get!.security).toEqual([]);
    expect(api.paths['/auth/login']!.post!.security).toEqual([]);
    expect(api.paths['/books']!.get!.security).toBeUndefined();
    expect(api.components.schemas.ErrorResponse).toBeDefined();
  });

  it('serves Swagger UI at /api/docs and openapi.yaml at /api/docs/openapi.yaml', async () => {
    const app = createApp();
    const docsRes = await request(app).get('/api/docs/');
    expect(docsRes.status).toBe(200);
    expect(docsRes.text).toContain('swagger-ui');

    const yamlRes = await request(app).get('/api/docs/openapi.yaml');
    expect(yamlRes.status).toBe(200);
    expect(yamlRes.headers['content-type']).toContain('yaml');
    expect(yamlRes.text).toContain('BookLeaf Author Support');

    const redirectRes = await request(app).get('/api/v1/docs');
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.location).toBe('/api/docs');
  });
});
