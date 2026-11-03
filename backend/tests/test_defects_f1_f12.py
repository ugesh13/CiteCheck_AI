"""
Baseline Reproduction Tests for Defects F1–F12.
These tests assert the correct invariants and expected behaviors.
Any test asserting an invariant that is currently violated will FAIL,
demonstrating the defect before we fix it.
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store.provider import get_store
from uuid import UUID
from app.core.security import create_access_token

client = TestClient(app)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_f1_audit_actor_never_falls_back_to_hardcoded_meera():
    """F1: Audit actor must come from authenticated identity, never falling back to hardcoded 'Meera Nair'."""
    # When user is custom user 'Harsha Das'
    token = create_access_token(
        user_id=UUID("44444444-4444-4444-4444-444444444444"),
        role="creator",
        name="Harsha Das",
        email="harsha@example.com",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/api/v1/findings/F-101/decision",
        json={"action": "accept", "reason": "Verified accurate"},
        headers=headers,
    )
    assert resp.status_code == 200

    # Also check: line 545 and 720 of frontend_bridge have fallback "Meera Nair"
    # An unauthenticated or invalid session should reject with 401, NOT silently log as "Meera Nair"!
    unauth_resp = client.post(
        "/api/v1/findings/F-101/decision",
        json={"action": "accept", "reason": "No token"},
    )
    assert unauth_resp.status_code == 401, f"Expected 401 Unauthorized for missing token, got {unauth_resp.status_code}"


def test_f2_dashboard_open_findings_counts_only_open_status():
    """F2: Open findings count must only count status == 'open', excluding resolved/accepted/dismissed."""
    store = get_store()
    drafts = store.list_drafts()
    all_findings = []
    for d in drafts:
        all_findings.extend(store.get_findings(d["id"]))

    open_count = sum(1 for f in all_findings if f.get("status") == "open")
    total_count = sum(d.get("findings_count", 0) for d in drafts)

    # In current seeded state, total_count is 5 (including resolved F-101), but open_count < 5.
    # The dashboard bug was displaying total_count (5) under the label 'Open findings'.
    assert open_count != total_count, "Seeded test data should have resolved findings so open != total"
    assert open_count == 4, f"Expected 4 open findings, got {open_count}"


def test_f3_audit_seed_targets_must_all_exist():
    """F3: Every audit target in the seed must correspond to a draft/fact/entity that actually exists."""
    store = get_store()
    drafts = {d["title"]: d for d in store.list_drafts()}
    brand_kit = store.get_brand_kit()
    fact_ids = {f["id"] for f in brand_kit.get("facts", [])}

    logs = store.list_audit_logs()
    missing_targets = []
    for entry in logs:
        target = entry.get("target", "")
        # Check draft targets
        if ".md" in target:
            draft_name = target.split(" · ")[0].strip()
            if draft_name not in drafts:
                missing_targets.append((entry["id"], target, "Draft not found in store"))
        # Check fact targets
        elif "FACT-" in target:
            fact_code = [p for p in target.split(" · ") if p.startswith("FACT-")]
            if fact_code and fact_code[0] not in fact_ids:
                missing_targets.append((entry["id"], target, "Fact not found in Brand Kit"))

    assert not missing_targets, f"Found audit entries pointing to non-existent entities: {missing_targets}"


def test_f7_documented_files_and_license_must_exist():
    """F7: Files cited in README.md / ROUND3_DELIVERY.md and LICENSE must exist."""
    required_files = [
        "LICENSE",
        "backend/tests/test_verifier.py",
        "backend/tests/test_phase1_store_roles.py",
        "backend/app/store/repository.py",
        "backend/app/store/supabase.py",
        "backend/app/store/memory.py",
    ]
    missing = [f for f in required_files if not (REPO_ROOT / f).exists()]
    assert not missing, f"Missing files cited in docs: {missing}"

    # Also check non-existent legacy references that must be removed from docs
    bad_refs = [
        "backend/tests/test_verifier_gates.py",
        "backend/tests/test_role_enforcement.py",
        "store/supabase_store.py",
        "store/memory_store.py",
        "pages/review-room.tsx",
    ]
    readme_text = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    found_bad_refs = [ref for ref in bad_refs if ref in readme_text]
    assert not found_bad_refs, f"README.md contains dead file paths: {found_bad_refs}"


def test_f8_verification_trace_does_not_hardcode_expired_fact_ids():
    """F8: verification-trace.tsx must not hardcode 'FACT-03' or 'FACT-11' as expired."""
    trace_file = REPO_ROOT / "Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/src/components/verification-trace.tsx"
    content = trace_file.read_text(encoding="utf-8")
    assert "FACT-03" not in content, "verification-trace.tsx still hard-codes FACT-03"
    assert "FACT-11" not in content, "verification-trace.tsx still hard-codes FACT-11"


def test_f9_benchmark_eval_must_include_gate_drop_cases():
    """F9: Evaluation dataset must contain cases that fail gates, so drops are > 0."""
    import json
    dataset_path = REPO_ROOT / "backend/eval/dataset.jsonl"
    with open(dataset_path, "r", encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip()]

    # At least some benchmark cases should test dropped candidates (e.g. invalid quote, missing fact)
    drop_cases = [c for c in cases if c.get("expected_drops", 0) > 0 or len(c.get("expected_dropped_gates", [])) > 0]
    assert len(drop_cases) > 0, "Self-authored dataset only has positive cases with 0 gate drops"


def test_f11_no_hardcoded_meera_in_endpoints_and_no_replit_files():
    """F11: endpoints.ts must not hard-code 'Meera Nair' as a fallback author, and replit artifacts must not exist."""
    endpoints_file = REPO_ROOT / "Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/src/lib/api/endpoints.ts"
    content = endpoints_file.read_text(encoding="utf-8")
    assert "Meera Nair" not in content, "endpoints.ts still hard-codes 'Meera Nair' fallback"

    # Check for leftover replit files
    replit_files = [
        REPO_ROOT / "Frontend/Glassmorphic-Frontend-Builder/.replitignore",
        REPO_ROOT / "Frontend/Glassmorphic-Frontend-Builder/.replit",
        REPO_ROOT / "Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/.replit-artifact",
    ]
    existing_replit = [str(p) for p in replit_files if p.exists()]
    assert not existing_replit, f"Found leftover Replit files: {existing_replit}"
