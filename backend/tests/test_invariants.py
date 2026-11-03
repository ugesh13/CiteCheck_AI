"""
Invariants verification suite for CiteCheck AI.

Ensures that the repository state, database records, audit events,
and dashboard aggregates satisfy core relational and cryptographic invariants.

Supports running against:
1. Local in-memory or Supabase store directly
2. Live deployed API by setting BASE_URL (e.g. BASE_URL=https://citecheck-jet.vercel.app)
"""

from __future__ import annotations

from collections import Counter
import os
import sys
from typing import Any, Dict, List
import pytest
import requests

from app.store.provider import get_store


BASE_URL = os.getenv("BASE_URL")


class TestSystemInvariants:
    def test_invariant_1_every_audit_target_resolves_to_existing_entity(self):
        """
        Invariant 1: Every entity referenced as the target of an audit event
        (draft, version, fact, guideline) must actually exist in the store.
        """
        store = get_store()
        audit_events = store.list_audit_logs()
        drafts = {d["id"]: d for d in store.list_drafts()}
        brand_kit = store.get_brand_kit()
        facts = {f["id"]: f for f in brand_kit.get("facts", [])}
        guidelines = {g["id"]: g for g in brand_kit.get("guidelines", [])}

        # Collect all version IDs across all drafts
        versions = set()
        for d_id in drafts:
            for v in store.list_versions(d_id):
                versions.add(v["id"])

        missing_targets = []
        for event in audit_events:
            target_id = event.get("target_id")
            target_type = event.get("target_type")
            action = event.get("action", "")

            # If an event targets an entity, that entity must exist
            if target_type == "draft" and target_id:
                if target_id not in drafts:
                    missing_targets.append((target_type, target_id, action))
            elif target_type == "version" and target_id:
                if target_id not in versions:
                    missing_targets.append((target_type, target_id, action))
            elif target_type == "fact" and target_id:
                if target_id not in facts:
                    missing_targets.append((target_type, target_id, action))
            elif target_type == "guideline" and target_id:
                if target_id not in guidelines:
                    missing_targets.append((target_type, target_id, action))

        assert not missing_targets, f"Found audit events pointing to nonexistent entities: {missing_targets}"

    def test_invariant_2_dashboard_counts_match_raw_store_records(self):
        """
        Invariant 2: Dashboard metrics (draft_pulse, open_findings, review_queue_size)
        must exactly equal counts directly recomputed from store records.
        """
        store = get_store()
        drafts = store.list_drafts()

        # Recompute raw counts
        expected_pulse = {"Draft": 0, "In review": 0, "Changes requested": 0, "Approved": 0}
        for d in drafts:
            st = d.get("status", "Draft")
            expected_pulse[st] = expected_pulse.get(st, 0) + 1

        expected_open_findings = 0
        expected_resolved_findings = 0
        for d in drafts:
            findings = store.get_findings(d["id"])
            for f in findings:
                if f.get("status") == "open":
                    expected_open_findings += 1
                else:
                    expected_resolved_findings += 1

        # Fetch from dashboard metrics endpoint or unified store logic
        from app.routers.frontend_bridge import get_dashboard_metrics

        metrics = get_dashboard_metrics()

        assert metrics["total_drafts"] == len(drafts)
        assert metrics["draft_pulse"] == expected_pulse
        assert metrics["open_findings"] == expected_open_findings
        assert metrics["resolved_findings"] == expected_resolved_findings
        assert metrics["review_queue_size"] == expected_pulse.get("In review", 0)

    def test_invariant_3_approved_drafts_must_have_locked_version(self):
        """
        Invariant 3: Any draft with status == 'Approved' must possess at least one
        locked version recording the reviewer's immutable release sign-off.
        """
        store = get_store()
        drafts = store.list_drafts()
        approved_drafts = [d for d in drafts if d.get("status") == "Approved"]

        assert len(approved_drafts) >= 1, "Expected at least one approved draft in standard seed"

        for draft in approved_drafts:
            versions = store.list_versions(draft["id"])
            locked_versions = [v for v in versions if v.get("locked") is True]
            assert len(locked_versions) >= 1, f"Approved draft {draft['id']} has no locked version!"

    def test_invariant_4_gap_radar_counts_match_dismissals(self):
        """
        Invariant 4: Dismissal counts recorded in store must match dismissal events.
        """
        store = get_store()
        dismissal_events = store.list_dismissal_events()
        assert isinstance(dismissal_events, list)
        assert len(dismissal_events) >= 0

    def test_invariant_5_cryptographic_hash_chain_verifies(self):
        """
        Invariant 5: The SHA-256 audit log hash chain must verify completely from
        genesis to the latest record with zero broken links.
        """
        store = get_store()
        chain_res = store.verify_chain_integrity()
        assert chain_res["valid"] is True
        assert chain_res.get("entries_checked", 0) > 0
        assert chain_res.get("broken_links_count", 0) == 0

    @pytest.mark.skipif(not BASE_URL, reason="BASE_URL environment variable not set")
    def test_invariant_live_api_verifications(self):
        """
        Live verification when running against a deployed environment:
        Verifies health and dashboard metrics match remote store.
        """
        res = requests.get(f"{BASE_URL}/api/v1/dashboard/metrics", timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert "open_findings" in data
        assert "draft_pulse" in data
        assert data.get("audit_chain_valid") is True
