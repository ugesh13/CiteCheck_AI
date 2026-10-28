"""
CiteCheck AI — API Contracts, Error Handling & Health Check Unit Tests.

Directly tests:
1. Root and Uptime functions (root, health_check).
2. Standardized JSON error response contracts on 401, 404, 422, 500.
3. API rate limiting algorithm and throttling calculations.
"""

import json
from fastapi import HTTPException, Response, status
from fastapi.exceptions import RequestValidationError
import pytest

from app.core.errors import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.limiter import SlidingWindowRateLimiter
from app.main import root
from app.routers.health import health_check


class TestHealthAndUptime:
    def test_root_endpoint_contract(self):
        data = root()
        assert data["service"] == "CiteCheck AI"
        assert data["status"] == "operational"
        assert data["health"] == "/healthz"
        assert "version" in data

    def test_health_check_healthy(self, monkeypatch):
        monkeypatch.setattr("app.routers.health._check_database_connectivity", lambda: True)
        response = Response()
        data = health_check(response)
        assert response.status_code == 200
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "timestamp" in data

    def test_health_check_degraded(self, monkeypatch):
        monkeypatch.setattr("app.routers.health._check_database_connectivity", lambda: False)
        response = Response()
        data = health_check(response)
        assert response.status_code == 503
        assert data["status"] == "degraded"
        assert data["database"] == "disconnected"


class TestStandardErrorContract:
    def test_http_404_not_found_format(self):
        exc = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
        resp = http_exception_handler(None, exc)
        assert resp.status_code == 404
        body = json.loads(resp.body.decode())
        assert body["detail"] == "Draft not found"
        assert body["code"] == "NOT_FOUND"

    def test_http_401_unauthorized_format(self):
        exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        resp = http_exception_handler(None, exc)
        assert resp.status_code == 401
        body = json.loads(resp.body.decode())
        assert body["detail"] == "Invalid token"
        assert body["code"] == "UNAUTHORIZED"

    def test_validation_error_format(self):
        raw_errors = [{"loc": ("body", "title"), "msg": "Field required", "type": "missing"}]
        exc = RequestValidationError(errors=raw_errors)
        resp = validation_exception_handler(None, exc)
        assert resp.status_code == 422
        body = json.loads(resp.body.decode())
        assert "body -> title: Field required" in body["detail"]
        assert body["code"] == "VALIDATION_ERROR"
        assert "errors" in body

    def test_global_exception_handler(self):
        exc = RuntimeError("Unexpected internal crash")
        
        class FakeRequest:
            url = type("URL", (), {"path": "/api/v1/test"})()
            
        resp = global_exception_handler(FakeRequest(), exc)
        assert resp.status_code == 500
        body = json.loads(resp.body.decode())
        assert body["code"] == "INTERNAL_SERVER_ERROR"
        assert "internal server error" in body["detail"].lower()


class TestRateLimiterAlgorithm:
    def test_sliding_window_rate_limiter(self):
        limiter = SlidingWindowRateLimiter(requests_per_minute=2, window_seconds=60)
        
        # 1st request: allowed
        ok1, rem1, _ = limiter.is_allowed("client-1")
        assert ok1 is True
        assert rem1 == 1

        # 2nd request: allowed
        ok2, rem2, _ = limiter.is_allowed("client-1")
        assert ok2 is True
        assert rem2 == 0

        # 3rd request: rejected
        ok3, rem3, reset = limiter.is_allowed("client-1")
        assert ok3 is False
        assert rem3 == 0
        assert reset > 0

        # Separate client gets full quota
        ok_other, rem_other, _ = limiter.is_allowed("client-2")
        assert ok_other is True
        assert rem_other == 1
