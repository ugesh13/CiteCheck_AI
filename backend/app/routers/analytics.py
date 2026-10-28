"""
CiteCheck AI — Analytics Router.

Provides the Guideline Gap Radar — surfaces brand guidelines that are
frequently dismissed by content creators, signaling potential policy
misalignment. Protected by Supabase JWT verification.
"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends

from app.core.database import get_supabase_client
from app.core.security import CurrentUser, get_current_user
from app.schemas import GuidelineGapItem, GuidelineGapRadarResponse

router = APIRouter(prefix="/api/v1", tags=["Analytics"])


@router.get("/guideline-gap-radar", response_model=GuidelineGapRadarResponse)
async def guideline_gap_radar(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Guideline Gap Radar.
    Authenticated via Supabase JWT.

    Groups all findings by ``cited_guideline_id``, counts how many were
    dismissed, and computes a dismiss rate.  Guidelines with high dismiss
    rates are "gaps" — they may need revision.

    Returns results sorted by dismiss_rate descending.
    """
    sb = get_supabase_client()

    # Fetch all findings that cite a guideline
    findings_result = (
        sb.table("findings")
        .select("id, cited_guideline_id")
        .neq("cited_guideline_id", "null")
        .execute()
    )
    findings_rows = findings_result.data or []

    if not findings_rows:
        return GuidelineGapRadarResponse(gaps=[])

    # Build mapping: guideline_id → list of finding_ids
    guideline_findings: dict[str, list[str]] = defaultdict(list)
    for row in findings_rows:
        gid = row.get("cited_guideline_id")
        if gid:
            guideline_findings[gid].append(row["id"])

    # Fetch all decisions for those findings
    all_finding_ids = [fid for fids in guideline_findings.values() for fid in fids]
    decisions_result = (
        sb.table("decisions")
        .select("finding_id, action, dismissal_reason")
        .in_("finding_id", all_finding_ids)
        .execute()
    )
    decisions_rows = decisions_result.data or []

    # Index decisions by finding_id
    decisions_by_finding: dict[str, list[dict]] = defaultdict(list)
    for d in decisions_rows:
        decisions_by_finding[d["finding_id"]].append(d)

    # Fetch guideline metadata
    guideline_ids = list(guideline_findings.keys())
    guidelines_result = (
        sb.table("guidelines")
        .select("id, guideline_code, title")
        .in_("id", guideline_ids)
        .execute()
    )
    guidelines_meta = {g["id"]: g for g in (guidelines_result.data or [])}

    # Compute gap items
    gaps: list[GuidelineGapItem] = []
    for gid, finding_ids in guideline_findings.items():
        total = len(finding_ids)
        dismissed = 0
        reasons: list[str] = []

        for fid in finding_ids:
            for dec in decisions_by_finding.get(fid, []):
                if dec["action"] == "dismissed":
                    dismissed += 1
                    if dec.get("dismissal_reason"):
                        reasons.append(dec["dismissal_reason"])

        meta = guidelines_meta.get(gid, {})
        gaps.append(
            GuidelineGapItem(
                guideline_id=gid,
                guideline_code=meta.get("guideline_code"),
                guideline_title=meta.get("title"),
                total_findings=total,
                dismissed_count=dismissed,
                dismiss_rate=round(dismissed / total, 3) if total > 0 else 0.0,
                top_dismissal_reasons=reasons[:5],
            )
        )

    # Sort by dismiss rate descending
    gaps.sort(key=lambda g: g.dismiss_rate, reverse=True)

    return GuidelineGapRadarResponse(gaps=gaps)
