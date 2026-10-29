import 'dotenv/config';
import { z } from 'zod';

/** Treat empty strings (e.g. `GROQ_API_KEY=`) as "not set". */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // Direct (non-pooled) URL, used only by Prisma migrations (prisma.config.ts).
    DATABASE_URL_UNPOOLED: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    // Dedicated database for automated tests. Required (and enforced) when NODE_ENV=test.
    DATABASE_URL_TEST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().min(1).default('1d'),
    CLIENT_ORIGIN: z.preprocess(
      (v) => {
        if (typeof v === 'string' && v.trim() !== '') return v;
        if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
        return 'http://localhost:5173';
      },
      z.string().url(),
    ),

    GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash-lite'),
    GROQ_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GROQ_MODEL: z.string().min(1).default('llama-3.1-8b-instant'),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
    AI_RPM_LIMIT: z.coerce.number().int().positive().default(10),
    AI_ENABLED: z.preprocess(emptyToUndefined, booleanFromString.default(true)),
  })
  .superRefine((env, ctx) => {
    // Assumption: a Gemini key is only mandatory when AI is switched on.
    if (env.AI_ENABLED && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when AI_ENABLED=true',
      });
    }
    // Defence in depth: tests/setup.ts repoints DATABASE_URL at the test DB. If NODE_ENV=test is
    // ever used without that, refuse to start rather than touch the main database.
    if (env.NODE_ENV === 'test' && (!env.DATABASE_URL_TEST || env.DATABASE_URL !== env.DATABASE_URL_TEST)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'NODE_ENV=test requires DATABASE_URL to equal DATABASE_URL_TEST (tests must not use the main database)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    // Logger depends on env, so write directly to stderr and fail fast.
    process.stderr.write(`Invalid environment configuration:\n${lines.join('\n')}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
