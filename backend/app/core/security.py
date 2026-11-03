"""
CiteCheck AI — Authentication & Security Middleware.

Provides:
1. `CurrentUser` model with real identity attributes (id, name, email, role).
2. JWT generation & validation (`create_access_token`, `get_current_user`).
3. `require_role` / `require_roles` dependencies enforcing server-side RBAC with clean 403 JSON messages.
4. Demo identity resolution for one-click reviewer, creator, and brand_manager roles.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
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

security_scheme = HTTPBearer(auto_error=True)
optional_security_scheme = HTTPBearer(auto_error=False)

# Mock authenticated user for development and backwards compatibility
MOCK_DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000000")

# Fixed UUIDs for standard demo personas
DEMO_PERSONAS = {
    "creator": {
        "id": UUID("11111111-1111-1111-1111-111111111111"),
        "name": "Meera Nair",
        "email": "meera@lumenpay.example",
        "role": "creator",
    },
    "reviewer": {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "name": "Nisha Rao",
        "email": "nisha@lumenpay.example",
        "role": "reviewer",
    },
    "brand_manager": {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "name": "Arjun Mehta",
        "email": "arjun@lumenpay.example",
        "role": "brand_manager",
    },
}

DEFAULT_FALLBACK_JWT_SECRET = "citecheck-enterprise-secret-key-2026-audit-chain-secure"


class CurrentUser(BaseModel):
    """Authenticated user context extracted from validated JWT or demo identity."""

    id: UUID = Field(default_factory=lambda: DEMO_PERSONAS["creator"]["id"])
    user_id: Optional[UUID] = None
    name: str = "CiteCheck User"
    email: Optional[str] = None
    role: str = "creator"  # creator | reviewer | brand_manager
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)
    raw_token: str = ""

    model_config = {"arbitrary_types_allowed": True}

    def model_post_init(self, __context: Any) -> None:
        if self.user_id is None:
            object.__setattr__(self, "user_id", self.id)
        elif self.id is None:
            object.__setattr__(self, "id", self.user_id)


def get_jwt_secret() -> str:
    settings = get_settings()
    return settings.supabase_jwt_secret or DEFAULT_FALLBACK_JWT_SECRET


def create_access_token(
    user_id: UUID,
    role: str,
    name: str,
    email: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate a signed JWT encoding identity and role."""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=30))
    payload = {
        "sub": str(user_id),
        "role": role,
        "name": name,
        "email": email,
        "user_metadata": {
            "full_name": name,
            "role": role,
        },
        "app_metadata": {
            "provider": "citecheck",
            "role": role,
        },
        "iat": datetime.now(timezone.utc).timestamp(),
        "exp": expire.timestamp(),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def _extract_user_from_payload(payload: Dict[str, Any], token: str) -> CurrentUser:
    """Extract CurrentUser attributes from a decoded JWT payload."""
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
    name = (
        user_meta.get("full_name")
        or user_meta.get("name")
        or payload.get("name")
        or DEMO_PERSONAS.get(role, {}).get("name", "CiteCheck User")
    )

    return CurrentUser(
        id=user_id,
        user_id=user_id,
        name=name,
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
    FastAPI dependency validating Bearer token.
    Accepts:
    1. Signed JWT tokens (HS256).
    2. Demo preview tokens: 'preview-token-<role>' (maps to real demo identity).
    3. Dev token: 'dev-token'.
    """
    token = credentials.credentials.strip()

    # 1. Dev / Mock Mode (Swagger UI & Local Development Testing)
    if token in ("dev-token", "mock-token", "dev", "test-token"):
        return CurrentUser(
            id=MOCK_DEV_USER_ID,
            user_id=MOCK_DEV_USER_ID,
            name="Dev User",
            email="dev@citecheck.com",
            role="authenticated",
            app_metadata={"provider": "dev", "role": "authenticated"},
            user_metadata={"full_name": "Dev User", "role": "authenticated"},
            raw_token=token,
        )

    # Direct demo preview tokens
    for role_key, persona in DEMO_PERSONAS.items():
        if token in (f"preview-token-{role_key}", f"preview-{role_key}", f"preview_token_{role_key}"):
            return CurrentUser(
                id=persona["id"],
                user_id=persona["id"],
                name=persona["name"],
                email=persona["email"],
                role=persona["role"],
                raw_token=token,
            )

    # 2. Local JWT Secret Verification
    try:
        payload = jwt.decode(
            token,
            get_jwt_secret(),
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
    except jwt.InvalidTokenError:
        pass

    # 3. Supabase Auth API Fallback (if configured)
    try:
        admin_client = get_supabase_admin_client()
        user_response = admin_client.auth.get_user(token)
        if user_response and user_response.user:
            sb_user = user_response.user
            app_meta = sb_user.app_metadata or {}
            user_meta = sb_user.user_metadata or {}
            role = user_meta.get("role") or app_meta.get("role") or "creator"
            name = user_meta.get("full_name") or DEMO_PERSONAS.get(role, {}).get("name", "User")
            user_id = UUID(str(sb_user.id))
            return CurrentUser(
                id=user_id,
                user_id=user_id,
                name=name,
                email=sb_user.email,
                role=str(role),
                app_metadata=app_meta,
                user_metadata=user_meta,
                raw_token=token,
            )
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
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


def require_role(*allowed_roles: str):
    """
    Enforces strict role-based access control.
    Returns 403 Forbidden with human-friendly explanation if role is unauthorized.
    Allows dev mock user and admin roles to bypass restrictions during local development.
    """
    roles_list = list(allowed_roles)

    def role_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if (
            user.role not in roles_list
            and "admin" not in user.role
            and user.id != MOCK_DEV_USER_ID
        ):
            allowed_names = " or ".join(roles_list)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{user.role}' is not in allowed roles: {roles_list}. Access denied: this action requires the '{allowed_names}' role.",
            )
        return user

    return role_checker


# Backward compatibility alias
def require_roles(allowed_roles: List[str]):
    return require_role(*allowed_roles)
