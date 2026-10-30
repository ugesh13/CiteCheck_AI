"""
CiteCheck AI — FastAPI Application Entry Point.

Registers all routers, security middleware, rate limiting, exception handlers,
CORS, and health/root endpoints.
"""

from __future__ import annotations

from typing import Optional
from fastapi import FastAPI, HTTPException, Request
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

# ── Vercel Serverless Path Restoration Middleware ──────────────────────────
@app.middleware("http")
async def vercel_subpath_middleware(request: Request, call_next):
    """
    On Vercel, requests to /api/(.*) are rewritten to /api/index.py?path=$1.
    This middleware restores the original requested path into request.scope['path']
    so FastAPI routers (/api/brand-kit, /api/drafts, /api/gap-radar, etc.) match directly.
    """
    sub = request.query_params.get("path") or request.query_params.get("__subpath")
    if sub and sub not in ("$1", ":match*", ":path*"):
        clean_sub = sub.strip().lstrip("/")
        if clean_sub in ("docs", "openapi.json", "healthz"):
            request.scope["path"] = f"/{clean_sub}"
        else:
            request.scope["path"] = f"/api/{clean_sub}"
    elif request.scope.get("path") in ("/api/index.py", "/api/index"):
        request.scope["path"] = "/api"
    return await call_next(request)


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
from fastapi.responses import FileResponse, HTMLResponse
from starlette.staticfiles import StaticFiles

EMBEDDED_INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>CiteCheck AI</title>
    <meta name="description" content="CiteCheck AI — Brand compliance verification engine." />
    <meta name="robots" content="index, follow" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-DeQ9iTsk.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-pTURVlnv.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""

# Resolve path to built frontend
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
dist_candidates = [
    os.path.join(repo_root, "public"),
    os.path.join(repo_root, "Frontend", "Glassmorphic-Frontend-Builder", "artifacts", "citecheck-ai", "dist", "public"),
    os.path.join(os.getcwd(), "public"),
    os.path.join(os.getcwd(), "dist", "public"),
]
frontend_dist = dist_candidates[0]
for cand in dist_candidates:
    if os.path.isdir(cand) and os.path.exists(os.path.join(cand, "index.html")):
        frontend_dist = cand
        break

# Mount static assets if directory exists
if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

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


@app.api_route("/", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/index.html", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/dashboard", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/drafts", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/brand-kit", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/review", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/gap-radar", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/audit", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/login", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/how-it-works", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
@app.api_route("/settings", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
def serve_frontend():
    """Serve the compiled Glassmorphic Frontend application."""
    if os.path.isdir(frontend_dist):
        html_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(html_file):
            return FileResponse(html_file)
    return HTMLResponse(content=EMBEDDED_INDEX_HTML)


@app.api_route("/api", methods=["GET", "HEAD"], tags=["Root"])
@app.api_route("/api/index.py", methods=["GET", "HEAD"], tags=["Root"])
@app.api_route("/api/index", methods=["GET", "HEAD"], tags=["Root"])
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


@app.api_route("/{full_path:path}", methods=["GET", "HEAD", "OPTIONS"], tags=["Frontend"])
def catchall_frontend(full_path: str):
    """Fallback handler for frontend client routes and static assets."""
    if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "healthz"):
        raise HTTPException(status_code=404, detail="Not Found")
    if os.path.isdir(frontend_dist):
        filepath = os.path.join(frontend_dist, full_path)
        if os.path.exists(filepath) and os.path.isfile(filepath):
            return FileResponse(filepath)
        html_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(html_file):
            return FileResponse(html_file)
    return HTMLResponse(content=EMBEDDED_INDEX_HTML)
