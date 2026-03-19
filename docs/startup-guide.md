# SEO & GEO Optimizer — Startup Guide

## Prerequisites

- **Docker Desktop** (running)
- **Node.js 18+** (for the Next.js frontend)
- **A Gemini API key** with available quota from [Google AI Studio](https://aistudio.google.com/apikey)

---

## 1. Environment Setup

Copy the example and fill in your keys:

```bash
cd seo-geo-optimizer

# Root .env (used by Docker Compose)
cp .env.example .env   # or edit .env directly
```

**Required in `.env`:**

```env
GEMINI_API_KEY=your-gemini-api-key-here
JWT_SECRET=any-random-secret-string
```

**Optional (enable when ready):**

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_CLIENT_ID=...          # For Google OAuth login
GOOGLE_CLIENT_SECRET=...
SENTRY_DSN=...                # Error tracking
POSTHOG_API_KEY=...           # Product analytics
```

Also update `backend/.env` for local (non-Docker) development:

```env
GEMINI_API_KEY=your-gemini-api-key-here
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/seo_geo_optimizer
```

---

## 2. Start the Backend (Docker)

```bash
# Build and start all services (API + PostgreSQL + Redis)
docker compose up --build -d

# Verify all 3 containers are running
docker compose ps
```

You should see:

| Service  | Port | Description          |
|----------|------|----------------------|
| api      | 8000 | FastAPI backend      |
| postgres | 5432 | PostgreSQL database  |
| redis    | —    | Cache (internal only)|

---

## 3. Run Database Migrations

```bash
docker compose exec api alembic upgrade head
```

This creates all 10 migration versions (users, scans, billing, audits, analytics, teams, subscriptions, analyses, brand voices, competitors, API keys).

---

## 4. Verify the Backend

### Health check

```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"seo-geo-optimizer"}
```

### Swagger API docs

Open in browser: **http://localhost:8000/docs**

All 12 API router groups are listed:
- `/api/v1/analyze` & `/api/v1/score` — Core analysis
- `/api/v1/auth/*` — JWT registration/login
- `/api/v1/auth/google/*` — Google OAuth
- `/api/v1/billing/*` — Stripe billing
- `/api/v1/schema/*` — JSON-LD schema generation
- `/api/v1/audit/*` — Multi-page site audit
- `/api/v1/analytics/*` — Event analytics
- `/api/v1/analyses` & `/api/v1/trends` — History & trends
- `/api/v1/teams/*` — Team management
- `/api/v1/competitors/*` — Competitor tracking
- `/api/v1/brand-voice/*` — Brand voice training
- `/api/v1/export/*` — Report export (HTML, CSV, JSON, PDF, WordPress XML)

### Register a test user

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}'
```

Returns a JWT access token you can use for authenticated endpoints.

### Run an analysis

```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "meta": {"title": "My Page", "title_length": 7},
    "content": {"full_text": "Your page content here...", "word_count": 5},
    "headings": {"h1": [{"index": 0, "text": "My Page"}]},
    "links": {"internal_count": 3, "external_count": 1}
  }'
```

---

## 5. Start the Next.js Frontend

```bash
cd web
npm install
npm run dev
```

Open in browser: **http://localhost:3000**

Pages available:
- `/` — Landing page (hero, features, pricing)
- `/login` — Login form
- `/register` — Registration form
- `/dashboard` — Main dashboard with score overview
- `/dashboard/history` — Analysis history
- `/dashboard/audits` — Site audit management
- `/dashboard/competitors` — Competitor tracking
- `/dashboard/teams` — Team management
- `/dashboard/settings` — Account settings

---

## 6. Load the Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Navigate to any webpage — the extension runs automatically
6. Click the extension icon to open the popup dashboard

---

## 7. Stopping Everything

```bash
# Stop all Docker services
docker compose down

# Stop and remove volumes (resets database)
docker compose down -v
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `port already allocated` on Redis | Another Redis is running locally. Either stop it or remove the `ports` mapping from `docker-compose.yml` |
| Gemini `ResourceExhausted` | Your API key's free quota is used up. Enable billing at https://aistudio.google.com or wait for reset |
| `alembic upgrade` fails with connection error | Make sure the `postgres` container is healthy: `docker compose ps` |
| Extension not loading | Check `chrome://extensions` for errors. Ensure `manifest.json` version is `1.0.0` |
| Frontend can't reach API | Set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` in `web/.env.local` |

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Chrome Extension│────▶│  FastAPI Backend  │────▶│  Gemini API   │
│  (MV3 + Shadow  │     │  (12 routers)     │     │  (LLM calls)  │
│   DOM overlays) │     │                   │     └───────────────┘
└─────────────────┘     │  ┌─────────────┐  │
                        │  │ PostgreSQL  │  │
┌─────────────────┐     │  │ (10 tables) │  │
│  Next.js Web App│────▶│  └─────────────┘  │
│  (Dashboard)    │     │  ┌─────────────┐  │
└─────────────────┘     │  │   Redis     │  │
                        │  │ (L1+L2 cache)│ │
                        │  └─────────────┘  │
                        └──────────────────┘
```
