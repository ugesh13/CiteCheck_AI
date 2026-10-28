"""
CiteCheck AI — Supabase Database Client.

Provides factory functions for:
1. Admin client (service-role key, bypasses RLS) for system engines & verifier.
2. User-scoped client (authenticated user JWT, respects RLS policies).
"""

from functools import lru_cache
from typing import Optional

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from app.core.config import get_settings


@lru_cache()
def get_supabase_admin_client() -> Client:
    """
    Return a cached Supabase client using the service-role key.
    Used for administrative actions and background verification engines.
    """
    settings = get_settings()
    key = settings.service_role_key
    if not settings.supabase_url or not key:
        raise ValueError(
            "SUPABASE_URL and either SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY "
            "must be configured in the environment."
        )
    return create_client(settings.supabase_url, key)


def get_supabase_client() -> Client:
    """Backwards-compatible alias for get_supabase_admin_client."""
    return get_supabase_admin_client()


def get_user_supabase_client(token: str) -> Client:
    """
    Return a Supabase client scoped to the authenticated user's JWT token.
    This client enforces PostgreSQL Row Level Security (RLS) for the user.
    """
    settings = get_settings()
    # Use anon key if available, else fallback to service key with user auth header
    api_key = settings.supabase_anon_key or settings.service_role_key
    options = ClientOptions(
        headers={"Authorization": f"Bearer {token}"}
    )
    return create_client(settings.supabase_url, api_key, options=options)
