# pyright: reportMissingImports=false
import os
import sys
from fastapi import FastAPI, Request

# ── 1. Configure Python Paths ────────────────────────────────────────────────
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "backend"))
repo_root = os.path.abspath(os.path.join(current_dir, ".."))

for path_entry in [backend_dir, repo_root, current_dir]:
    if path_entry not in sys.path:
        sys.path.insert(0, path_entry)

# ── 2. Initialize Top-Level FastAPI Application ─────────────────────────────
# Vercel requires a top-level "app" (or "handler") instance of FastAPI.
app: FastAPI

try:
    from app.main import app as main_app
    app = main_app
except Exception as exc1:
    try:
        from backend.app.main import app as main_app
        app = main_app
    except Exception as exc2:
        import traceback
        error_details = {
            "error_direct": str(exc1),
            "error_backend": str(exc2),
            "traceback": traceback.format_exc(),
            "sys_path": sys.path,
        }

        # Resilient fallback FastAPI app ensuring Vercel build succeeds
        app = FastAPI(title="CiteCheck AI Fallback")

        @app.get("/api/healthz")
        @app.get("/healthz")
        def healthz():
            return {"status": "degraded", "error": error_details}

        @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
        def fallback(full_path: str, request: Request):
            return {"error": "FastAPI initialization failed", "details": error_details}

# ASGI compatibility alias for Vercel Python runtime
handler = app
