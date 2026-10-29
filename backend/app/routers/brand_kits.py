"""
CiteCheck AI — Brand Kits Router.

Endpoints for retrieving brand kits and governance guidelines.
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import get_supabase_client
from app.core.security import CurrentUser, get_current_user
from app.schemas import BrandKitResponse

router = APIRouter(prefix="/api/v1/brand-kits", tags=["Brand Kits"])


@router.get("", response_model=List[BrandKitResponse])
async def get_brand_kits(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Retrieve all brand kits available in the platform.
    Requires authentication (Bearer dev-token in development).
    """
    sb = get_supabase_client()
    try:
        res = sb.table("brand_kits").select("*").execute()
        if res.data and len(res.data) > 0:
            return [BrandKitResponse(**row) for row in res.data if isinstance(row, dict)]
    except Exception:
        pass

    # Fallback to seeded demo brand kit if database table is empty or loading
    return [
        BrandKitResponse(
            id=UUID("a1b2c3d4-e5f6-7890-abcd-111111111111"),
            name="Acme Corp Brand Kit 2026",
            description="Official enterprise tone, approved claims, and product terminology.",
        )
    ]
