/**
 * @file env.js
 * @description Centralized environment variable validation using Joi.
 *
 * File loading order:
 *   NODE_ENV=development → loads .env
 *   NODE_ENV=production  → loads .env.production
 *
 * Fail-fast: if any required variable is missing the process exits
 * immediately with a descriptive list of what's wrong.
 *
 * Environment gates:
 *   - SMTP required in production, optional in development
 *     (dev auto-verifies email so SMTP is never called)
 *   - HTTPS_ONLY controls the cookie `secure` flag independently
 *     of NODE_ENV so you can test the production build locally over HTTP
 */

import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load the correct .env file ────────────────────────────────────────────
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile  = nodeEnv === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, `../../${envFile}`) });

const isProduction = nodeEnv === 'production';

const envSchema = Joi.object({
  // ── Server ───────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),

  // ── MongoDB ──────────────────────────────────────────────
  MONGODB_URI: Joi.string().uri().required(),

  // ── JWT ──────────────────────────────────────────────────
  JWT_ACCESS_SECRET:    Joi.string().min(32).required(),
  JWT_REFRESH_SECRET:   Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN:  Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ── Email / SMTP ─────────────────────────────────────────
  // Required in production (real emails sent), optional in dev (auto-verified).
  // NOTE: don't chain .default() after .required() — Joi ignores the required()
  SMTP_HOST: isProduction
    ? Joi.string().required()
    : Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: isProduction
    ? Joi.string().required()
    : Joi.string().default('noreply@example.com'),
  SMTP_PASS: isProduction
    ? Joi.string().required()
    : Joi.string().allow('').default(''),
  EMAIL_FROM: isProduction
    ? Joi.string().required()
    : Joi.string().default('APIForge <noreply@apiforge.dev>'),
  EMAIL_VERIFY_TOKEN_EXPIRES_HOURS: Joi.number().default(24),

  // ── Redis (Upstash) ──────────────────────────────────────
  UPSTASH_REDIS_REST_URL:   Joi.string().uri().required(),
  UPSTASH_REDIS_REST_TOKEN: Joi.string().required(),

  // ── App URLs ─────────────────────────────────────────────
  // Dev:  CLIENT_URL=http://localhost:5173  (Vite dev server)
  // Prod: CLIENT_URL=http://localhost:5000  (Express serves built SPA)
  CLIENT_URL:   Joi.string().uri().default(
    isProduction ? 'http://localhost:5000' : 'http://localhost:5173',
  ),
  API_BASE_URL: Joi.string().uri().default('http://localhost:5000'),

  // ── Cookie security ──────────────────────────────────────
  // HTTPS_ONLY=true  → secure cookie (requires HTTPS, use on Render/Railway)
  // HTTPS_ONLY=false → non-secure cookie (HTTP, use for local prod testing)
  HTTPS_ONLY: Joi.boolean().default(isProduction),

  // ── Rate Limiting ────────────────────────────────────────
  GLOBAL_RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  GLOBAL_RATE_LIMIT_MAX:       Joi.number().default(isProduction ? 200 : 500),

}).unknown(true);

const { error, value: v } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  const msgs = error.details.map((d) => `  ✖ ${d.message}`).join('\n');
  console.error(`\n[ENV] Invalid or missing environment variables:\n${msgs}\n`);
  process.exit(1);
}

export const env = Object.freeze({
  nodeEnv:       v.NODE_ENV,
  port:          v.PORT,
  isProduction:  v.NODE_ENV === 'production',
  isStaging:     v.NODE_ENV === 'staging',
  isDevelopment: v.NODE_ENV === 'development',
  isTest:        v.NODE_ENV === 'test',

  // true only when HTTPS is available (affects cookie `secure` flag)
  httpsOnly: v.HTTPS_ONLY,

  mongodb: { uri: v.MONGODB_URI },

  jwt: {
    accessSecret:     v.JWT_ACCESS_SECRET,
    refreshSecret:    v.JWT_REFRESH_SECRET,
    accessExpiresIn:  v.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: v.JWT_REFRESH_EXPIRES_IN,
  },

  email: {
    host:                    v.SMTP_HOST,
    port:                    v.SMTP_PORT,
    user:                    v.SMTP_USER,
    pass:                    v.SMTP_PASS,
    from:                    v.EMAIL_FROM,
    verifyTokenExpiresHours: v.EMAIL_VERIFY_TOKEN_EXPIRES_HOURS,
  },

  redis: {
    url:   v.UPSTASH_REDIS_REST_URL,
    token: v.UPSTASH_REDIS_REST_TOKEN,
  },

  app: {
    clientUrl:  v.CLIENT_URL,
    apiBaseUrl: v.API_BASE_URL,
  },

  rateLimit: {
    windowMs: v.GLOBAL_RATE_LIMIT_WINDOW_MS,
    max:      v.GLOBAL_RATE_LIMIT_MAX,
  },
});
