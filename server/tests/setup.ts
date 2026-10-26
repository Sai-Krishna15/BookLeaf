// Runs before any test file imports config/env.ts.
// Loads server/.env first so tests use the real DATABASE_URL (Neon) for DB-backed tests;
// anything missing falls back to fake values. Never commit real secrets here.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.AI_ENABLED = 'false';
