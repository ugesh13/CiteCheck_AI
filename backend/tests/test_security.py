"""
CiteCheck AI — Tests for Authentication & Security Middleware.

Tests cover:
1. Supabase JWT validation & claims extraction (using mock JWT secret).
2. Expired token rejection.
3. Malformed/invalid token rejection.
4. Local dev bypass using 'dev-token'.
5. Role-based access control (RBAC) enforcement.
6. Configuration parsing for CORS origins and Supabase keys.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
import jwt
import pytest

from app.core.config import Settings
from app.core.security import (
    CurrentUser,
    MOCK_DEV_USER_ID,
    _extract_user_from_payload,
    get_current_user,
    require_roles,
)

TEST_SECRET = "super-secret-jwt-key-for-testing-only-12345"
SAMPLE_USER_ID = uuid4()


@pytest.fixture
def valid_payload():
    """Create a sample valid Supabase JWT payload."""
    now = datetime.now(timezone.utc)
    return {
        "sub": str(SAMPLE_USER_ID),
        "email": "creator@acme.com",
        "role": "authenticated",
        "aud": "authenticated",
        "app_metadata": {"provider": "email"},
        "user_metadata": {"full_name": "Jane Doe", "role": "creator"},
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=1)).timestamp()),
    }


# ─── 1. Payload Extraction Tests ──────────────────────────────────────────────

class TestPayloadExtraction:
    def test_extract_valid_payload(self, valid_payload):
        user = _extract_user_from_payload(valid_payload, "token123")
        assert user.id == SAMPLE_USER_ID
        assert user.user_id == SAMPLE_USER_ID
        assert user.email == "creator@acme.com"
        assert user.role == "creator"
        assert user.raw_token == "token123"

    def test_missing_sub_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            _extract_user_from_payload({"email": "test@test.com"}, "token")
        assert exc_info.value.status_code == 401
        assert "sub" in exc_info.value.detail

    def test_invalid_uuid_sub_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            _extract_user_from_payload({"sub": "not-a-valid-uuid"}, "token")
        assert exc_info.value.status_code == 401
        assert "valid UUID" in exc_info.value.detail

    def test_role_precedence(self):
        # user_metadata > app_metadata > top-level role
        payload = {
            "sub": str(SAMPLE_USER_ID),
            "role": "authenticated",
            "app_metadata": {"role": "reviewer"},
            "user_metadata": {"role": "brand_manager"},
        }
        user = _extract_user_from_payload(payload, "tok")
        assert user.role == "brand_manager"

        # Falls back to app_metadata when user_metadata has no role
        payload2 = {
            "sub": str(SAMPLE_USER_ID),
            "role": "authenticated",
            "app_metadata": {"role": "reviewer"},
            "user_metadata": {},
        }
        user2 = _extract_user_from_payload(payload2, "tok")
        assert user2.role == "reviewer"


# ─── 2. Dev Mock & JWT Verification Tests ──────────────────────────────────────

class TestJWTVerification:
    def test_dev_token_returns_mock_user(self):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="dev-token")
        user = get_current_user(creds)
        assert user.user_id == UUID("00000000-0000-0000-0000-000000000000")
        assert user.id == UUID("00000000-0000-0000-0000-000000000000")
        assert user.email == "dev@citecheck.com"
        assert user.role == "authenticated"

    def test_debug_mode_returns_mock_user_for_dev(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.security.get_settings",
            lambda: Settings(
                supabase_url="https://test.supabase.co",
                supabase_service_key="test-key",
                debug=True,
            ),
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-token")
        user = get_current_user(creds)
        assert user.user_id == UUID("00000000-0000-0000-0000-000000000000")
        assert user.email == "dev@citecheck.com"

    def test_valid_token_decodes_successfully(self, valid_payload, monkeypatch):
        token = jwt.encode(valid_payload, TEST_SECRET, algorithm="HS256")
        
        # Mock settings to return our test secret
        monkeypatch.setattr(
            "app.core.security.get_settings",
            lambda: Settings(
                supabase_url="https://test.supabase.co",
                supabase_service_key="test-key",
                supabase_jwt_secret=TEST_SECRET,
                debug=False,
            ),
        )

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = get_current_user(creds)
        assert user.id == SAMPLE_USER_ID
        assert user.email == "creator@acme.com"

    def test_expired_token_raises_401(self, valid_payload, monkeypatch):
        # Expired 1 hour ago
        valid_payload["exp"] = int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
        token = jwt.encode(valid_payload, TEST_SECRET, algorithm="HS256")

        monkeypatch.setattr(
            "app.core.security.get_settings",
            lambda: Settings(
                supabase_url="https://test.supabase.co",
                supabase_service_key="test-key",
                supabase_jwt_secret=TEST_SECRET,
                debug=False,
            ),
        )

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(creds)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_wrong_signature_raises_401(self, valid_payload, monkeypatch):
        # Encoded with wrong secret
        token = jwt.encode(valid_payload, "wrong-secret-key", algorithm="HS256")

        monkeypatch.setattr(
            "app.core.security.get_settings",
            lambda: Settings(
                supabase_url="https://test.supabase.co",
                supabase_service_key="test-key",
                supabase_jwt_secret=TEST_SECRET,
                debug=False,
            ),
        )
        monkeypatch.setattr(
            "app.core.security.get_supabase_admin_client",
            lambda: type("MockAdmin", (), {"auth": type("MockAuth", (), {"get_user": lambda self, tok: None})()})(),
        )

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(creds)
        assert exc_info.value.status_code == 401


# ─── 3. Role-Based Access Control (RBAC) Tests ───────────────────────────────

class TestRBAC:
    def test_allowed_role_passes(self):
        user = CurrentUser(id=SAMPLE_USER_ID, role="brand_manager")
        checker = require_roles(["brand_manager", "reviewer"])
        res = checker(user)
        assert res.role == "brand_manager"

    def test_disallowed_role_raises_403(self):
        user = CurrentUser(id=SAMPLE_USER_ID, role="creator")
        checker = require_roles(["brand_manager", "reviewer"])
        with pytest.raises(HTTPException) as exc_info:
            checker(user)
        assert exc_info.value.status_code == 403
        assert "Forbidden" in exc_info.value.detail

    def test_dev_mock_user_bypasses_rbac(self):
        dev_user = CurrentUser(id=MOCK_DEV_USER_ID, role="authenticated")
        checker = require_roles(["brand_manager"])
        res = checker(dev_user)
        assert res.id == MOCK_DEV_USER_ID


# ─── 4. Configuration Tests ───────────────────────────────────────────────────

class TestConfiguration:
    def test_service_role_key_fallback(self):
        # Test fallback from SUPABASE_SERVICE_ROLE_KEY to service_role_key property
        s1 = Settings(
            supabase_url="https://test.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="role-key-123",
        )
        assert s1.service_role_key == "role-key-123"

        # Test preference of SUPABASE_SERVICE_KEY
        s2 = Settings(
            supabase_url="https://test.supabase.co",
            SUPABASE_SERVICE_KEY="service-key-456",
            SUPABASE_SERVICE_ROLE_KEY="role-key-123",
        )
        assert s2.service_role_key == "service-key-456"

    def test_cors_origins_parsing(self):
        # Default list
        s1 = Settings(supabase_url="https://test.supabase.co", supabase_service_key="k")
        assert "http://localhost:3000" in s1.cors_origins_list

        # Comma-separated string
        s2 = Settings(
            supabase_url="https://test.supabase.co",
            supabase_service_key="k",
            CORS_ORIGINS="https://app.citecheck.ai, https://admin.citecheck.ai",
        )
        assert s2.cors_origins_list == ["https://app.citecheck.ai", "https://admin.citecheck.ai"]

        # JSON string array
        s3 = Settings(
            supabase_url="https://test.supabase.co",
            supabase_service_key="k",
            CORS_ORIGINS='["https://app.citecheck.ai", "https://preview.citecheck.ai"]',
        )
        assert s3.cors_origins_list == ["https://app.citecheck.ai", "https://preview.citecheck.ai"]
