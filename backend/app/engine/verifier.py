"""
CiteCheck AI — 5-Gate Evidence Verifier.

Every candidate finding passes through five sequential gates before being
persisted. A failure at any gate drops the finding (with exact failure reason)
or routes it to human review / flags an expired fact block.

Gate 1 – Schema Validation       (Strict Pydantic candidate structure & bounds)
Gate 2 – Source Exists           (Brand kit citation verified; 'No source, no finding' for claims)
Gate 3 – Exact Quote Presence    (Verbatim quote verified in draft content)
Gate 4 – Fix Preserves Facts     (Guards against altered numbers, dates, prices, entities)
Gate 5 – Freshness & Confidence  (Expired fact block & confidence routing <0.80)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from pydantic import ValidationError

from app.schemas import (
    CandidateFinding,
    FindingCategory,
    FindingSeverity,
    VerificationStatus,
)

# Regex for guarded numeric, currency, percentage, and date tokens
_GUARDED_TOKEN_PATTERN = re.compile(
    r"(?:"
    r"[$₹€£]\s*\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:INR|USD|EUR|GBP|%)\b|"
    r"\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*percent\b|"
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|"
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b"
    r")",
    re.IGNORECASE,
)
_NUMERIC_PATTERN = re.compile(r"\b\d+(?:\.\d+)?%?\b")

KNOWN_NAMED_ENTITIES = {
    "lumen pay", "lumen", "upi", "tls 1.3", "npci", "acme", "acme cloud"
}


# ─── Data Structures ─────────────────────────────────────────────────────────

class GateResult:
    """Outcome of running a single gate."""

    def __init__(
        self,
        passed: bool,
        message: str = "",
        result_type: str = "passed",  # passed | failed | routed | warning | skipped
        evidence: str = "",
    ):
        self.passed = passed
        self.message = message
        self.result_type = result_type if passed else "failed"
        self.evidence = evidence


class VerifiedFinding:
    """The output of a verified pass with full 5-gate trace."""

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
        confidence: float = 0.95,
        source: str = "rules",
        source_ref_id: str = "GUIDE-01",
        start: int = 0,
        end: int = 0,
        paragraph_ref: str = "p-1",
        verification_trace: Optional[List[Dict[str, Any]]] = None,
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
        self.confidence = max(0.0, min(1.0, confidence))
        self.source = source
        self.source_ref_id = source_ref_id
        self.start = start
        self.end = end
        self.paragraph_ref = paragraph_ref
        self.verification_trace = verification_trace or []

    def to_insert_dict(self, draft_id: str, version_number: int) -> Dict[str, Any]:
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
            "confidence": self.confidence,
            "source": self.source,
            "paragraph_ref": self.paragraph_ref,
            "verification_trace": self.verification_trace,
        }

    def to_frontend_dict(self, finding_id: str, draft_id: str) -> Dict[str, Any]:
        """Serialize matching frontend builder requirements."""
        return {
            "id": finding_id,
            "draft_id": draft_id,
            "excerpt": self.exact_excerpt,
            "start": self.start,
            "end": self.end,
            "type": self.category.value.capitalize(),
            "category": self.category.value,
            "severity": self.severity.value,
            "source": self.source,
            "source_ref_id": self.source_ref_id,
            "reason": self.reason,
            "suggested_fix": self.suggested_fix or self.exact_excerpt,
            "fix_needs_human": self.is_intent_guarded or self.verification_status in (
                VerificationStatus.needs_review,
                VerificationStatus.human_review_required,
                VerificationStatus.blocked_expired_fact,
            ),
            "confidence": self.confidence,
            "status": "blocked_expired_fact" if self.verification_status == VerificationStatus.blocked_expired_fact else "open",
            "paragraph_ref": self.paragraph_ref,
            "verification_trace": self.verification_trace,
        }


# ─── Individual Gate Implementations ─────────────────────────────────────────

def gate_1_schema_validation(raw: Dict[str, Any]) -> Tuple[GateResult, Optional[CandidateFinding]]:
    """
    Gate 1 — Schema Validation (Strict Pydantic check).
    Fails on missing required fields, empty excerpts, invalid enums, or confidence outside [0, 1].
    """
    try:
        candidate = CandidateFinding(**raw)
        if not candidate.exact_excerpt.strip():
            return GateResult(False, "Exact excerpt cannot be empty or whitespace only.", "failed"), None
        return GateResult(True, "Gate 1 passed: candidate conforms to Pydantic schema", "passed", evidence="Schema v2"), candidate
    except ValidationError as exc:
        return GateResult(False, f"Gate 1 failed: schema validation error ({exc.error_count()} issue(s))", "failed"), None
    except Exception as exc:
        return GateResult(False, f"Gate 1 failed: unexpected validation error ({str(exc)})", "failed"), None


def gate_2_reference_verification(
    candidate: CandidateFinding,
    facts_by_code: Dict[str, Any],
    guidelines_by_code: Dict[str, Any],
) -> Tuple[GateResult, Optional[UUID], Optional[UUID]]:
    """
    Gate 2 — Source Exists.
    Checks that cited fact_code and guideline_code exist in the active brand kit and are not archived.
    Rule: 'No source, no finding' — any claim-type finding MUST cite at least one source.
    """
    cited_fact_id: Optional[UUID] = None
    cited_guideline_id: Optional[UUID] = None

    # Enforce 'No source, no finding' on claims
    if candidate.category == FindingCategory.claim and not candidate.cited_fact_code and not candidate.cited_guideline_code:
        return (
            GateResult(
                False,
                "Gate 2 failed: claim-type finding must cite at least one brand kit source ('No source, no finding'). Not found.",
                "failed",
                evidence="No citation",
            ),
            None,
            None,
        )

    if candidate.cited_fact_code:
        fact_row = facts_by_code.get(candidate.cited_fact_code)
        if fact_row is None:
            return (
                GateResult(
                    False,
                    f"Gate 2 failed: cited fact_code '{candidate.cited_fact_code}' not found in approved_facts.",
                    "failed",
                    evidence=f"Missing: {candidate.cited_fact_code}",
                ),
                None,
                None,
            )
        if fact_row.get("is_active") is False or fact_row.get("status_override") == "archived":
            return (
                GateResult(
                    False,
                    f"Gate 2 failed: cited fact '{candidate.cited_fact_code}' is archived from Brand Kit.",
                    "failed",
                    evidence=f"Archived: {candidate.cited_fact_code}",
                ),
                None,
                None,
            )
        try:
            cited_fact_id = UUID(str(fact_row.get("id")))
        except (ValueError, TypeError):
            cited_fact_id = None

    if candidate.cited_guideline_code:
        guideline_row = guidelines_by_code.get(candidate.cited_guideline_code)
        if guideline_row is None:
            return (
                GateResult(
                    False,
                    f"Gate 2 failed: cited guideline_code '{candidate.cited_guideline_code}' not found in guidelines.",
                    "failed",
                    evidence=f"Missing: {candidate.cited_guideline_code}",
                ),
                None,
                None,
            )
        try:
            cited_guideline_id = UUID(str(guideline_row.get("id")))
        except (ValueError, TypeError):
            cited_guideline_id = None

    evidence = f"{candidate.cited_fact_code or ''} {candidate.cited_guideline_code or ''}".strip()
    return (
        GateResult(True, f"Gate 2 passed: cited source(s) verified in active Brand Kit", "passed", evidence=evidence or "Verified"),
        cited_fact_id,
        cited_guideline_id,
    )


def _normalize_text_for_match(text: str) -> str:
    """Normalize whitespace and smart quotes for verbatim matching without breaking case."""
    t = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").replace("«", '"').replace("»", '"')
    t = re.sub(r"[\s\u00A0\u200B]+", " ", t)
    return t.strip()


def gate_3_excerpt_presence(candidate: CandidateFinding, draft_text: str) -> GateResult:
    """
    Gate 3 — Exact Quote Presence.
    Verifies verbatim match in draft text (literal first, then whitespace/quote normalized).
    Strictly case-sensitive — altered capitalization fails Gate 3.
    """
    if candidate.exact_excerpt in draft_text:
        start = draft_text.find(candidate.exact_excerpt)
        end = start + len(candidate.exact_excerpt)
        return GateResult(True, f"Gate 3 passed: exact quote verified at characters {start}–{end}", "passed", evidence=f"chars {start}–{end}")

    norm_excerpt = _normalize_text_for_match(candidate.exact_excerpt)
    norm_draft = _normalize_text_for_match(draft_text)
    if norm_excerpt in norm_draft:
        start = norm_draft.find(norm_excerpt)
        end = start + len(norm_excerpt)
        return GateResult(True, f"Gate 3 passed: normalized verbatim quote verified at characters {start}–{end}", "passed", evidence=f"chars {start}–{end}")

    return GateResult(
        False,
        f"Gate 3 failed: quote '{candidate.exact_excerpt[:50]}' was not found verbatim in the draft.",
        "failed",
        evidence=f"'{candidate.exact_excerpt[:40]}'",
    )


def gate_4_intent_preservation(candidate: CandidateFinding) -> Tuple[GateResult, bool]:
    """
    Gate 4 — Fix Preserves Facts.
    Compares numbers, percentages, dates, currency, and named entities between excerpt and fix.
    If the fix adds, alters, or removes any, it is flagged with a warning for human review.
    """
    if not candidate.suggested_fix:
        return GateResult(True, "Gate 4 skipped: no automated fix proposed", "skipped", evidence="No fix"), False

    # 1. Guarded numeric/currency/date tokens
    orig_guarded = set(_GUARDED_TOKEN_PATTERN.findall(candidate.exact_excerpt)) or set(_NUMERIC_PATTERN.findall(candidate.exact_excerpt))
    fix_guarded = set(_GUARDED_TOKEN_PATTERN.findall(candidate.suggested_fix)) or set(_NUMERIC_PATTERN.findall(candidate.suggested_fix))

    # 2. Named entities
    exc_lower = candidate.exact_excerpt.lower()
    fix_lower = candidate.suggested_fix.lower()
    orig_entities = {ent for ent in KNOWN_NAMED_ENTITIES if ent in exc_lower}
    fix_entities = {ent for ent in KNOWN_NAMED_ENTITIES if ent in fix_lower}

    has_token_diff = bool(orig_guarded and orig_guarded != fix_guarded)
    has_entity_diff = bool(orig_entities and orig_entities != fix_entities)

    if has_token_diff or has_entity_diff:
        diff_desc = []
        if has_token_diff:
            diff_desc.append(f"numeric/metric tokens ({orig_guarded} -> {fix_guarded})")
        if has_entity_diff:
            diff_desc.append(f"named entities ({orig_entities} -> {fix_entities})")

        msg = f"Gate 4 warning: fix alters {' and '.join(diff_desc)}. Routed for human confirmation."
        return GateResult(True, msg, "warning", evidence="Altered metric/entity"), True

    return GateResult(True, "Gate 4 passed: fix preserves numbers, metrics, and named entities", "passed", evidence="Preserved"), False


def gate_5_fact_freshness(
    candidate: CandidateFinding,
    facts_by_code: Dict[str, Any],
    current_severity: FindingSeverity,
    confidence: float = 0.95,
) -> Tuple[GateResult, FindingSeverity, str]:
    """
    Gate 5 — Freshness & Confidence Routing.
    (a) Fact Freshness: if cited fact is expired (< today), severity is raised to high,
        and publication is blocked (blocked_expired_fact).
    (b) Confidence Routing: if confidence < 0.80, routed to human review.
    Returns (GateResult, severity, extra_reason).
    """
    extra_reason = ""
    severity = current_severity

    # 1. Check Fact Freshness
    if candidate.cited_fact_code:
        fact_row = facts_by_code.get(candidate.cited_fact_code)
        if fact_row:
            expires_val = fact_row.get("expires_on") or fact_row.get("review_date")
            if expires_val:
                try:
                    review_dt = date.fromisoformat(str(expires_val)[:10])
                    today = datetime.now(timezone.utc).date()
                    if review_dt < today:
                        severity = FindingSeverity.high
                        extra_reason = (
                            f" ⚠️ Blocked at Gate 5: cited fact '{candidate.cited_fact_code}' expired on "
                            f"{review_dt.isoformat()}. Re-verify this fact before publication."
                        )
                        return (
                            GateResult(
                                True,
                                f"Gate 5 blocked: cited fact '{candidate.cited_fact_code}' expired on {review_dt.isoformat()}",
                                "blocked_expired_fact",
                                evidence="EXPIRED FACT",
                            ),
                            severity,
                            extra_reason,
                        )
                    elif review_dt <= today + timedelta(days=30):
                        extra_reason = f" (Notice: cited fact {candidate.cited_fact_code} expires on {review_dt.isoformat()})"
                        return (
                            GateResult(
                                True,
                                f"Gate 5 warning: fact {candidate.cited_fact_code} expires soon ({review_dt.isoformat()})",
                                "warning",
                                evidence="Expiring ≤30d",
                            ),
                            severity,
                            extra_reason,
                        )
                except ValueError:
                    pass

    # 2. Check Confidence Routing (< 0.80)
    if confidence < 0.80:
        return (
            GateResult(
                True,
                f"Gate 5 routed: confidence {confidence:.2f} < 0.80 threshold. Routed to human reviewer.",
                "routed",
                evidence=f"{confidence:.2f} < 0.80",
            ),
            severity,
            extra_reason,
        )

    return (
        GateResult(True, f"Gate 5 passed: fact is active and confidence {confidence:.2f} >= 0.80", "passed", evidence="Active / High Conf"),
        severity,
        extra_reason,
    )


# ─── Main Pipeline Execution ─────────────────────────────────────────────────

def run_five_gate_pipeline(
    raw_candidates: List[Dict[str, Any]],
    draft_text: str,
    facts_by_code: Dict[str, Any],
    guidelines_by_code: Dict[str, Any],
) -> Tuple[List[VerifiedFinding], Dict[str, Any]]:
    """
    Run candidate findings through the hardened 5-Gate Evidence Verifier pipeline.
    Produces verified findings with per-gate traces and detailed drop accounting.
    """
    verified: List[VerifiedFinding] = []
    dropped: List[Dict[str, Any]] = []

    stats: Dict[str, Any] = {
        "total_candidates": len(raw_candidates),
        "passed_all_gates": 0,
        "dropped": 0,
        "needs_review": 0,
        "human_review_required": 0,
        "blocked_expired_fact": 0,
        "dropped_by_gate": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
    }

    for idx, raw in enumerate(raw_candidates):
        trace: List[Dict[str, Any]] = []

        # ── Gate 1: Schema Validation ────────────────────────────────────────
        g1, candidate = gate_1_schema_validation(raw)
        trace.append({
            "gate": 1,
            "name": "Schema Validation",
            "result": g1.result_type,
            "message": g1.message,
            "evidence": g1.evidence,
        })
        if not g1.passed or candidate is None:
            stats["dropped"] += 1
            stats["dropped_by_gate"][1] += 1
            dropped.append({
                "id": f"drop-{idx + 1}",
                "candidate": raw.get("exact_excerpt", f"Candidate #{idx + 1}"),
                "failed_gate": 1,
                "reason": g1.message,
                "raw": raw,
            })
            continue

        # ── Gate 2: Source Verification ──────────────────────────────────────
        g2, cited_fact_id, cited_guideline_id = gate_2_reference_verification(
            candidate, facts_by_code, guidelines_by_code
        )
        trace.append({
            "gate": 2,
            "name": "Source Exists",
            "result": g2.result_type,
            "message": g2.message,
            "evidence": g2.evidence,
        })
        if not g2.passed:
            stats["dropped"] += 1
            stats["dropped_by_gate"][2] += 1
            dropped.append({
                "id": f"drop-{idx + 1}",
                "candidate": candidate.exact_excerpt,
                "failed_gate": 2,
                "reason": g2.message,
                "raw": raw,
            })
            continue

        # ── Gate 3: Excerpt Presence ─────────────────────────────────────────
        g3 = gate_3_excerpt_presence(candidate, draft_text)
        trace.append({
            "gate": 3,
            "name": "Exact Quote",
            "result": g3.result_type,
            "message": g3.message,
            "evidence": g3.evidence,
        })
        if not g3.passed:
            stats["dropped"] += 1
            stats["dropped_by_gate"][3] += 1
            dropped.append({
                "id": f"drop-{idx + 1}",
                "candidate": candidate.exact_excerpt,
                "failed_gate": 3,
                "reason": g3.message,
                "raw": raw,
            })
            continue

        # Find offsets
        match = re.search(re.escape(candidate.exact_excerpt), draft_text)
        start = match.start() if match else 0
        end = match.end() if match else start + len(candidate.exact_excerpt)

        # ── Gate 4: Fix Preserves Facts ──────────────────────────────────────
        g4, is_intent_guarded = gate_4_intent_preservation(candidate)
        trace.append({
            "gate": 4,
            "name": "Fix Preserves Facts",
            "result": g4.result_type,
            "message": g4.message,
            "evidence": g4.evidence,
        })

        # ── Gate 5: Freshness & Confidence Routing ───────────────────────────
        confidence = float(getattr(candidate, "confidence", raw.get("confidence", 0.95)))
        g5, final_severity, extra_reason = gate_5_fact_freshness(
            candidate, facts_by_code, candidate.severity, confidence
        )
        trace.append({
            "gate": 5,
            "name": "Freshness & Confidence",
            "result": g5.result_type,
            "message": g5.message,
            "evidence": g5.evidence,
        })

        # Final Status determination
        if g5.result_type == "blocked_expired_fact":
            final_status = VerificationStatus.blocked_expired_fact
            stats["blocked_expired_fact"] += 1
        elif is_intent_guarded:
            final_status = VerificationStatus.needs_review
            stats["needs_review"] += 1
        elif g5.result_type == "routed":
            final_status = VerificationStatus.human_review_required
            stats["human_review_required"] += 1
        else:
            final_status = VerificationStatus.verified

        stats["passed_all_gates"] += 1

        source_ref_id = str(candidate.cited_fact_code or candidate.cited_guideline_code or "GUIDE-01")
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
                verification_status=final_status,
                confidence=confidence,
                source=str(raw.get("source", "rules")),
                source_ref_id=source_ref_id,
                start=start,
                end=end,
                paragraph_ref="p-1",
                verification_trace=trace,
            )
        )

    # Overlapping findings deduplication with trace note
    deduped: List[VerifiedFinding] = []
    seen_excerpts = set()

    for vf in verified:
        clean_exc = vf.exact_excerpt.lower().strip()
        if clean_exc not in seen_excerpts:
            seen_excerpts.add(clean_exc)
            deduped.append(vf)
        else:
            # Note merge in existing finding's trace
            for existing in deduped:
                if existing.exact_excerpt.lower().strip() == clean_exc:
                    existing.verification_trace.append({
                        "gate": 0,
                        "name": "Deduplication Merge",
                        "result": "passed",
                        "message": f"Merged duplicate finding for '{clean_exc}'",
                        "evidence": "Merged",
                    })
                    break

    stats["dropped_candidates"] = dropped
    return deduped, stats
