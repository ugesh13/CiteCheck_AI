"""
CiteCheck AI — FastAPI Application Entry Point.

Registers all routers, security middleware, rate limiting, exception handlers,
CORS, and health/root endpoints.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.errors import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.limiter import RateLimitMiddleware
from app.routers import analytics, brand_kits, drafts, frontend_bridge, health, review

settings = get_settings()

# ── Sentry Centralized Error Tracking ─────────────────────────────────────
if settings.sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=1.0)
    except ImportError:
        pass

app = FastAPI(
    title=settings.app_name,
    description=(
        "CiteCheck AI — Brand compliance verification engine. "
        "Validates marketing content against approved facts, terminology, "
        "and brand guidelines using a 5-Gate Evidence Verifier pipeline."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── 1. API Rate Limiting Middleware ────────────────────────────────────────
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

# ── 2. CORS Middleware ─────────────────────────────────────────────────────
# Explicitly allow standard frontend dev ports and localhost / 127.0.0.1 aliases
default_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Merge any custom origins specified via CORS_ORIGINS in .env
configured_origins = list(settings.cors_origins_list)
for origin in default_allowed_origins:
    if origin not in configured_origins:
        configured_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── 3. Centralized Exception Handlers ──────────────────────────────────────
# Enforces standard error format: {"detail": "...", "code": "..."}
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# ── 4. Register Routers ───────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(frontend_bridge.router)
app.include_router(drafts.router)
app.include_router(review.router)
app.include_router(analytics.router)
app.include_router(brand_kits.router)


# ── 5. Root Endpoint & Static Frontend Serving ────────────────────────────
import os
from starlette.staticfiles import StaticFiles

# Resolve path to built frontend dist/public (supporting both Frontend and frontend for Linux/Vercel)
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
dist_candidates = [
    os.path.join(repo_root, "Frontend", "Glassmorphic-Frontend-Builder", "artifacts", "citecheck-ai", "dist", "public"),
    os.path.join(repo_root, "frontend", "Glassmorphic-Frontend-Builder", "artifacts", "citecheck-ai", "dist", "public"),
]
frontend_dist = dist_candidates[0]
for cand in dist_candidates:
    if os.path.isdir(cand) and os.path.exists(os.path.join(cand, "index.html")):
        frontend_dist = cand
        break

if os.path.isdir(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
    # Mount static assets (js, css, images)
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Serve compiled frontend index.html for root and client-side routes
    from fastapi.responses import FileResponse

    @app.get("/favicon.svg", tags=["Static"])
    @app.get("/favicon.png", tags=["Static"])
    @app.get("/favicon.ico", tags=["Static"])
    @app.get("/security-banner.png", tags=["Static"])
    @app.get("/robots.txt", tags=["Static"])
    def serve_root_static(request: Request):
        filename = request.url.path.lstrip("/")
        filepath = os.path.join(frontend_dist, filename)
        if os.path.exists(filepath):
            return FileResponse(filepath)
        return FileResponse(os.path.join(frontend_dist, "favicon.svg"))

    @app.get("/", tags=["Frontend"])
    @app.get("/dashboard", tags=["Frontend"])
    @app.get("/drafts", tags=["Frontend"])
    @app.get("/brand-kit", tags=["Frontend"])
    @app.get("/review", tags=["Frontend"])
    @app.get("/gap-radar", tags=["Frontend"])
    @app.get("/audit", tags=["Frontend"])
    @app.get("/login", tags=["Frontend"])
    def serve_frontend():
        """Serve the compiled Glassmorphic Frontend application."""
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/api-info", tags=["Root"])
    def root():
        """Root API info endpoint."""
        return {
            "service": settings.app_name,
            "version": "1.0.0",
            "status": "operational",
            "docs": "/docs",
            "health": "/healthz",
            "auth_enabled": True,
        }
else:
    @app.get("/", tags=["Root"])
    def root():
        """Root endpoint — confirms the API is live."""
        return {
            "service": settings.app_name,
            "version": "1.0.0",
            "status": "operational",
            "docs": "/docs",
            "health": "/healthz",
            "auth_enabled": True,
        }
