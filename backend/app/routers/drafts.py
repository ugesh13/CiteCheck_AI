"""
CiteCheck AI — Drafts Router.

Authenticated endpoints for creating and retrieving drafts with Supabase RLS and Audit logging.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_supabase_client
from app.core.security import CurrentUser, get_current_user
from app.schemas import (
    DraftCreate,
    DraftDetailResponse,
    DraftResponse,
    FindingResponse,
)

router = APIRouter(prefix="/api/v1/drafts", tags=["Drafts"])


@router.post("", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: DraftCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Create a new draft and its initial version (v1).
    Authenticated via Supabase JWT. Assigns creator_id to current_user.id if not specified.
    """
    sb = get_supabase_client()
    creator_id = str(body.creator_id or current_user.id)

    # 1. Insert draft
    draft_payload = {
        "brand_kit_id": str(body.brand_kit_id),
        "title": body.title,
        "current_content": body.content,
        "file_format": body.file_format,
        "current_version": 1,
        "status": "draft",
        "creator_id": creator_id,
    }

    draft_result = sb.table("drafts").insert(draft_payload).execute()
    if not draft_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create draft.",
        )

    draft_row = draft_result.data[0]

    # 2. Insert initial version
    version_payload = {
        "draft_id": draft_row["id"],
        "version_number": 1,
        "content_text": body.content,
        "diff_summary": {"note": "Initial version"},
    }
    sb.table("draft_versions").insert(version_payload).execute()

    # 3. Audit log with authenticated actor
    sb.table("audit_logs").insert({
        "draft_id": draft_row["id"],
        "actor_id": str(current_user.id),
        "action_type": "draft_created",
        "payload": {"title": body.title, "version": 1},
    }).execute()

    return DraftResponse(**draft_row)


@router.get("/{draft_id}", response_model=DraftDetailResponse)
async def get_draft(
    draft_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Retrieve a draft by ID together with its current findings.
    Requires authenticated user token.
    """
    sb = get_supabase_client()

    # Fetch draft
    draft_result = sb.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Draft '{draft_id}' not found.",
        )

    draft_row = draft_result.data[0]

    # Fetch latest findings for this draft's current version
    findings_result = (
        sb.table("findings")
        .select("*")
        .eq("draft_id", draft_id)
        .eq("version_number", draft_row["current_version"])
        .order("created_at", desc=True)
        .execute()
    )

    findings = [FindingResponse(**f) for f in (findings_result.data or [])]

    return DraftDetailResponse(
        draft=DraftResponse(**draft_row),
        findings=findings,
    )
