"""
CiteCheck AI — Health & Monitoring Endpoints.

Provides:
- `/healthz`, `/api/health`, `/api/v1/health` — reports store backend (supabase|memory),
  LLM status (configured|not_configured|degraded), version, and commit hash.
- `/api/v1/ping` — API contract ping endpoint.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import os
import subprocess
from typing import Any, Dict

from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.database import get_supabase_admin_client
from app.store.provider import get_store_backend_name

logger = logging.getLogger("citecheck.health")

router = APIRouter(tags=["Health & Monitoring"])

PRODUCT_LINE = "CiteCheck blocks unsupported AI claims before publication — every finding is cited, verified, and human-approved."


def _get_git_commit() -> str:
    """Safely retrieves git commit sha from Vercel env or local repo."""
    vercel_sha = os.environ.get("VERCEL_GIT_COMMIT_SHA")
    if vercel_sha:
        return vercel_sha[:7]
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=1,
        ).decode().strip()
        if sha:
            return sha
    except Exception:
        pass
    return "c48-round3"


def _get_llm_status() -> Dict[str, str]:
    """Detects configured LLM reviewer provider & status."""
    api_key = (
        os.environ.get("LLM_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
    )
    provider = os.environ.get("LLM_PROVIDER") or (
        "gemini" if os.environ.get("GEMINI_API_KEY")
        else "openai" if os.environ.get("OPENAI_API_KEY")
        else "anthropic" if os.environ.get("ANTHROPIC_API_KEY")
        else "none"
    )

    if api_key:
        return {"status": "configured", "provider": provider}
    return {"status": "not_configured", "provider": "none"}


def _check_database_connectivity() -> bool:
    """Verifies connection to Supabase database by performing a lightweight query."""
    settings = get_settings()
    if not settings.supabase_url:
        return False
    try:
        client = get_supabase_admin_client()
        client.table("brand_kits").select("id").limit(1).execute()
        return True
    except Exception as exc:
        logger.warning("Database health check ping failed: %s", exc)
        return False


@router.get("/healthz", summary="Liveness & Readiness Probe")
@router.get("/api/health", summary="System Health & LLM Status")
@router.get("/api/v1/health", summary="System Health & LLM Status v1")
@router.get("/api/v1/ping", summary="API Contract Ping with Database Verification")
def health_check(response: Response) -> Dict[str, Any]:
    """
    Standard uptime & health check endpoint.
    Reports store backend in use (supabase | memory), LLM status, version, and commit.
    """
    settings = get_settings()
    store_backend = get_store_backend_name()
    llm_info = _get_llm_status()
    commit_sha = _get_git_commit()

    db_connected = _check_database_connectivity()

    if db_connected:
        health_status = "healthy"
        response.status_code = status.HTTP_200_OK
        database_label = "connected"
    else:
        health_status = "degraded"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        database_label = "disconnected"

    return {
        "status": health_status,
        "service": settings.app_name,
        "version": "3.0.0",
        "commit": commit_sha,
        "store_backend": store_backend,
        "database": database_label,
        "llm_status": llm_info["status"],
        "llm_provider": llm_info["provider"],
        "product_line": PRODUCT_LINE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
