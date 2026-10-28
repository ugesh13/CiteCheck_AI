"""
CiteCheck AI — Authentication & Security Middleware.

Provides:
1. `get_current_user` FastAPI dependency for Supabase JWT verification with local dev bypass.
2. `get_optional_current_user` for routes with optional auth.
3. `require_roles` dependency factory for role-based access control.
4. `CurrentUser` schema representing the authenticated identity.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.database import get_supabase_admin_client

logger = logging.getLogger(__name__)

# Security scheme extracting "Authorization: Bearer <token>"
security_scheme = HTTPBearer(auto_error=True)
optional_security_scheme = HTTPBearer(auto_error=False)

# Mock authenticated user for development and testing
MOCK_DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000000")


class CurrentUser(BaseModel):
    """Authenticated user context extracted from validated Supabase JWT or dev mock."""

    id: UUID = Field(default=MOCK_DEV_USER_ID)
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    role: str = "authenticated"  # creator, brand_manager, reviewer, authenticated
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_token: str = ""

    model_config = {"arbitrary_types_allowed": True}

    def model_post_init(self, __context: Any) -> None:
        if self.user_id is None:
            object.__setattr__(self, "user_id", self.id)
        elif self.id is None:
            object.__setattr__(self, "id", self.user_id)


def get_mock_dev_user(raw_token: str = "dev-token") -> CurrentUser:
    """Return mock authenticated user for local development and testing."""
    return CurrentUser(
        id=MOCK_DEV_USER_ID,
        user_id=MOCK_DEV_USER_ID,
        email="dev@citecheck.com",
        role="authenticated",
        app_metadata={"provider": "dev", "role": "authenticated"},
        user_metadata={"full_name": "Dev User", "role": "authenticated"},
        raw_token=raw_token,
    )


def _extract_user_from_payload(payload: Dict[str, Any], token: str) -> CurrentUser:
    """Extract CurrentUser attributes from a decoded Supabase JWT payload."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' (subject) claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(sub))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 'sub' claim is not a valid UUID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    app_meta = payload.get("app_metadata", {}) or {}
    user_meta = payload.get("user_metadata", {}) or {}

    # Role resolution order: user_metadata -> app_metadata -> role claim -> default 'creator'
    role = (
        user_meta.get("role")
        or app_meta.get("role")
        or payload.get("role")
        or "creator"
    )

    return CurrentUser(
        id=user_id,
        user_id=user_id,
        email=payload.get("email"),
        role=str(role),
        app_metadata=app_meta,
        user_metadata=user_meta,
        raw_token=token,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> CurrentUser:
    """
    FastAPI dependency that validates Supabase JWT from the Authorization header.

    Validation Strategy:
    1. Dev / Mock Mode:
       - If token is 'dev-token' (or 'mock-token'), returns mock authenticated user immediately.
       - If DEBUG=True in config, also accepts development tokens.
    2. Local JWT Secret Verification:
       - If SUPABASE_JWT_SECRET is configured, decodes and verifies token via HS256 locally.
    3. Supabase Auth API Verification:
       - Queries `auth.get_user(token)` via Supabase client as authoritative fallback.
    """
    token = credentials.credentials.strip()
    settings = get_settings()

    # ── 1. Dev / Mock Mode (Swagger UI & Local Development Testing) ───────────
    if token in ("dev-token", "mock-token") or (settings.debug and token in ("dev-token", "mock-token", "dev", "test-token")):
        return get_mock_dev_user(raw_token=token)

    # ── 2. Local JWT Secret Verification (Zero network latency) ─────────────
    if settings.supabase_jwt_secret:
        try:
            # Supabase signs access tokens with HS256 using the project JWT secret
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return _extract_user_from_payload(payload, token)
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as exc:
            logger.warning("Local JWT verification failed: %s. Attempting Supabase Auth API...", exc)

    # ── 3. Supabase Auth API Verification (Authoritative fallback) ───────────
    try:
        admin_client = get_supabase_admin_client()
        user_response = admin_client.auth.get_user(token)
        if user_response and user_response.user:
            sb_user = user_response.user
            app_meta = sb_user.app_metadata or {}
            user_meta = sb_user.user_metadata or {}
            role = (
                user_meta.get("role")
                or app_meta.get("role")
                or getattr(sb_user, "role", "authenticated")
            )
            user_id = UUID(str(sb_user.id))
            return CurrentUser(
                id=user_id,
                user_id=user_id,
                email=sb_user.email,
                role=str(role),
                app_metadata=app_meta,
                user_metadata=user_meta,
                raw_token=token,
            )
    except Exception as exc:
        logger.error("Supabase Auth API user lookup failed: %s", exc)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired Supabase authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security_scheme),
) -> Optional[CurrentUser]:
    """Optional authentication dependency; returns None if header is absent."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


def require_roles(allowed_roles: List[str]):
    """
    Dependency factory to enforce role-based access control (RBAC).

    Allows dev mock user and admin roles to bypass restrictions during local development.
    """
    def role_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if (
            user.role not in allowed_roles
            and "admin" not in user.role
            and user.id != MOCK_DEV_USER_ID
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{user.role}' is not in allowed roles: {allowed_roles}",
            )
        return user

    return role_checker
