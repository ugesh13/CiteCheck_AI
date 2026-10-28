"""
CiteCheck AI — Supabase Database Client (Backwards-Compatibility Shim).

Re-exports database helpers from app.core.database.
"""

from app.core.database import (
    get_supabase_admin_client,
    get_supabase_client,
    get_user_supabase_client,
)

__all__ = [
    "get_supabase_admin_client",
    "get_supabase_client",
    "get_user_supabase_client",
]
