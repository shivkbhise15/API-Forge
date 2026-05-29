# APIForge — Package Requirements

> Complete list of all packages required for both the **server** and **client**. Run the install commands exactly as shown below.

---

## ⚙️ Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | >= 18.0.0 | Uses `node --watch` (no nodemon needed) |
| **npm** | >= 9.0.0 | Comes with Node 18+ |

---

## 🖥️ Server (`apiforge/server/`)

### Install Command

```bash
cd apiforge/server

# Production dependencies (one command)
npm install express mongoose bcryptjs jsonwebtoken express-validator helmet cors morgan uuid winston winston-daily-rotate-file dotenv joi nodemailer cookie-parser ioredis express-rate-limit node-cron @upstash/redis

# Dev dependencies
npm install --save-dev eslint jest @jest/globals
```

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.x | HTTP server framework |
| `mongoose` | ^8.x | MongoDB ODM with schema validation |
| `bcryptjs` | ^2.x | Password hashing (bcrypt, 12 salt rounds) |
| `jsonwebtoken` | ^9.x | JWT sign and verify (access + refresh tokens) |
| `express-validator` | ^7.x | Input validation and sanitization chains |
| `helmet` | ^8.x | Sets 11 security HTTP headers automatically |
| `cors` | ^2.x | Cross-Origin Resource Sharing middleware |
| `morgan` | ^1.x | HTTP request logging (streams to Winston) |
| `uuid` | ^11.x | UUID v4 for per-request trace IDs |
| `winston` | ^3.x | Structured logging (dev console + prod rotating files) |
| `winston-daily-rotate-file` | ^5.x | Log file rotation (20MB max, 30-day retention) |
| `dotenv` | ^16.x | Load `.env` into `process.env` |
| `joi` | ^17.x | Environment variable schema validation at startup |
| `nodemailer` | ^6.x | Send transactional emails (verification, password reset) |
| `cookie-parser` | ^1.x | Parse httpOnly refresh token cookie |
| `ioredis` | ^5.x | Redis client (reserved for ioredis usage if needed) |
| `express-rate-limit` | ^7.x | IP-based rate limiting middleware |
| `node-cron` | ^3.x | Schedule analytics aggregation cron jobs |
| `@upstash/redis` | ^1.x | Upstash REST-based Redis client (serverless-compatible) |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^10.x | JavaScript linter |
| `jest` | ^30.x | Unit and integration test runner |
| `@jest/globals` | ^30.x | Jest globals (`describe`, `it`, `expect`) |

---

## 🖱️ Client (`apiforge/client/`)

### Install Command

```bash
cd apiforge/client

# Scaffold with Vite (run once)
npx -y create-vite@latest ./ --template react --overwrite

# Then install all dependencies
npm install axios react-router-dom @tanstack/react-query zustand recharts framer-motion react-hot-toast lucide-react date-fns

# Tailwind CSS v4 (dev dependency)
npm install -D tailwindcss @tailwindcss/vite
```

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.x | UI library (auto-installed by Vite template) |
| `react-dom` | ^19.x | React DOM renderer (auto-installed) |
| `axios` | ^1.x | HTTP client with interceptors for token refresh |
| `react-router-dom` | ^7.x | Client-side routing and protected routes |
| `@tanstack/react-query` | ^5.x | Server state management, caching, background refetch |
| `zustand` | ^5.x | Lightweight global state (auth store) |
| `recharts` | ^3.x | Composable chart components (AreaChart, PieChart, BarChart) |
| `framer-motion` | ^12.x | Production-ready animations (sidebar, page transitions) |
| `react-hot-toast` | ^2.x | Notification toasts (success, error, info) |
| `lucide-react` | ^1.x | Icon library (consistent icon set throughout UI) |
| `date-fns` | ^4.x | Date formatting for log timestamps and chart labels |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.x | Build tool and dev server with HMR |
| `@vitejs/plugin-react` | ^6.x | React Fast Refresh plugin for Vite |
| `tailwindcss` | ^4.x | Utility-first CSS framework |
| `@tailwindcss/vite` | ^4.x | Tailwind v4 Vite plugin (replaces postcss config) |
| `eslint` | ^10.x | Linter |
| `eslint-plugin-react-hooks` | ^7.x | Enforce React hooks rules |
| `eslint-plugin-react-refresh` | ^0.5.x | Validate React Refresh compatibility |
| `@types/react` | ^19.x | TypeScript types for React (useful for editor IntelliSense) |
| `@types/react-dom` | ^19.x | TypeScript types for ReactDOM |
| `globals` | ^17.x | Global variable definitions for ESLint |

---

## 📦 Full Install Script (from monorepo root)

```bash
# ── Server ────────────────────────────────────────────────────────────────
cd apiforge/server
npm install express mongoose bcryptjs jsonwebtoken express-validator helmet cors morgan uuid winston winston-daily-rotate-file dotenv joi nodemailer cookie-parser ioredis express-rate-limit node-cron @upstash/redis
npm install --save-dev eslint jest @jest/globals

# ── Client ────────────────────────────────────────────────────────────────
cd ../client
npx -y create-vite@latest ./ --template react --overwrite
npm install axios react-router-dom @tanstack/react-query zustand recharts framer-motion react-hot-toast lucide-react date-fns
npm install -D tailwindcss @tailwindcss/vite
```

---

## 🔧 package.json — Server (final)

The server `package.json` should have `"type": "module"` for ES module support:

```json
{
  "name": "apiforge-server",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "dev":       "node --watch server.js",
    "start":     "node server.js",
    "test":      "node --experimental-vm-modules node_modules/.bin/jest",
    "test:watch":"jest --watch",
    "lint":      "eslint src/ --ext .js",
    "lint:fix":  "eslint src/ --ext .js --fix"
  },
  "dependencies": {
    "@upstash/redis":           "^1.x",
    "bcryptjs":                 "^2.x",
    "cookie-parser":            "^1.x",
    "cors":                     "^2.x",
    "dotenv":                   "^16.x",
    "express":                  "^4.x",
    "express-rate-limit":       "^7.x",
    "express-validator":        "^7.x",
    "helmet":                   "^8.x",
    "ioredis":                  "^5.x",
    "joi":                      "^17.x",
    "jsonwebtoken":             "^9.x",
    "mongoose":                 "^8.x",
    "morgan":                   "^1.x",
    "node-cron":                "^3.x",
    "nodemailer":               "^6.x",
    "uuid":                     "^11.x",
    "winston":                  "^3.x",
    "winston-daily-rotate-file":"^5.x"
  },
  "devDependencies": {
    "@jest/globals": "^30.x",
    "eslint":        "^10.x",
    "jest":          "^30.x"
  }
}
```

---

## ⚠️ Notes

> [!IMPORTANT]
> The server uses **ES Modules** (`"type": "module"` in package.json). All imports must use `import/export` syntax — no `require()`.

> [!NOTE]
> `@upstash/redis` uses the Upstash **REST API** — no persistent TCP connection. This works on serverless platforms (Render, Railway, Vercel). If you self-host Redis, swap it for `ioredis` with minimal code changes.

> [!NOTE]
> Tailwind CSS v4 uses the `@tailwindcss/vite` plugin instead of a `tailwind.config.js` file. Import it in `vite.config.js` — no separate PostCSS config needed.

> [!WARNING]
> `node --watch` (used in `npm run dev`) requires **Node.js 18.11+**. It's the built-in equivalent of nodemon — no additional package needed.
