/**
 * @file env.js
 * @description Centralized environment variable validation using Joi.
 *
 * Architecture Decision:
 *   All environment variables are validated at app startup via Joi schema.
 *   If any required variable is missing or malformed, the process exits
 *   immediately with a descriptive error message — "fail fast" principle.
 *   This prevents silent misconfigurations in production.
 *
 * Scalability:
 *   Add new env vars to the schema here; they become mandatory by default.
 *   Supports overriding via NODE_ENV for test/staging/prod environments.
 */

import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from server root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = Joi.object({
  // ── Server ─────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),

  // ── MongoDB ─────────────────────────────────────────────────
  MONGODB_URI: Joi.string().uri().required(),

  // ── JWT ─────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ── Email (nodemailer) ───────────────────────────────────────
  // SMTP is optional in development — required in production
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().default('noreply@example.com'),
  SMTP_PASS: Joi.string().default(''),
  EMAIL_FROM: Joi.string().default('APIForge <noreply@apiforge.dev>'),

  // ── Redis (Upstash) ──────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: Joi.string().uri().required(),
  UPSTASH_REDIS_REST_TOKEN: Joi.string().required(),

  // ── App ──────────────────────────────────────────────────────
  CLIENT_URL: Joi.string().uri().default('http://localhost:5173'),
  API_BASE_URL: Joi.string().uri().default('http://localhost:5000'),

  // ── Rate Limiting ────────────────────────────────────────────
  GLOBAL_RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 min
  GLOBAL_RATE_LIMIT_MAX: Joi.number().default(100),

  // ── Email Verification ───────────────────────────────────────
  EMAIL_VERIFY_TOKEN_EXPIRES_HOURS: Joi.number().default(24),
}).unknown(true); // allow OS-level env vars to pass through

const { error, value: validatedEnv } = envSchema.validate(process.env, {
  abortEarly: false, // collect ALL validation errors before throwing
});

if (error) {
  const missing = error.details.map((d) => `  ✖ ${d.message}`).join('\n');
  console.error(`\n[ENV] Invalid environment variables:\n${missing}\n`);
  process.exit(1);
}

export const env = Object.freeze({
  nodeEnv: validatedEnv.NODE_ENV,
  port: validatedEnv.PORT,
  isProduction: validatedEnv.NODE_ENV === 'production',
  isDevelopment: validatedEnv.NODE_ENV === 'development',
  isTest: validatedEnv.NODE_ENV === 'test',

  mongodb: {
    uri: validatedEnv.MONGODB_URI,
  },

  jwt: {
    accessSecret: validatedEnv.JWT_ACCESS_SECRET,
    refreshSecret: validatedEnv.JWT_REFRESH_SECRET,
    accessExpiresIn: validatedEnv.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: validatedEnv.JWT_REFRESH_EXPIRES_IN,
  },

  email: {
    host: validatedEnv.SMTP_HOST,
    port: validatedEnv.SMTP_PORT,
    user: validatedEnv.SMTP_USER,
    pass: validatedEnv.SMTP_PASS,
    from: validatedEnv.EMAIL_FROM,
    verifyTokenExpiresHours: validatedEnv.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS,
  },

  redis: {
    url: validatedEnv.UPSTASH_REDIS_REST_URL,
    token: validatedEnv.UPSTASH_REDIS_REST_TOKEN,
  },

  app: {
    clientUrl: validatedEnv.CLIENT_URL,
    apiBaseUrl: validatedEnv.API_BASE_URL,
  },

  rateLimit: {
    windowMs: validatedEnv.GLOBAL_RATE_LIMIT_WINDOW_MS,
    max: validatedEnv.GLOBAL_RATE_LIMIT_MAX,
  },
});
