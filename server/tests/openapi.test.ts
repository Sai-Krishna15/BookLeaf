import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';

const SPEC = path.join(__dirname, '..', 'openapi.yaml');

// Every route the app currently mounts. When a phase adds routes, add them here AND to openapi.yaml.
const IMPLEMENTED: Array<[string, string]> = [
  ['/health', 'get'],
  ['/auth/login', 'post'],
  ['/auth/me', 'get'],
  ['/books', 'get'],
  ['/books/summary', 'get'],
  ['/books/{id}', 'get'],
  // Phase 5: tickets
  ['/tickets', 'post'],
  ['/tickets', 'get'],
  ['/tickets/{id}', 'get'],
  ['/tickets/{id}/messages', 'get'],
  ['/tickets/{id}/messages', 'post'],
];

describe('openapi.yaml', () => {
  it('is a valid OpenAPI 3 document (schema + all $refs resolve)', async () => {
    const api = (await SwaggerParser.validate(SPEC)) as { openapi: string };
    expect(api.openapi).toMatch(/^3\./);
  });

  it('documents every implemented endpoint', async () => {
    const api = (await SwaggerParser.validate(SPEC)) as { paths: Record<string, Record<string, unknown>> };
    for (const [p, method] of IMPLEMENTED) {
      expect(api.paths[p]?.[method], `${method.toUpperCase()} ${p} missing from openapi.yaml`).toBeDefined();
    }
  });

  it('declares bearerAuth globally, with public endpoints opting out', async () => {
    const api = (await SwaggerParser.validate(SPEC)) as {
      security: unknown[];
      components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
      paths: Record<string, Record<string, { security?: unknown[] }>>;
    };
    expect(api.components.securitySchemes.bearerAuth).toBeDefined();
    expect(api.security).toEqual([{ bearerAuth: [] }]);
    expect(api.paths['/health']!.get!.security).toEqual([]);
    expect(api.paths['/auth/login']!.post!.security).toEqual([]);
    expect(api.paths['/books']!.get!.security).toBeUndefined();
    expect(api.components.schemas.ErrorResponse).toBeDefined();
  });
});
