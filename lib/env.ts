import { z } from 'zod';

/**
 * Environment variable schema with validation.
 * All environment variables should be accessed through this module.
 */

const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1),

  // GitHub App credentials
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  // Session
  SESSION_SECRET: z.string().min(32),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables.
 * Throws at startup if required variables are missing.
 */
function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

// In development, we allow lazy initialization to support Next.js hot reload
// In production, we validate immediately
let _env: Env | undefined;

export function env(): Env {
  if (!_env) {
    _env = getEnv();
  }
  return _env;
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
  return env().NODE_ENV === 'development';
}

/**
 * Check if we're in test environment
 */
export function isTest(): boolean {
  return env().NODE_ENV === 'test';
}

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  return env().NEXT_PUBLIC_APP_URL;
}
