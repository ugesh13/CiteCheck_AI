"""
CiteCheck AI — Store Provider and Singleton Accessor.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import get_settings
from app.store.base import BaseStore
from app.store.memory import MemoryStore
from app.store.supabase import SupabaseStore

logger = logging.getLogger(__name__)

_STORE_INSTANCE: Optional[BaseStore] = None
_STORE_BACKEND: str = "memory"


def get_store() -> BaseStore:
    """Return singleton store implementation (SupabaseStore if configured, else MemoryStore)."""
    global _STORE_INSTANCE, _STORE_BACKEND
    if _STORE_INSTANCE is None:
        settings = get_settings()
        # Check if Supabase URL and key are set and non-empty
        has_supabase = bool(
            settings.supabase_url
            and (settings.supabase_service_role_key or settings.supabase_anon_key)
        )
        if has_supabase:
            try:
                _STORE_INSTANCE = SupabaseStore()
                _STORE_BACKEND = "supabase"
                logger.info("Initialized SupabaseStore repository layer.")
            except Exception as exc:
                logger.warning("Failed to initialize SupabaseStore (%s); falling back to MemoryStore.", exc)
                _STORE_INSTANCE = MemoryStore()
                _STORE_BACKEND = "memory"
        else:
            _STORE_INSTANCE = MemoryStore()
            _STORE_BACKEND = "memory"
            logger.info("Initialized MemoryStore repository layer.")

    return _STORE_INSTANCE


def get_store_backend_name() -> str:
    """Return 'supabase' or 'memory'."""
    get_store()
    return _STORE_BACKEND


def set_store(store: BaseStore, name: str = "custom") -> None:
    """Explicitly set store instance (useful for unit tests)."""
    global _STORE_INSTANCE, _STORE_BACKEND
    _STORE_INSTANCE = store
    _STORE_BACKEND = name
