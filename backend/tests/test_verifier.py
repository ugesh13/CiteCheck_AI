"""
CiteCheck AI — Tests for the 5-Gate Evidence Verifier.

These are pure-unit tests that do NOT require a Supabase connection.
Each gate function is tested in isolation, plus an integration test of
the full pipeline.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.engine.verifier import (
    GateResult,
    VerifiedFinding,
    gate_1_schema_validation,
    gate_2_reference_verification,
    gate_3_excerpt_presence,
    gate_4_intent_preservation,
    gate_5_fact_freshness,
    run_five_gate_pipeline,
)
from app.schemas import CandidateFinding, FindingCategory, FindingSeverity


# ─── Fixtures ─────────────────────────────────────────────────────────────────

SAMPLE_DRAFT_TEXT = (
    "Our Governance Platform guarantees 100% uptime and uses our AI Guardrail "
    "technology to ensure zero errors. Acme Cloud platform achieves 99.9% "
    "measured availability."
)

FACTS_BY_CODE = {
    "FACT-12": {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "fact_code": "FACT-12",
        "statement": "CiteCheck AI assists teams in catching compliance issues.",
        "source_document": "Q3 Brand Policy Doc v2",
        "review_date": "2026-12-31",
    },
    "FACT-15": {
        "id": "ffffffff-1111-2222-3333-444444444444",
        "fact_code": "FACT-15",
        "statement": "Acme Cloud platform achieves 99.9% measured availability.",
        "source_document": "2025 Infrastructure Audit",
        "review_date": "2025-01-01",  # Stale!
    },
}

GUIDELINES_BY_CODE = {
    "GUIDE-01": {
        "id": "11111111-2222-3333-4444-555555555555",
        "guideline_code": "GUIDE-01",
        "category": "tone",
        "title": "No Absolute Guarantees",
    },
    "GUIDE-02": {
        "id": "22222222-3333-4444-5555-666666666666",
        "guideline_code": "GUIDE-02",
        "category": "accessibility",
        "title": "Plain Language Requirement",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# Gate 1 Tests — Schema Validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestGate1SchemaValidation:
    """Gate 1: Pydantic schema validation of candidate findings."""

    def test_valid_candidate_passes(self):
        raw = {
            "category": "tone",
            "severity": "high",
            "exact_excerpt": "guarantees 100% uptime",
            "reason": "Absolute guarantee violates brand guidelines",
        }
        result, candidate = gate_1_schema_validation(raw)
        assert result.passed is True
        assert candidate is not None
        assert candidate.category == FindingCategory.tone

    def test_missing_required_field_fails(self):
        raw = {
            "category": "tone",
            "severity": "high",
            # missing exact_excerpt and reason
        }
        result, candidate = gate_1_schema_validation(raw)
        assert result.passed is False
        assert candidate is None

    def test_invalid_enum_value_fails(self):
        raw = {
            "category": "nonexistent_category",
            "severity": "high",
            "exact_excerpt": "some text",
            "reason": "some reason",
        }
        result, candidate = gate_1_schema_validation(raw)
        assert result.passed is False

    def test_empty_excerpt_fails(self):
        raw = {
            "category": "claim",
            "severity": "low",
            "exact_excerpt": "",
            "reason": "test",
        }
        result, candidate = gate_1_schema_validation(raw)
        assert result.passed is False

    def test_optional_fields_accepted(self):
        raw = {
            "category": "terminology",
            "severity": "medium",
            "exact_excerpt": "AI Guardrail",
            "reason": "Forbidden term",
            "cited_guideline_code": "GUIDE-01",
            "suggested_fix": "Governance Platform",
        }
        result, candidate = gate_1_schema_validation(raw)
        assert result.passed is True
        assert candidate.cited_guideline_code == "GUIDE-01"
        assert candidate.suggested_fix == "Governance Platform"


# ═══════════════════════════════════════════════════════════════════════════════
# Gate 2 Tests — Reference Verification
# ═══════════════════════════════════════════════════════════════════════════════


class TestGate2ReferenceVerification:
    """Gate 2: Verify cited fact/guideline codes exist in the database."""

    def test_valid_fact_code_passes(self):
        candidate = CandidateFinding(
            category="claim", severity="medium",
            exact_excerpt="some text", reason="test",
            cited_fact_code="FACT-12",
        )
        result, fact_id, guide_id = gate_2_reference_verification(
            candidate, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert result.passed is True
        assert str(fact_id) == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        assert guide_id is None

    def test_valid_guideline_code_passes(self):
        candidate = CandidateFinding(
            category="tone", severity="high",
            exact_excerpt="some text", reason="test",
            cited_guideline_code="GUIDE-01",
        )
        result, fact_id, guide_id = gate_2_reference_verification(
            candidate, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert result.passed is True
        assert fact_id is None
        assert str(guide_id) == "11111111-2222-3333-4444-555555555555"

    def test_nonexistent_fact_code_fails(self):
        candidate = CandidateFinding(
            category="claim", severity="low",
            exact_excerpt="text", reason="reason",
            cited_fact_code="FACT-DOES-NOT-EXIST",
        )
        result, _, _ = gate_2_reference_verification(
            candidate, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert result.passed is False
        assert "not found" in result.message

    def test_nonexistent_guideline_code_fails(self):
        candidate = CandidateFinding(
            category="tone", severity="medium",
            exact_excerpt="text", reason="reason",
            cited_guideline_code="GUIDE-MISSING",
        )
        result, _, _ = gate_2_reference_verification(
            candidate, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert result.passed is False

    def test_no_citations_passes(self):
        candidate = CandidateFinding(
            category="formatting", severity="low",
            exact_excerpt="text", reason="reason",
        )
        result, fact_id, guide_id = gate_2_reference_verification(
            candidate, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert result.passed is True
        assert fact_id is None
        assert guide_id is None


# ═══════════════════════════════════════════════════════════════════════════════
# Gate 3 Tests — Excerpt Presence
# ═══════════════════════════════════════════════════════════════════════════════


class TestGate3ExcerptPresence:
    """Gate 3: Verify the exact excerpt exists in the draft text."""

    def test_present_excerpt_passes(self):
        candidate = CandidateFinding(
            category="tone", severity="high",
            exact_excerpt="guarantees 100% uptime",
            reason="test",
        )
        result = gate_3_excerpt_presence(candidate, SAMPLE_DRAFT_TEXT)
        assert result.passed is True

    def test_missing_excerpt_fails(self):
        candidate = CandidateFinding(
            category="tone", severity="high",
            exact_excerpt="this text is not in the draft",
            reason="test",
        )
        result = gate_3_excerpt_presence(candidate, SAMPLE_DRAFT_TEXT)
        assert result.passed is False
        assert "not found" in result.message

    def test_case_sensitive_match(self):
        candidate = CandidateFinding(
            category="tone", severity="high",
            exact_excerpt="GUARANTEES 100% UPTIME",  # wrong case
            reason="test",
        )
        result = gate_3_excerpt_presence(candidate, SAMPLE_DRAFT_TEXT)
        assert result.passed is False

    def test_partial_match_passes(self):
        candidate = CandidateFinding(
            category="claim", severity="medium",
            exact_excerpt="99.9%",
            reason="test",
        )
        result = gate_3_excerpt_presence(candidate, SAMPLE_DRAFT_TEXT)
        assert result.passed is True


# ═══════════════════════════════════════════════════════════════════════════════
# Gate 4 Tests — Intent Preservation
# ═══════════════════════════════════════════════════════════════════════════════


class TestGate4IntentPreservation:
    """Gate 4: Detect numeric/date changes between excerpt and suggested fix."""

    def test_no_fix_passes_without_guard(self):
        candidate = CandidateFinding(
            category="tone", severity="high",
            exact_excerpt="guarantees 100% uptime",
            reason="test",
        )
        result, guarded = gate_4_intent_preservation(candidate)
        assert result.passed is True
        assert guarded is False

    def test_same_numbers_not_guarded(self):
        candidate = CandidateFinding(
            category="claim", severity="medium",
            exact_excerpt="achieves 99.9% availability",
            reason="test",
            suggested_fix="reaches 99.9% availability",
        )
        result, guarded = gate_4_intent_preservation(candidate)
        assert result.passed is True
        assert guarded is False

    def test_different_numbers_triggers_guard(self):
        candidate = CandidateFinding(
            category="claim", severity="medium",
            exact_excerpt="guarantees 100% uptime",
            reason="test",
            suggested_fix="targets 99.9% uptime",
        )
        result, guarded = gate_4_intent_preservation(candidate)
        assert result.passed is True  # Still passes, just guarded
        assert guarded is True

    def test_no_numbers_not_guarded(self):
        candidate = CandidateFinding(
            category="terminology", severity="low",
            exact_excerpt="AI Guardrail",
            reason="test",
            suggested_fix="Governance Platform",
        )
        result, guarded = gate_4_intent_preservation(candidate)
        assert result.passed is True
        assert guarded is False


# ═══════════════════════════════════════════════════════════════════════════════
# Gate 5 Tests — Fact Freshness
# ═══════════════════════════════════════════════════════════════════════════════


class TestGate5FactFreshness:
    """Gate 5: Escalate if cited fact's review_date is in the past."""

    def test_stale_fact_escalates_severity(self):
        candidate = CandidateFinding(
            category="claim", severity="low",
            exact_excerpt="test", reason="test",
            cited_fact_code="FACT-15",  # review_date = 2025-01-01 (stale)
        )
        result, severity, extra = gate_5_fact_freshness(
            candidate, FACTS_BY_CODE, FindingSeverity.low
        )
        assert result.passed is True
        assert severity == FindingSeverity.high
        assert "re-verify" in extra.lower()

    def test_fresh_fact_keeps_severity(self):
        candidate = CandidateFinding(
            category="claim", severity="medium",
            exact_excerpt="test", reason="test",
            cited_fact_code="FACT-12",  # review_date = 2026-12-31 (future)
        )
        result, severity, extra = gate_5_fact_freshness(
            candidate, FACTS_BY_CODE, FindingSeverity.medium
        )
        assert result.passed is True
        assert severity == FindingSeverity.medium
        assert extra == ""

    def test_no_fact_code_passes(self):
        candidate = CandidateFinding(
            category="tone", severity="low",
            exact_excerpt="test", reason="test",
        )
        result, severity, extra = gate_5_fact_freshness(
            candidate, FACTS_BY_CODE, FindingSeverity.low
        )
        assert result.passed is True
        assert severity == FindingSeverity.low


# ═══════════════════════════════════════════════════════════════════════════════
# Full Pipeline Integration Test
# ═══════════════════════════════════════════════════════════════════════════════


class TestFullPipeline:
    """End-to-end test of the run_five_gate_pipeline function."""

    def test_valid_candidate_passes_all_gates(self):
        raw_candidates = [
            {
                "category": "tone",
                "severity": "medium",
                "exact_excerpt": "guarantees 100% uptime",
                "reason": "Absolute guarantee violates tone guidelines",
                "cited_guideline_code": "GUIDE-01",
                "suggested_fix": "targets high uptime",
            }
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["total_candidates"] == 1
        assert stats["passed_all_gates"] == 1
        assert stats["dropped"] == 0
        assert len(verified) == 1
        # The fix changed "100%" to no number → intent guard triggers
        assert verified[0].is_intent_guarded is True

    def test_invalid_schema_is_dropped(self):
        raw_candidates = [
            {"category": "INVALID", "severity": "high"}  # bad schema
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["dropped"] == 1
        assert len(verified) == 0

    def test_missing_excerpt_is_dropped(self):
        raw_candidates = [
            {
                "category": "claim",
                "severity": "low",
                "exact_excerpt": "text not in draft at all",
                "reason": "some reason",
            }
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["dropped"] == 1
        assert len(verified) == 0

    def test_bad_fact_reference_is_dropped(self):
        raw_candidates = [
            {
                "category": "claim",
                "severity": "medium",
                "exact_excerpt": "99.9%",
                "reason": "Checking claim",
                "cited_fact_code": "FACT-NONEXISTENT",
            }
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["dropped"] == 1

    def test_stale_fact_escalates_in_pipeline(self):
        raw_candidates = [
            {
                "category": "claim",
                "severity": "low",
                "exact_excerpt": "99.9%",
                "reason": "Availability claim needs verification",
                "cited_fact_code": "FACT-15",  # stale
            }
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["passed_all_gates"] == 1
        assert verified[0].severity == FindingSeverity.high
        assert "re-verify" in verified[0].reason.lower()

    def test_multiple_candidates_mixed(self):
        raw_candidates = [
            # Good candidate
            {
                "category": "terminology",
                "severity": "medium",
                "exact_excerpt": "AI Guardrail",
                "reason": "Forbidden term",
                "suggested_fix": "Governance Platform",
            },
            # Bad schema
            {"bad": "data"},
            # Missing excerpt
            {
                "category": "tone",
                "severity": "high",
                "exact_excerpt": "this does not exist in the draft",
                "reason": "test",
            },
        ]
        verified, stats = run_five_gate_pipeline(
            raw_candidates, SAMPLE_DRAFT_TEXT, FACTS_BY_CODE, GUIDELINES_BY_CODE
        )
        assert stats["total_candidates"] == 3
        assert stats["passed_all_gates"] == 1
        assert stats["dropped"] == 2
        assert len(verified) == 1
        assert verified[0].exact_excerpt == "AI Guardrail"


# ═══════════════════════════════════════════════════════════════════════════════
# Rules Engine Tests
# ═══════════════════════════════════════════════════════════════════════════════

from app.engine.rules import check_forbidden_terms, check_readability, run_rules_engine


class TestForbiddenTermChecker:
    """Tests for the deterministic forbidden-term scanner."""

    def test_detects_forbidden_term(self):
        terms = [{
            "preferred_term": "Governance Platform",
            "forbidden_terms": ["AI Guardrail"],
            "usage_note": "Use official name.",
        }]
        results = check_forbidden_terms(SAMPLE_DRAFT_TEXT, terms)
        assert len(results) >= 1
        assert results[0]["category"] == "terminology"
        assert "Governance Platform" in results[0]["reason"]

    def test_no_match_returns_empty(self):
        terms = [{
            "preferred_term": "Widget",
            "forbidden_terms": ["Thingamajig"],
            "usage_note": "",
        }]
        results = check_forbidden_terms(SAMPLE_DRAFT_TEXT, terms)
        assert len(results) == 0

    def test_case_insensitive_match(self):
        terms = [{
            "preferred_term": "Governance Platform",
            "forbidden_terms": ["ai guardrail"],
            "usage_note": "",
        }]
        results = check_forbidden_terms(SAMPLE_DRAFT_TEXT, terms)
        assert len(results) >= 1


class TestReadabilityChecker:
    """Tests for the sentence-length readability scanner."""

    def test_long_sentence_flagged(self):
        long_text = " ".join(["word"] * 50) + "."
        results = check_readability(long_text, max_words_per_sentence=40)
        assert len(results) == 1
        assert results[0]["category"] == "accessibility"

    def test_short_sentence_passes(self):
        short_text = "This is fine."
        results = check_readability(short_text, max_words_per_sentence=40)
        assert len(results) == 0

    def test_guideline_code_attached(self):
        long_text = " ".join(["word"] * 50) + "."
        results = check_readability(long_text, guideline_code="GUIDE-02")
        assert results[0]["cited_guideline_code"] == "GUIDE-02"
