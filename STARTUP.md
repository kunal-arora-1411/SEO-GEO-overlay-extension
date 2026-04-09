# 🚀 Quick Start Guide — SEO-GEO Overlay Extension

Get the entire project running in under 10 minutes using Docker. For local development without Docker, see [Full Setup](#full-setup).

---

## Prerequisites

- **Docker & Docker Compose** (or [install here](https://www.docker.com/products/docker-desktop))
- **Node.js 18+** (for the Next.js frontend)
- **Google Chrome** (for the extension)
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey) (free tier works)

---

## 5-Minute Quick Start (Docker)

### 1. Clone & Configure

```bash
git clone https://github.com/kunal-arora-1411/SEO-GEO-overlay-extension.git
cd SEO-GEO-overlay-extension

# Copy environment template
cp .env.example .env
```

Edit `.env` and add your keys:

```env
GEMINI_API_KEY=your-api-key-from-google-ai-studio
JWT_SECRET=any-random-secret-string
```

### 2. Start Backend (Database + API + Cache)

```bash
# Build and start all services in the background
docker compose up --build -d

# Watch the logs (Ctrl+C to stop)
docker compose logs -f api
```

### 3. Run Database Migrations

```bash
docker compose exec api alembic upgrade head
```

Expected output: `Running upgrade ... done` (runs 10 migrations in sequence)

### 4. Start Frontend

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 5. Load the Chrome Extension

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. Done! Navigate to any webpage and the extension overlay will appear

---

## Verify Everything Works

### Backend Health Check

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"seo-geo-optimizer"}
```

### API Documentation

Open **http://localhost:8000/docs** in your browser to see all available endpoints and test them interactively.

### Create a Test User

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Response will include an access token (JWT).

### Run a Test Analysis

```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "meta": {"title": "Example Page", "title_length": 12},
    "content": {"full_text": "This is example content.", "word_count": 4},
    "headings": {"h1": [{"index": 0, "text": "Example"}]},
    "links": {"internal_count": 2, "external_count": 1}
  }'
```

---

## Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Next.js dashboard |
| **API** | http://localhost:8000/api/v1 | REST API base |
| **API Docs** | http://localhost:8000/docs | Interactive Swagger UI |
| **Health** | http://localhost:8000/health | Status check |

---

## Stop Everything

```bash
# Stop all containers but keep data
docker compose down

# Stop and delete all data (reset database)
docker compose down -v
```

---

## Full Setup (Local Development — Without Docker)

For development without Docker (running services locally).

### Backend Setup

#### 1. Create Virtual Environment

```bash
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python -m venv venv
source venv/bin/activate
```

#### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 3. Configure Environment

Create `backend/.env`:

```env
GEMINI_API_KEY=your-api-key
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/seo_geo_optimizer
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-random-secret
```

#### 4. Start Database & Cache

You'll need PostgreSQL 16 and Redis 7 running locally. If you don't have them:

**Option A: Use Docker for just DB & Cache**

```bash
# From project root
docker compose up postgres redis -d
```

**Option B: Install Locally**

- [PostgreSQL 16](https://www.postgresql.org/download/)
- [Redis 7](https://redis.io/download/)

#### 5. Run Migrations

```bash
cd backend
alembic upgrade head
```

#### 6. Start API Server

```bash
# From backend/ directory
uvicorn main:app --reload --port 8000
```

API is now at http://localhost:8000

#### 7. Start Celery Worker (Optional)

For background tasks (audits, exports):

```bash
# From backend/ directory (in a new terminal)
celery -A celery_app worker --loglevel=info
```

### Frontend Setup

#### 1. Install Dependencies

```bash
cd web
npm install
```

#### 2. Configure Environment

Create `web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

#### 3. Start Dev Server

```bash
npm run dev
```

Dashboard is at http://localhost:3000

---

## Common Tasks

### View API Documentation

```bash
# Swagger UI
http://localhost:8000/docs

# ReDoc
http://localhost:8000/redoc
```

### Check Docker Container Status

```bash
docker compose ps
```

### View API Logs

```bash
docker compose logs -f api --tail=50
```

### Access PostgreSQL Directly

```bash
docker compose exec postgres psql -U postgres -d seo_geo_optimizer
```

### Run Tests (Backend)

```bash
cd backend
pytest -v
```

### Build Frontend for Production

```bash
cd web
npm run build
npm start
```

### Check Extension Errors

1. Open `chrome://extensions/`
2. Find "SEO-GEO Overlay Extension"
3. Click "Errors" to see any issues
4. Check the browser console (F12) when visiting any webpage

---

## Troubleshooting

### Docker Issues

| Problem | Solution |
|---------|----------|
| `port already allocated` | Another service is using the port. Run `docker compose down` first, or change ports in `docker-compose.yml` |
| `Connection refused` | Services aren't running. Check with `docker compose ps` and restart: `docker compose up --build -d` |
| Slow on first start | Pulling images and building — this is normal. Wait 2-3 minutes |

### Database Issues

| Problem | Solution |
|---------|----------|
| `alembic upgrade` fails | Check if postgres container is running: `docker compose ps`. Ensure `DATABASE_URL` is correct |
| `relation "user" does not exist` | Migrations didn't run. Execute: `docker compose exec api alembic upgrade head` |
| Want to reset database | Run: `docker compose down -v` then `docker compose up --build -d` |

### API Issues

| Problem | Solution |
|---------|----------|
| `ResourceExhausted` error | Your Gemini API key's free quota is exhausted. Add billing at [Google AI Studio](https://aistudio.google.com) or wait for quota reset |
| API returns 500 | Check API logs: `docker compose logs api` |
| CORS errors | Ensure `CORS_ORIGINS` in `.env` includes your frontend URL (default `["*"]` allows all) |

### Frontend Issues

| Problem | Solution |
|---------|----------|
| Can't connect to API | Check `NEXT_PUBLIC_API_URL` in `web/.env.local` — should be `http://localhost:8000/api/v1` |
| Blank page or 404 | API may not be running. Verify: `curl http://localhost:8000/health` |
| Build fails | Clear cache: `rm -rf .next` then retry `npm run build` |

### Extension Issues

| Problem | Solution |
|---------|----------|
| Extension doesn't load | Check `chrome://extensions` for error details. Try reloading: click the reload icon |
| "Failed to fetch from API" | Ensure backend is running and extension is pointing to correct API URL in `extension/shared/constants.js` |
| Overlay not appearing | Check that script injection is allowed. Open DevTools (F12) → Console to see errors |
| Auth token expired | Log in again in the extension popup |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    Your Browser                        │
│  ┌────────────────────────────────────────────────┐   │
│  │     Chrome Extension (MV3)                     │   │
│  │  • Analyzes page content                       │   │
│  │  • Shows real-time overlay                     │   │
│  │  • Communicates via service worker             │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS/REST API
                     ▼
        ┌────────────────────────────┐
        │   FastAPI Backend          │
        │  (Port 8000)               │
        │                            │
        │  • Core analysis engine    │
        │  • 12 API routers          │
        │  • JWT authentication      │
        │  • Stripe integration      │
        │  • Celery task queue       │
        └───────┬────────┬───────────┘
                │        │
        ┌───────▼─┐   ┌──▼──────────┐
        │PostgreSQL   │   Redis     │
        │ Database    │   Cache     │
        └───────────┘   └────────────┘

┌────────────────────────────────────────┐
│    Next.js Dashboard (Port 3000)       │
│  • User authentication                 │
│  • Analysis history                    │
│  • Site audits                         │
│  • Competitor tracking                 │
│  • Report generation & export          │
└────────────────────────────────────────┘
```

---

## Key Directories

```
SEO-GEO-overlay-extension/
├── backend/              # FastAPI application
│   ├── analysis/         # SEO/GEO scoring engines
│   ├── api/              # Core endpoints
│   ├── auth/             # JWT + OAuth
│   ├── billing/          # Stripe integration
│   ├── db/               # Database models
│   └── migrations/       # Alembic schema versions
├── web/                  # Next.js frontend
│   └── src/
│       ├── app/          # Pages and layout
│       └── components/   # React components
├── extension/            # Chrome extension
│   ├── background/       # Service worker
│   ├── content/          # Content scripts
│   ├── popup/            # Extension UI
│   └── manifest.json
└── docs/                 # Privacy, terms, guides
```

---

## Next Steps

1. **Explore the API** — Visit http://localhost:8000/docs and test endpoints
2. **Create a test account** — Use the registration endpoint or web UI
3. **Run an analysis** — Submit a page URL for scoring
4. **Check the dashboard** — See history, trends, and export options
5. **Enable extra features** — Add Stripe keys, Google OAuth, Sentry as needed
6. **Deploy to production** — Use `docker-compose.prod.yml` with proper secrets management

---

## Additional Resources

- **Full Documentation** — [README.md](./README.md)
- **API Docs** — http://localhost:8000/docs (when API is running)
- **Chrome Extension Docs** — [extension/README.md](./extension/README.md) (if exists)
- **Backend Code** — [backend/](./backend/)
- **Frontend Code** — [web/src/](./web/src/)

---

## Need Help?

- **Check logs** — `docker compose logs api` or `docker compose logs web`
- **Test connectivity** — `curl http://localhost:8000/health`
- **Read errors carefully** — Most issues have clear error messages in logs or browser console
- **Review** [Troubleshooting](#troubleshooting) above
- **Open an issue** — [GitHub Issues](https://github.com/kunal-arora-1411/SEO-GEO-overlay-extension/issues)

---

**Happy building! 🎉**

Last updated: April 2026
