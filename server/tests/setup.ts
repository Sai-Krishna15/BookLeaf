// Runs in every test worker before any test file imports config/env.ts.
// Repoints the app and Prisma client at DATABASE_URL_TEST, and aborts if that is unsafe.
import 'dotenv/config';
import { assertSafeTestDatabase, mainDatabaseUrl } from '../scripts/test-db';

const testUrl = assertSafeTestDatabase(process.env.DATABASE_URL_TEST, mainDatabaseUrl());

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.AI_ENABLED = 'false';
