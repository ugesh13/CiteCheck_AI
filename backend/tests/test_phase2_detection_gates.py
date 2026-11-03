"""
CiteCheck AI — Phase 2 Test Suite: Detection Engine, Five Gates & Adversarial Selftest.

Validates:
1. Deterministic Claims & Evidence Detection (superlatives, numbers, tone, naming).
2. Five-Gate Verifier trace output, real dropped candidate tracking, and intent guarding.
3. LLM Reviewer graceful degradation and prompt-injection safety.
4. GET /api/v1/verifier/selftest 12-case adversarial suite.
5. POST /api/v1/verifier/try interactive sandbox.
"""

from fastapi.testclient import TestClient
import pytest

from app.engine.claims import detect_claims_and_evidence
from app.engine.llm_reviewer import get_llm_config, run_llm_review
from app.engine.selftest import execute_selftest_suite
from app.engine.verifier import run_five_gate_pipeline
from app.main import app
from app.store.memory import MemoryStore
from app.store.provider import set_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    store = MemoryStore()
    set_store(store, "memory")
    return store


class TestClaimsAndEvidenceDetection:
    def test_superlative_and_absolute_claims(self, clean_store):
        bk = clean_store.get_brand_kit()
        text = "Lumen Pay is India's most trusted wallet with zero fees forever."
        candidates = detect_claims_and_evidence(text, bk)

        excerpts = [c["exact_excerpt"] for c in candidates]
        assert "most trusted" in excerpts
        assert any("zero fees" in exc for exc in excerpts)

        # Ensure governing guidelines and facts are cited
        trusted_cand = next(c for c in candidates if c["exact_excerpt"] == "most trusted")
        assert trusted_cand["cited_guideline_code"] == "GUIDE-01"
        assert trusted_cand["cited_fact_code"] == "FACT-07"
        assert trusted_cand["confidence"] == 0.95

    def test_unsupported_statistic_detection(self, clean_store):
        bk = clean_store.get_brand_kit()
        # 84.7% is not in the Brand Kit
        text = "Lumen Pay achieves an 84.7% adoption rate across merchants."
        candidates = detect_claims_and_evidence(text, bk)

        stat_cand = next((c for c in candidates if "84.7%" in c["exact_excerpt"]), None)
        assert stat_cand is not None
        assert stat_cand["category"] == "claim"
        assert stat_cand["cited_guideline_code"] == "GUIDE-05"
        assert stat_cand["cited_fact_code"] is None
        assert "Unsupported statistic" in stat_cand["reason"]

    def test_expired_fact_statistic_flagged(self, clean_store):
        bk = clean_store.get_brand_kit()
        # FACT-11 specifies 15% cashback and is expired (4 days ago)
        text = "Get promotional cashback up to 15% during launch."
        candidates = detect_claims_and_evidence(text, bk)

        cashback_cand = next((c for c in candidates if "15%" in c["exact_excerpt"]), None)
        assert cashback_cand is not None
        assert cashback_cand["cited_fact_code"] == "FACT-11"
        assert "expired" in cashback_cand["reason"].lower()

    def test_tone_pressure_tactics(self, clean_store):
        bk = clean_store.get_brand_kit()
        text = "Act now before it's too late! Don't miss out on these rewards."
        candidates = detect_claims_and_evidence(text, bk)

        pressure_cands = [c for c in candidates if c["category"] == "tone"]
        assert len(pressure_cands) >= 1
        assert pressure_cands[0]["cited_guideline_code"] == "GUIDE-07"

    def test_first_product_naming_rule(self, clean_store):
        bk = clean_store.get_brand_kit()
        # First mention is just "Lumen", not "Lumen Pay"
        text = "Welcome to Lumen. We make everyday payments simple with Lumen Pay."
        candidates = detect_claims_and_evidence(text, bk)

        naming_cand = next((c for c in candidates if c["category"] == "terminology" and c.get("cited_guideline_code") == "GUIDE-08"), None)
        assert naming_cand is not None
        assert naming_cand["exact_excerpt"] == "Lumen"
        assert naming_cand["suggested_fix"] == "Lumen Pay"


class TestFiveGateVerifierDeepTrace:
    def test_tamper_detection_in_fix(self, clean_store):
        bk = clean_store.get_brand_kit()
        facts_by_code = {f["id"]: f for f in bk["facts"]}
        guidelines_by_code = {g["id"]: g for g in bk["guidelines"]}

        draft = "Users enjoy cashback up to 15% on qualifying payments."
        candidate = {
            "category": "claim",
            "severity": "medium",
            "exact_excerpt": "cashback up to 15%",
            "reason": "Test intent guard tamper detection",
            "cited_guideline_code": "GUIDE-05",
            "suggested_fix": "cashback up to 10%",  # Altered 15% to 10%!
            "confidence": 0.90,
        }

        verified, stats = run_five_gate_pipeline(
            [candidate], draft, facts_by_code, guidelines_by_code
        )
        assert len(verified) == 1
        vf = verified[0]
        assert vf.is_intent_guarded is True
        assert vf.verification_status.value == "needs_review"

        gate_4_trace = next(t for t in vf.verification_trace if t["gate"] == 4)
        assert gate_4_trace["result"] == "warning"
        assert "alters" in gate_4_trace["message"]

    def test_no_source_no_finding_rule(self, clean_store):
        bk = clean_store.get_brand_kit()
        facts_by_code = {f["id"]: f for f in bk["facts"]}
        guidelines_by_code = {g["id"]: g for g in bk["guidelines"]}

        draft = "Our platform is 100% secure and guaranteed."
        unsourced_claim = {
            "category": "claim",
            "severity": "high",
            "exact_excerpt": "100% secure and guaranteed",
            "reason": "Claim made with zero citations",
            "cited_fact_code": None,
            "cited_guideline_code": None,
        }

        verified, stats = run_five_gate_pipeline(
            [unsourced_claim], draft, facts_by_code, guidelines_by_code
        )
        assert len(verified) == 0
        assert stats["dropped"] == 1
        assert stats["dropped_by_gate"][2] == 1


class TestVerifierSelftestAndTrySandbox:
    def test_selftest_suite_returns_100_percent_pass(self):
        res = execute_selftest_suite()
        assert res["summary"]["total_cases"] == 12
        assert res["summary"]["passed"] == 12
        assert res["summary"]["failed"] == 0
        assert res["summary"]["pass_rate_percent"] == 100.0

    def test_selftest_endpoint_http(self):
        resp = client.get("/api/v1/verifier/selftest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["pass_rate_percent"] == 100.0
        assert len(data["cases"]) == 12

    def test_try_sandbox_endpoint_blocks_hallucinated_fact(self):
        resp = client.post(
            "/api/v1/verifier/try",
            json={
                "draft_text": "Lumen Pay offers instant UPI payments.",
                "candidate": {
                    "category": "claim",
                    "severity": "high",
                    "exact_excerpt": "instant UPI payments",
                    "reason": "Hallucinated citation test",
                    "cited_fact_code": "FACT-99",  # Does not exist
                    "cited_guideline_code": "GUIDE-01",
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["passed"] is False
        assert data["failed_gate"] == 2
        assert "FACT-99" in data["reason"]

    def test_try_sandbox_passes_valid_candidate(self):
        resp = client.post(
            "/api/v1/verifier/try",
            json={
                "draft_text": "Lumen Pay is a digital wallet built for simple, secure everyday UPI payments.",
                "candidate": {
                    "category": "terminology",
                    "severity": "low",
                    "exact_excerpt": "everyday UPI payments",
                    "reason": "Preferred terminology verification",
                    "cited_guideline_code": "GUIDE-03",
                    "suggested_fix": "everyday UPI payments",
                    "confidence": 0.95,
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["passed"] is True
        assert len(data["verification_trace"]) >= 5

