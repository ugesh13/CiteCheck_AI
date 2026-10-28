# CiteCheck AI — Backend

Production-ready FastAPI backend for brand compliance verification. Uses a **5-Gate Evidence Verifier** pipeline and a deterministic rules engine to validate marketing content against approved facts, terminology, and brand guidelines.

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point + CORS
│   ├── core/
│   │   ├── config.py         # Pydantic settings (.env loader & CORS)
│   │   ├── security.py       # Supabase JWT Auth & RBAC dependencies
│   │   └── database.py       # Supabase Admin & User-scoped clients
│   ├── config.py             # Re-export shim for backwards-compat
│   ├── database.py           # Re-export shim for backwards-compat
│   ├── schemas.py            # All Pydantic request/response models
│   ├── engine/
│   │   ├── verifier.py       # 5-Gate Evidence Verifier
│   │   └── rules.py          # Deterministic banned-terms + readability
│   └── routers/
│       ├── drafts.py         # Authenticated Draft CRUD
│       ├── review.py         # Authenticated Review pipeline + decisions
│       └── analytics.py      # Authenticated Guideline Gap Radar
├── scripts/
│   └── schema.sql            # Full Supabase DDL + seed data
├── tests/
│   ├── test_verifier.py      # 33 unit tests for engines
│   └── test_security.py      # 11 unit tests for Supabase JWT & RBAC
├── .env.example
├── requirements.txt
└── README.md
```

## Quick Start

### 1. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New Query**.
3. Paste the contents of [`scripts/schema.sql`](scripts/schema.sql) and click **Run**.
4. Copy your project URL, **service_role** key, and **anon** key from **Settings → API**.
5. Copy your **JWT Secret** from **Settings → API → JWT Settings**.

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJI...
SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_JWT_SECRET=your_jwt_secret_here

# Allowed frontend origins
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"]
```

### 3. Install Dependencies

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Run the Server

```bash
uvicorn app.main:app --reload --port 8000
```

Visit:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health**: [http://localhost:8000/health](http://localhost:8000/health)

### 5. Run Tests

```bash
pytest tests/ -v
```

## Authentication & Security

All API endpoints (`/api/v1/drafts`, `/api/v1/review-draft`, `/api/v1/decisions`, `/api/v1/guideline-gap-radar`) are protected by Supabase JWT verification via the `get_current_user` dependency:

1. **Local HS256 Verification**: If `SUPABASE_JWT_SECRET` is configured, verifies access tokens with zero network latency.
2. **Supabase Auth API Fallback**: Queries `supabase.auth.get_user(token)` if the secret is not configured or in case of remote key rotation.
3. **Actor Auditing**: Automatically records authenticated user UUID as `actor_id` in `audit_logs` and defaults `creator_id`/`user_id` in drafts and human decisions.
4. **RBAC**: Supports `require_roles(["creator", "brand_manager", "reviewer"])` for fine-grained authorization.

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `GET` | `/` | No | Service status & docs link |
| `GET` | `/health` | No | Lightweight uptime health check |
| `POST` | `/api/v1/drafts` | **Yes (Bearer JWT)** | Create a new draft with initial version |
| `GET` | `/api/v1/drafts/{draft_id}` | **Yes (Bearer JWT)** | Get draft details + current findings |
| `POST` | `/api/v1/review-draft` | **Yes (Bearer JWT)** | Run the full 5-gate review pipeline |
| `POST` | `/api/v1/decisions` | **Yes (Bearer JWT)** | Record accept/edit/dismiss on a finding |
| `GET` | `/api/v1/guideline-gap-radar` | **Yes (Bearer JWT)** | Analytics: frequently dismissed guidelines |

## 5-Gate Evidence Verifier

Every candidate finding must pass all 5 gates to be persisted:

| Gate | Check | On Failure |
|------|-------|------------|
| **1** | Pydantic schema validation | **Dropped** |
| **2** | Cited `fact_code` / `guideline_code` exists in DB | **Dropped** |
| **3** | `exact_excerpt` is a substring of the draft text | **Dropped** |
| **4** | Numbers/dates in `suggested_fix` match the excerpt | **Flagged** (`is_intent_guarded = true`) |
| **5** | Cited fact's `review_date` is not stale | **Escalated** to severity `high` |

## Example: Authenticated Request

```bash
# Obtain your JWT from Supabase Auth client or login
TOKEN="eyJhbGciOi..."

# 1. Create a draft
curl -X POST http://localhost:8000/api/v1/drafts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_kit_id": "a1b2c3d4-e5f6-7890-abcd-111111111111",
    "title": "Q4 Launch Announcement",
    "content": "Our AI Guardrail guarantees 100% uptime for all customers."
  }'

# 2. Run the review
curl -X POST http://localhost:8000/api/v1/review-draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "draft_id": "<DRAFT_ID>",
    "brand_kit_id": "a1b2c3d4-e5f6-7890-abcd-111111111111"
  }'
```

## License

Hackathon project — Code 48 2026.
