"""
CiteCheck AI — Centralized Error Handling & Exception Middleware.

Standardizes all error responses into the uniform contract:
{
    "detail": "Human readable error message",
    "code": "ERROR_KEY",
    "errors": [...]  # Optional validation error details
}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("citecheck.errors")


def create_error_response(
    status_code: int,
    detail: str,
    code: str,
    errors: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Helper to generate a consistent JSON error response."""
    content: Dict[str, Any] = {
        "detail": detail,
        "code": code,
    }
    if errors is not None:
        content["errors"] = errors

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=headers,
    )


def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handler for FastAPI/Starlette HTTPException.
    Extracts custom error codes from headers if provided, else infers from status code.
    """
    code = "HTTP_EXCEPTION"
    headers = exc.headers or {}

    if "code" in headers:
        code = headers.pop("code")
    elif exc.status_code == status.HTTP_400_BAD_REQUEST:
        code = "BAD_REQUEST"
    elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = "UNAUTHORIZED"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = "FORBIDDEN"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        code = "NOT_FOUND"
    elif exc.status_code == status.HTTP_409_CONFLICT:
        code = "CONFLICT"
    elif exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        code = "RATE_LIMIT_EXCEEDED"
    elif exc.status_code >= 500:
        code = "INTERNAL_SERVER_ERROR"

    return create_error_response(
        status_code=exc.status_code,
        detail=str(exc.detail),
        code=code,
        headers=headers or None,
    )


def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Handler for Pydantic RequestValidationError (HTTP 422).
    Extracts structured error paths and formats a clean human-readable summary.
    """
    raw_errors = exc.errors()
    summary_messages = []

    for err in raw_errors:
        loc = " -> ".join(str(p) for p in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        summary_messages.append(f"{loc}: {msg}" if loc else msg)

    detail = "; ".join(summary_messages) if summary_messages else "Request validation failed."

    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=detail,
        code="VALIDATION_ERROR",
        errors=raw_errors,
    )


def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Fallback handler for all unhandled Python exceptions.
    Prevents stack trace leaks to the client and logs with stacktrace.
    """
    logger.error("Unhandled server exception at %s: %s", request.url.path, exc, exc_info=True)
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An internal server error occurred. Please try again later.",
        code="INTERNAL_SERVER_ERROR",
    )
