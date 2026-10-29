"""
CiteCheck AI — Review Router.

Orchestrates the full review pipeline and human review decisions.
Protected by Supabase JWT verification.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_supabase_client
from app.core.security import CurrentUser, get_current_user
from app.engine.rules import run_rules_engine
from app.engine.verifier import run_five_gate_pipeline
from app.schemas import (
    DecisionCreate,
    DecisionResponse,
    FindingResponse,
    ReviewRequest,
    ReviewResponse,
    SeverityCounts,
    VerificationStats,
)

router = APIRouter(prefix="/api/v1", tags=["Review"])


def _build_lookup(rows: list[dict], key_field: str) -> dict[str, dict]:
    """Build a {code → row} lookup from a list of DB rows."""
    return {row[key_field]: row for row in rows}


@router.post("/review-draft", response_model=ReviewResponse)
async def review_draft(
    body: ReviewRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Execute the full review pipeline on a draft.
    Authenticated via Supabase JWT.

    1. Query approved_terms, approved_facts, and guidelines for the brand kit.
    2. Run the deterministic rules engine.
    3. Run the 5-Gate Evidence Verifier.
    4. Insert all verified findings and log the audit event.
    5. Return findings, severity counts, and verification stats.
    """
    sb = get_supabase_client()
    brand_kit_id = str(body.brand_kit_id)
    draft_id = str(body.draft_id)

    # ── Fetch draft ───────────────────────────────────────────────────────
    draft_result = sb.table("drafts").select("*").eq("id", draft_id).execute()
    if not draft_result.data:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found.")
    draft_row = draft_result.data[0]
    draft_text: str = draft_row["current_content"]
    version_number: int = draft_row["current_version"]

    # ── Fetch brand-kit reference data ────────────────────────────────────
    terms_result = (
        sb.table("approved_terms").select("*").eq("brand_kit_id", brand_kit_id).execute()
    )
    facts_result = (
        sb.table("approved_facts").select("*").eq("brand_kit_id", brand_kit_id).execute()
    )
    guidelines_result = (
        sb.table("guidelines").select("*").eq("brand_kit_id", brand_kit_id).execute()
    )

    approved_terms = terms_result.data or []
    approved_facts = facts_result.data or []
    guidelines = guidelines_result.data or []

    facts_by_code = _build_lookup(approved_facts, "fact_code")
    guidelines_by_code = _build_lookup(guidelines, "guideline_code")

    # ── Run deterministic rules engine ────────────────────────────────────
    raw_candidates = run_rules_engine(draft_text, approved_terms, guidelines)

    # ── Run 5-Gate Evidence Verifier ──────────────────────────────────────
    verified_findings, stats = run_five_gate_pipeline(
        raw_candidates, draft_text, facts_by_code, guidelines_by_code
    )

    # ── Persist findings ──────────────────────────────────────────────────
    inserted_findings: list[dict] = []
    for vf in verified_findings:
        row = vf.to_insert_dict(draft_id, version_number)
        insert_result = sb.table("findings").insert(row).execute()
        if insert_result.data:
            inserted_findings.append(insert_result.data[0])

    # ── Update draft status ───────────────────────────────────────────────
    sb.table("drafts").update({"status": "under_review"}).eq("id", draft_id).execute()

    # ── Audit log ─────────────────────────────────────────────────────────
    sb.table("audit_logs").insert({
        "draft_id": draft_id,
        "actor_id": str(current_user.id),
        "action_type": "review_executed",
        "payload": {
            "version_number": version_number,
            "total_candidates": stats["total_candidates"],
            "passed_all_gates": stats["passed_all_gates"],
            "dropped": stats["dropped"],
            "needs_review": stats["needs_review"],
        },
    }).execute()

    # ── Build response ────────────────────────────────────────────────────
    findings_response = [FindingResponse(**f) for f in inserted_findings]

    severity_counts = SeverityCounts(
        high=sum(1 for f in findings_response if f.severity.value == "high"),
        medium=sum(1 for f in findings_response if f.severity.value == "medium"),
        low=sum(1 for f in findings_response if f.severity.value == "low"),
    )

    return ReviewResponse(
        draft_id=body.draft_id,
        version_number=version_number,
        findings=findings_response,
        severity_counts=severity_counts,
        verification_stats=VerificationStats(**stats),
    )


@router.post("/decisions", response_model=DecisionResponse, status_code=status.HTTP_201_CREATED)
async def create_decision(
    body: DecisionCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Record a human decision on a finding.
    Authenticated via Supabase JWT. Defaults user_id to current_user.id.

    - ``accepted`` → auto-apply the suggested_fix to the draft content.
    - ``edited``   → apply the custom_edit_text to the draft content.
    - ``dismissed`` → no content change, just log the reason.
    """
    sb = get_supabase_client()
    finding_id = str(body.finding_id)
    user_id = str(body.user_id or current_user.id)

    # Fetch finding
    finding_result = sb.table("findings").select("*").eq("id", finding_id).execute()
    if not finding_result.data:
        raise HTTPException(status_code=404, detail=f"Finding '{finding_id}' not found.")
    finding = finding_result.data[0]

    # Insert decision
    decision_payload = {
        "finding_id": finding_id,
        "user_id": user_id,
        "action": body.action.value,
        "custom_edit_text": body.custom_edit_text,
        "dismissal_reason": body.dismissal_reason,
    }
    decision_result = sb.table("decisions").insert(decision_payload).execute()
    if not decision_result.data:
        raise HTTPException(status_code=500, detail="Failed to record decision.")

    # Auto-apply fix if accepted or edited
    if body.action.value in ("accepted", "edited"):
        draft_result = sb.table("drafts").select("*").eq("id", finding["draft_id"]).execute()
        if draft_result.data:
            draft_row = draft_result.data[0]
            current_content: str = draft_row["current_content"]
            excerpt: str = finding["exact_excerpt"]

            if body.action.value == "accepted" and finding.get("suggested_fix"):
                new_content = current_content.replace(excerpt, finding["suggested_fix"], 1)
            elif body.action.value == "edited" and body.custom_edit_text:
                new_content = current_content.replace(excerpt, body.custom_edit_text, 1)
            else:
                new_content = current_content

            if new_content != current_content:
                new_version = draft_row["current_version"] + 1
                sb.table("drafts").update({
                    "current_content": new_content,
                    "current_version": new_version,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", finding["draft_id"]).execute()

                sb.table("draft_versions").insert({
                    "draft_id": finding["draft_id"],
                    "version_number": new_version,
                    "content_text": new_content,
                    "diff_summary": {
                        "action": body.action.value,
                        "finding_id": finding_id,
                        "replaced": excerpt,
                        "replacement": finding.get("suggested_fix") if body.action.value == "accepted" else body.custom_edit_text,
                    },
                }).execute()

    # Audit log
    sb.table("audit_logs").insert({
        "draft_id": finding["draft_id"],
        "actor_id": user_id,
        "action_type": f"decision_{body.action.value}",
        "payload": {
            "finding_id": finding_id,
            "dismissal_reason": body.dismissal_reason,
        },
    }).execute()

    return DecisionResponse(**decision_result.data[0])
