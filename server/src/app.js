/**
 * @file app.js
 * @description Express application factory — fully wired with all middleware.
 *
 * Middleware Order (deterministic — must not be changed):
 *   1. Security headers (helmet)
 *   2. CORS
 *   3. Body parsers + cookie parser
 *   4. Request ID injection (UUID per request for tracing)
 *   5. HTTP logging (morgan → winston)
 *   6. Global IP-based rate limiter
 *   7. Trust proxy (for Render/Railway reverse proxy)
 *   8. Health check (no auth)
 *   9. API routes (auth, projects, keys, logs, analytics)
 *  10. Static frontend (production only — serves built React app)
 *  11. 404 handler
 *  12. Global error handler (MUST be last)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

import { env } from './config/env.js';
import { morganStream } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware.js';
import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import router from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to the React production build (client/dist relative to server root)
const CLIENT_BUILD = path.resolve(__dirname, '../../client/dist');

export const createApp = () => {
  const app = express();

  // ── [1] Security Headers ────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'", "'unsafe-inline'"],
            styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
            imgSrc:     ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", env.app.apiBaseUrl],
          },
        }
      : false,
  }));

  // ── [2] CORS ─────────────────────────────────────────────────────────────
  //
  // Dev:  browser origin = http://localhost:5173 (Vite) → must be in allowlist
  // Prod: browser origin = http://localhost:5000 (same-origin) → arrives with
  //       no Origin header → the `!origin` guard passes it immediately.
  //       The allowlist is still needed for external API clients.
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin or server-to-server
      const allowedOrigins = new Set([
        env.app.clientUrl,       // from .env / .env.production
        'http://localhost:5173', // Vite dev server
        'http://localhost:5000', // Express (prod local)
      ]);
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Limit'],
  }));

  // ── [3] Body Parsers + Cookie ─────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // ── [4] Request ID Injection ──────────────────────────────────────────────
  app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  });

  // ── [5] HTTP Request Logging ──────────────────────────────────────────────
  app.use(morgan(env.isDevelopment ? 'dev' : 'combined', { stream: morganStream }));

  // ── [6] Global Rate Limiter ───────────────────────────────────────────────────
  // Applied to ALL routes (not just /api) so the static file server is
  // also protected. /health is excluded inside the limiter itself.
  app.use(globalRateLimiter);

  // ── [7] Reverse Proxy Trust ───────────────────────────────────────────────
  if (env.isProduction) app.set('trust proxy', 1);

  // ── [8] Health Check ──────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.status(200).json({
      status:      'ok',
      service:     'APIForge API',
      version:     '1.0.0',
      environment: env.nodeEnv,
      uptime:      `${Math.floor(process.uptime())}s`,
      timestamp:   new Date().toISOString(),
    });
  });

  // ── [9] API Routes ────────────────────────────────────────────────────────
  // NOTE: authRateLimiter is applied per-route inside auth.routes.js
  //       (login + register only) — NOT blanket on all /auth/* routes.
  //       This prevents /auth/refresh and /auth/me from consuming the limit.
  app.use('/api/v1', router);

  // ── [10] SPA / Frontend Serving ──────────────────────────────────────────
  if (env.isProduction) {
    // Serve hashed static assets (JS/CSS chunks) with aggressive long-term caching.
    // Files are content-hashed by Vite so 1y cache is safe.
    app.use(express.static(CLIENT_BUILD, {
      maxAge: '1y',
      immutable: true,
    }));

    // SPA catch-all: any non-API route serves index.html so React Router works.
    // '/{*path}' is the Express 5 wildcard syntax (Express 4 used '*')
    app.get('/{*path}', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
    });

  } else {
    // ── Development mode ──────────────────────────────────────────────────
    // In dev, Vite serves the frontend at http://localhost:5173.
    // All non-API GET requests to :5000 redirect to Vite so there's
    // never a confusing JSON 404 when navigating to localhost:5000/login.
    app.get('/{*path}', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      return res.redirect(302, `http://localhost:5173${req.path}`);
    });
  }


  // ── [11] 404 Handler ──────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── [12] Global Error Handler (MUST be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
};
