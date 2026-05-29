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
 *  10. 404 handler
 *  11. Global error handler (MUST be last)
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

import { env } from './config/env.js';
import { morganStream } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware.js';
import { globalRateLimiter, authRateLimiter } from './middleware/rateLimiter.middleware.js';
import router from './routes/index.js';

export const createApp = () => {
  const app = express();

  // ── [1] Security Headers ────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.isProduction ? undefined : false,
  }));

  // ── [2] CORS ────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        env.app.clientUrl,
        'http://localhost:5173',
        'http://localhost:3000',
      ];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Limit'],
  }));

  // ── [3] Body Parsers + Cookie ───────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // ── [4] Request ID Injection ────────────────────────────────────────────
  app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  });

  // ── [5] HTTP Request Logging ────────────────────────────────────────────
  app.use(morgan(env.isDevelopment ? 'dev' : 'combined', { stream: morganStream }));

  // ── [6] Global Rate Limiter ─────────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── [7] Reverse Proxy Trust ─────────────────────────────────────────────
  if (env.isProduction) app.set('trust proxy', 1);

  // ── [8] Health Check ────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'APIForge API',
      version: '1.0.0',
      environment: env.nodeEnv,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    });
  });

  // ── [9] API Routes ──────────────────────────────────────────────────────
  // Apply stricter rate limiting to auth routes
  app.use('/api/v1/auth', authRateLimiter);
  app.use('/api/v1', router);

  // ── [10] 404 Handler ────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── [11] Global Error Handler (MUST be last) ────────────────────────────
  app.use(errorHandler);

  return app;
};
