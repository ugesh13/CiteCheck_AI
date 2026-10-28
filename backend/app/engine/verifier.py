"""
CiteCheck AI — 5-Gate Evidence Verifier.

Every candidate finding passes through five sequential gates before being
persisted.  A failure at any gate either drops the finding or escalates it
to "needs_review" for human inspection.

Gate 1 – Schema Validation       (Pydantic)
Gate 2 – Reference Verification  (Supabase lookup)
Gate 3 – Excerpt Presence         (substring match)
Gate 4 – Intent Preservation      (RegEx number/date comparison)
Gate 5 – Fact Freshness           (review_date recency check)
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import ValidationError

from app.schemas import (
    CandidateFinding,
    FindingCategory,
    FindingSeverity,
    VerificationStatus,
)

# Regex for extracting numeric / percentage / date tokens
_NUMERIC_PATTERN = re.compile(r"\b\d+(?:\.\d+)?%?\b")


# ─── Data Structures ─────────────────────────────────────────────────────────

class VerifiedFinding:
    """The output of a successful 5-gate pass."""

    def __init__(
        self,
        *,
        category: FindingCategory,
        severity: FindingSeverity,
        exact_excerpt: str,
        reason: str,
        cited_fact_id: Optional[UUID] = None,
        cited_guideline_id: Optional[UUID] = None,
        suggested_fix: Optional[str] = None,
        is_intent_guarded: bool = False,
        verification_status: VerificationStatus = VerificationStatus.verified,
    ):
        self.category = category
        self.severity = severity
        self.exact_excerpt = exact_excerpt
        self.reason = reason
        self.cited_fact_id = cited_fact_id
        self.cited_guideline_id = cited_guideline_id
        self.suggested_fix = suggested_fix
        self.is_intent_guarded = is_intent_guarded
        self.verification_status = verification_status

    def to_insert_dict(self, draft_id: str, version_number: int) -> dict[str, Any]:
        """Serialize for Supabase insert."""
        return {
            "draft_id": draft_id,
            "version_number": version_number,
            "category": self.category.value,
            "severity": self.severity.value,
            "exact_excerpt": self.exact_excerpt,
            "reason": self.reason,
            "cited_fact_id": str(self.cited_fact_id) if self.cited_fact_id else None,
            "cited_guideline_id": str(self.cited_guideline_id) if self.cited_guideline_id else None,
            "suggested_fix": self.suggested_fix,
            "is_intent_guarded": self.is_intent_guarded,
            "verification_status": self.verification_status.value,
        }


class GateResult:
    """Outcome of running a single gate."""

    def __init__(self, passed: bool, message: str = ""):
        self.passed = passed
        self.message = message


# ─── Individual Gate Functions ────────────────────────────────────────────────

def gate_1_schema_validation(raw: dict[str, Any]) -> tuple[GateResult, CandidateFinding | None]:
    """
    Gate 1 — Validate raw dict against the CandidateFinding Pydantic model.

    Returns the validated model on success, or None on failure.
    """
    try:
        candidate = CandidateFinding(**raw)
        return GateResult(True), candidate
    except ValidationError as exc:
        return GateResult(False, f"Schema validation failed: {exc.error_count()} error(s)"), None


def gate_2_reference_verification(
    candidate: CandidateFinding,
    facts_by_code: dict[str, dict],
    guidelines_by_code: dict[str, dict],
) -> tuple[GateResult, Optional[UUID], Optional[UUID]]:
    """
    Gate 2 — Verify that cited fact_code / guideline_code actually exist
    in the brand kit's lookup tables.

    Returns resolved UUIDs for fact and guideline.
    """
    cited_fact_id: Optional[UUID] = None
    cited_guideline_id: Optional[UUID] = None

    if candidate.cited_fact_code:
        fact_row = facts_by_code.get(candidate.cited_fact_code)
        if fact_row is None:
            return (
                GateResult(False, f"Cited fact_code '{candidate.cited_fact_code}' not found in approved_facts"),
                None,
                None,
            )
        cited_fact_id = UUID(fact_row["id"])

    if candidate.cited_guideline_code:
        guideline_row = guidelines_by_code.get(candidate.cited_guideline_code)
        if guideline_row is None:
            return (
                GateResult(False, f"Cited guideline_code '{candidate.cited_guideline_code}' not found in guidelines"),
                None,
                None,
            )
        cited_guideline_id = UUID(guideline_row["id"])

    return GateResult(True), cited_fact_id, cited_guideline_id


def gate_3_excerpt_presence(candidate: CandidateFinding, draft_text: str) -> GateResult:
    """
    Gate 3 — Confirm exact_excerpt is literally present in the draft text.
    Case-sensitive substring match.
    """
    if candidate.exact_excerpt in draft_text:
        return GateResult(True)
    return GateResult(False, f"Excerpt not found in draft: '{candidate.exact_excerpt[:80]}…'")


def gate_4_intent_preservation(candidate: CandidateFinding) -> tuple[GateResult, bool]:
    """
    Gate 4 — If a suggested_fix is provided, compare numeric/date tokens
    between the original excerpt and the fix.

    If they differ, set is_intent_guarded = True (flagged for human review).
    The finding still passes, but with the guard flag.
    """
    if not candidate.suggested_fix:
        return GateResult(True), False

    original_tokens = set(_NUMERIC_PATTERN.findall(candidate.exact_excerpt))
    fix_tokens = set(_NUMERIC_PATTERN.findall(candidate.suggested_fix))

    if original_tokens and original_tokens != fix_tokens:
        return (
            GateResult(True, "Intent guard triggered — numeric/date tokens differ between excerpt and fix"),
            True,
        )
    return GateResult(True), False


def gate_5_fact_freshness(
    candidate: CandidateFinding,
    facts_by_code: dict[str, dict],
    current_severity: FindingSeverity,
) -> tuple[GateResult, FindingSeverity, str]:
    """
    Gate 5 — If a fact is cited, check whether its review_date < today.
    If stale, escalate severity to 'high' and append a warning.

    Returns (result, final_severity, extra_reason_suffix).
    """
    extra_reason = ""
    severity = current_severity

    if candidate.cited_fact_code:
        fact_row = facts_by_code.get(candidate.cited_fact_code)
        if fact_row and fact_row.get("review_date"):
            review_date_raw = fact_row["review_date"]
            # Supabase returns DATE as string "YYYY-MM-DD"
            if isinstance(review_date_raw, str):
                review_dt = datetime.strptime(review_date_raw, "%Y-%m-%d").date()
            elif isinstance(review_date_raw, date):
                review_dt = review_date_raw
            else:
                review_dt = None

            if review_dt and review_dt < date.today():
                severity = FindingSeverity.high
                extra_reason = (
                    f" ⚠️ Cited fact '{candidate.cited_fact_code}' was last reviewed "
                    f"on {review_dt.isoformat()}, which is before today. "
                    f"Please re-verify this fact."
                )

    return GateResult(True), severity, extra_reason


# ─── Main Pipeline ───────────────────────────────────────────────────────────

def run_five_gate_pipeline(
    raw_candidates: list[dict[str, Any]],
    draft_text: str,
    facts_by_code: dict[str, dict],
    guidelines_by_code: dict[str, dict],
) -> tuple[list[VerifiedFinding], dict[str, int]]:
    """
    Run all candidate findings through the 5-Gate pipeline.

    Parameters
    ----------
    raw_candidates : list of dicts
        Each dict represents a candidate finding (may come from the rules
        engine or an LLM).
    draft_text : str
        The full current content of the draft being reviewed.
    facts_by_code : dict
        Mapping of fact_code → full row dict (from approved_facts).
    guidelines_by_code : dict
        Mapping of guideline_code → full row dict (from guidelines).

    Returns
    -------
    (verified_findings, stats)
        verified_findings — list of VerifiedFinding objects ready for insert.
        stats — dict with keys total_candidates, passed_all_gates, dropped,
                needs_review.
    """
    verified: list[VerifiedFinding] = []
    stats = {
        "total_candidates": len(raw_candidates),
        "passed_all_gates": 0,
        "dropped": 0,
        "needs_review": 0,
    }

    for raw in raw_candidates:
        # ── Gate 1: Schema ────────────────────────────────────────────
        g1, candidate = gate_1_schema_validation(raw)
        if not g1.passed or candidate is None:
            stats["dropped"] += 1
            continue

        # ── Gate 2: Reference lookup ──────────────────────────────────
        g2, cited_fact_id, cited_guideline_id = gate_2_reference_verification(
            candidate, facts_by_code, guidelines_by_code
        )
        if not g2.passed:
            stats["dropped"] += 1
            continue

        # ── Gate 3: Excerpt presence ──────────────────────────────────
        g3 = gate_3_excerpt_presence(candidate, draft_text)
        if not g3.passed:
            stats["dropped"] += 1
            continue

        # ── Gate 4: Intent preservation ───────────────────────────────
        g4, is_intent_guarded = gate_4_intent_preservation(candidate)

        # ── Gate 5: Fact freshness ────────────────────────────────────
        g5, final_severity, extra_reason = gate_5_fact_freshness(
            candidate, facts_by_code, candidate.severity
        )

        # ── Build verified finding ────────────────────────────────────
        verification_status = VerificationStatus.verified
        if is_intent_guarded:
            verification_status = VerificationStatus.needs_review
            stats["needs_review"] += 1

        full_reason = candidate.reason + extra_reason

        verified.append(
            VerifiedFinding(
                category=candidate.category,
                severity=final_severity,
                exact_excerpt=candidate.exact_excerpt,
                reason=full_reason,
                cited_fact_id=cited_fact_id,
                cited_guideline_id=cited_guideline_id,
                suggested_fix=candidate.suggested_fix,
                is_intent_guarded=is_intent_guarded,
                verification_status=verification_status,
            )
        )
        stats["passed_all_gates"] += 1

    return verified, stats
