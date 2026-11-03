"""
Canonical Repository Provider Re-export.

Provides unified store access for CiteCheck AI, supporting both
Supabase and Memory fallback stores via BaseStore contract.
"""

from __future__ import annotations

from app.store.base import BaseStore
from app.store.provider import get_store, set_store, reset_store

__all__ = ["BaseStore", "get_store", "set_store", "reset_store"]
