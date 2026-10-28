"""
CiteCheck AI — Health & Monitoring Endpoints.

Provides:
- `/healthz` — Kubernetes / Docker / load-balancer liveness & readiness probe.
- `/api/v1/ping` — API contract ping endpoint checking database connectivity.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict

from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.database import get_supabase_admin_client

logger = logging.getLogger("citecheck.health")

router = APIRouter(tags=["Health & Monitoring"])


def _check_database_connectivity() -> bool:
    """Verifies connection to database by performing a lightweight query."""
    settings = get_settings()
    if not settings.supabase_url:
        return False
    try:
        client = get_supabase_admin_client()
        # Query single row from brand_kits to verify connectivity
        client.table("brand_kits").select("id").limit(1).execute()
        return True
    except Exception as exc:
        logger.warning("Database health check ping failed: %s", exc)
        return False


@router.get("/healthz", summary="Liveness & Readiness Probe")
@router.get("/api/v1/ping", summary="API Contract Ping with Database Verification")
def health_check(response: Response) -> Dict[str, Any]:
    """
    Standard uptime & health check endpoint.
    Queries database and returns 200 OK when operational, or 503 if database is disconnected.
    """
    settings = get_settings()
    db_connected = _check_database_connectivity()

    health_status = "healthy" if db_connected else "degraded"
    status_code = status.HTTP_200_OK if db_connected else status.HTTP_503_SERVICE_UNAVAILABLE
    response.status_code = status_code

    return {
        "status": health_status,
        "service": settings.app_name,
        "version": "1.0.0",
        "environment": "development" if settings.debug else "production",
        "database": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
