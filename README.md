# APIForge 🔥

> **Production-grade backend infrastructure platform** — API key management, request logging, analytics, and rate limiting. Built with Node.js, Express, MongoDB, React, and TailwindCSS.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://mongodb.com/atlas)
[![Redis](https://img.shields.io/badge/Redis-Upstash-red.svg)](https://upstash.com)

---

## Architecture

```
Client (React/Vite) → Express API → Middleware Pipeline → Services → MongoDB Atlas
                                                         ↓
                                               Upstash Redis (rate limits + cache)
                                                         ↓
                                              Winston Logs + Cron Analytics Jobs
```

**Request lifecycle**: Security headers → CORS → Rate limit → JWT/API Key auth → Validation → Service → Response → Async request log write

---

## Features

| Feature | Details |
|---------|---------|
| **Auth** | JWT (15min) + Refresh token (7d httpOnly cookie), email verification, password reset, brute-force protection |
| **API Keys** | `ak_{prefix}_{64-char random}` — prefix stored for O(1) lookup, SHA-256 hash for validation. Full key shown once. |
| **Projects** | Multi-environment (dev/staging/prod), rate limit config per project, soft-delete |
| **Request Logging** | Async fire-and-forget writes, 90-day TTL auto-purge, sub-millisecond precision timing |
| **Analytics** | Aggregation pipelines, daily volume charts, status distribution, top endpoints, response time percentiles |
| **Rate Limiting** | Global IP-based (express-rate-limit), strict auth limiter, per-API-key sliding window in Redis |
| **Security** | helmet, CORS whitelist, sanitized inputs, timing-safe key comparison, no secrets in logs |

---

## Project Structure

```
apiforge/
├── server/
│   ├── src/
│   │   ├── config/         # env validation, DB, Redis, logger
│   │   ├── constants/      # HTTP status, messages, roles
│   │   ├── controllers/    # thin route handlers
│   │   ├── helpers/        # aggregation pipeline builders
│   │   ├── jobs/           # analytics cron jobs
│   │   ├── middleware/     # auth, apiKey, rateLimiter, errorHandler, validate
│   │   ├── models/         # 7 Mongoose schemas with indexing
│   │   ├── routes/         # versioned route definitions
│   │   ├── services/       # all business logic
│   │   ├── utils/          # ApiError, ApiResponse, crypto, jwt, pagination
│   │   └── app.js          # Express factory
│   └── server.js           # HTTP entry + graceful shutdown
└── client/
    └── src/
        ├── api/            # Axios modules per domain
        ├── layouts/        # DashboardLayout (animated sidebar)
        ├── pages/          # Dashboard, Projects, ApiKeys, Logs, Analytics, Auth
        ├── routes/         # ProtectedRoute
        └── store/          # Zustand auth store
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>

# Backend
cd apiforge/server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure Environment

```bash
cd apiforge/server
cp .env.example .env
# Fill in: MONGODB_URI, JWT secrets, SMTP credentials, Upstash Redis URL + token
```

**Required services:**
- [MongoDB Atlas](https://mongodb.com/atlas) — Free M0 tier works for development
- [Upstash Redis](https://upstash.com) — Free tier: 10,000 req/day
- SMTP: [Brevo](https://brevo.com) free tier or Gmail App Password

### 3. Run

```bash
# Terminal 1 — Backend
cd apiforge/server
npm run dev

# Terminal 2 — Frontend
cd apiforge/client
npm run dev
```

Frontend: `http://localhost:5173` | Backend: `http://localhost:5000`

---

## API Reference

All endpoints are prefixed `/api/v1`.

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register + send verification email |
| POST | `/auth/login` | — | Login, returns access token |
| POST | `/auth/logout` | JWT | Revoke session |
| POST | `/auth/refresh` | Cookie | Rotate tokens |
| GET  | `/auth/verify-email/:token` | — | Verify email |
| POST | `/auth/forgot-password` | — | Send reset email |
| POST | `/auth/reset-password` | — | Complete reset |
| GET  | `/auth/me` | JWT | Get profile |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/projects` | Create project |
| GET  | `/projects` | List user's projects |
| GET  | `/projects/:id` | Get project |
| PUT  | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Soft-delete project |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/keys` | Create key (returns fullKey ONCE) |
| GET  | `/keys?projectId=` | List project's keys |
| GET  | `/keys/:id` | Get key details |
| PATCH | `/keys/:id` | Update name/description |
| PATCH | `/keys/:id/revoke` | Revoke key |
| DELETE | `/keys/:id` | Hard delete (must be revoked first) |

### Logs & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs?projectId=` | Paginated request logs |
| GET | `/logs/summary?projectId=` | 24h summary stats |
| GET | `/analytics/overview` | Cross-project stats |
| GET | `/analytics/dashboard?projectId=&days=30` | Full project analytics |
| GET | `/analytics/snapshots?projectId=&days=30` | Pre-aggregated daily data |

---

## Environment Variables

See [`server/.env.example`](./server/.env.example) for full documentation.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars — use `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | Different from access secret |
| `SMTP_HOST/PORT/USER/PASS` | ✅ | Email provider credentials |
| `UPSTASH_REDIS_REST_URL` | ✅ | From Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | From Upstash Console |
| `CLIENT_URL` | ✅ | Frontend URL for CORS |

---

## Deployment

### Backend → Render/Railway

1. Create a new Web Service
2. Connect your repo, set root to `apiforge/server`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all env vars from `.env.example`

### Frontend → Vercel

1. Import repo on Vercel
2. Set root to `apiforge/client`
3. Add env var: `VITE_API_URL=https://your-backend.onrender.com/api/v1`

### MongoDB Atlas

1. Create free M0 cluster at mongodb.com/atlas
2. Create database user + password
3. Whitelist `0.0.0.0/0` (or specific IPs for production)
4. Copy connection string → `MONGODB_URI`

### Upstash Redis

1. Create database at console.upstash.com
2. Copy **REST URL** and **REST Token** → env vars

---

## Security Notes

- JWT access tokens are stored **in memory only** (not localStorage) — XSS resistant
- Refresh tokens are **httpOnly cookies** — not accessible to JavaScript
- API keys use **SHA-256 hashing** — the plaintext is never stored
- **Timing-safe comparison** prevents key validation timing attacks
- All inputs validated with express-validator before reaching controllers
- Rate limiting on all endpoints; stricter limits on auth endpoints

---

## Scalability Path

| Stage | Approach |
|-------|---------|
| **MVP** | Single Node.js + MongoDB Atlas M10 + Upstash |
| **Growth** | Add Redis cache for API key validation (skip DB on every request) |
| **Scale** | Horizontal Express instances behind Nginx, write logs to Bull queue |
| **Enterprise** | Split into microservices: Auth, Keys, Logs, Analytics services |

**Bottleneck mitigations:**
- `request_logs`: 90-day TTL + async writes + future: queue batch insert
- Analytics: pre-aggregated snapshots via cron — dashboard never hits raw logs
- API key validation: Redis LRU cache as next optimization layer

---

*Built as a production-grade portfolio project demonstrating backend engineering, system design, API security, and scalable architecture.*
