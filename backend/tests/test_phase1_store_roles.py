"""
CiteCheck AI — Phase 1 Test Suite: Store Repository, Identity, Roles & Tamper Evidence.

Validates:
1. Store Repository layer (MemoryStore and BaseStore interface).
2. Dynamic relative-to-today date seeding.
3. Server-side role-based access control (RBAC): 403 Forbidden vs 200 OK.
4. Tamper-evident audit log SHA-256 hash chaining and tamper detection.
5. Fact expiry governance (computed status, renewal, archiving).
6. GET /api/v1/health contract reporting store backend, LLM status, version, commit.
"""

from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from fastapi.testclient import TestClient
import pytest

from app.core.security import DEMO_PERSONAS, create_access_token
from app.main import app
from app.store.memory import MemoryStore, compute_fact_status
from app.store.provider import get_store, get_store_backend_name, set_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_store():
    """Ensure a clean in-memory store instance for each test."""
    store = MemoryStore()
    set_store(store, "memory")
    yield store


def make_auth_header(role: str) -> dict[str, str]:
    persona = DEMO_PERSONAS[role]
    token = create_access_token(
        user_id=persona["id"],
        role=role,
        name=persona["name"],
        email=persona["email"],
    )
    return {"Authorization": f"Bearer {token}"}


class TestStoreRepositoryBasics:
    def test_store_seeding_and_relative_dates(self, isolate_store):
        today = datetime.now(timezone.utc).date()
        health = isolate_store.get_facts_health()

        assert health["total"] == 15
        assert health["expired"] >= 2
        assert health["expiring_7"] >= 1
        assert health["expiring_30"] >= 2
        assert health["active"] >= 10

        # Check relative dates
        fact_11 = isolate_store.get_fact_by_id("FACT-11")
        assert fact_11 is not None
        assert fact_11["computed_status"] == "Expired"
        exp_date_11 = date.fromisoformat(fact_11["expires_on"][:10])
        assert exp_date_11 == today - timedelta(days=4)

        fact_14 = isolate_store.get_fact_by_id("FACT-14")
        assert fact_14 is not None
        assert fact_14["computed_status"] == "Expiring (≤7d)"
        exp_date_14 = date.fromisoformat(fact_14["expires_on"][:10])
        assert exp_date_14 == today + timedelta(days=7)

    def test_fact_renewal_workflow(self, isolate_store):
        today = datetime.now(timezone.utc).date()
        new_date = (today + timedelta(days=180)).isoformat()

        updated = isolate_store.renew_fact(
            fact_id="FACT-11",
            new_expires_on=new_date,
            reason="Q4 Promotional budget renewed by executive committee",
            actor="Arjun Mehta",
        )
        assert updated["expires_on"] == new_date
        assert updated["renewal_count"] == 1

        fact = isolate_store.get_fact_by_id("FACT-11")
        assert fact["computed_status"] == "Active"

        history = isolate_store.get_fact_history("FACT-11")
        assert len(history) == 1
        assert history[0]["action"] == "renewed"
        assert history[0]["actor"] == "Arjun Mehta"


class TestAuditHashChainTamperEvidence:
    def test_chain_integrity_on_clean_store(self, isolate_store):
        res = isolate_store.verify_chain_integrity()
        assert res["valid"] is True
        assert res["entries_checked"] >= 6
        assert "Cryptographic integrity verified" in res["message"]

    def test_tamper_detection_when_audit_entry_altered(self, isolate_store):
        # Alter an audit record directly inside internal store
        assert len(isolate_store._audit) > 0
        isolate_store._audit[1]["details"] = "TAMPERED DETAILS NOT IN HASH"

        res = isolate_store.verify_chain_integrity()
        assert res["valid"] is False
        assert "Content tampering detected" in res["reason"]
        assert res["tampered_entry_id"] == isolate_store._audit[1]["id"]


class TestRoleBasedAccessControl:
    def test_creator_cannot_approve_draft(self):
        resp = client.post(
            "/api/v1/drafts/draft-1/approve",
            headers=make_auth_header("creator"),
        )
        assert resp.status_code == 403
        assert "requires the 'reviewer' role" in resp.json()["detail"]

    def test_creator_cannot_create_facts(self):
        resp = client.post(
            "/api/v1/facts",
            json={"statement": "Unauthorized fact", "source_document": "None"},
            headers=make_auth_header("creator"),
        )
        assert resp.status_code == 403
        assert "requires the 'brand_manager' role" in resp.json()["detail"]

    def test_reviewer_cannot_create_guidelines(self):
        resp = client.post(
            "/api/v1/guidelines",
            json={"title": "Unauthorized rule", "rule_description": "None"},
            headers=make_auth_header("reviewer"),
        )
        assert resp.status_code == 403
        assert "requires the 'brand_manager' role" in resp.json()["detail"]

    def test_brand_manager_can_renew_fact(self):
        today = datetime.now(timezone.utc).date()
        resp = client.post(
            "/api/v1/facts/FACT-11/renew",
            json={
                "new_expires_on": (today + timedelta(days=90)).isoformat(),
                "reason": "Executive renewal approval signed off",
            },
            headers=make_auth_header("brand_manager"),
        )
        assert resp.status_code == 200
        assert resp.json()["renewal_count"] == 1

    def test_reviewer_can_request_changes(self):
        resp = client.post(
            "/api/v1/drafts/draft-1/request-changes",
            json={"reason": "Please fix tone and remove superlative"},
            headers=make_auth_header("reviewer"),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "Changes requested"


class TestHealthAndSystemStatus:
    def test_health_reports_store_and_llm_status(self):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["store_backend"] in ("memory", "supabase")
        assert data["llm_status"] in ("configured", "not_configured")
        assert "CiteCheck blocks unsupported AI claims" in data["product_line"]
        assert len(data["commit"]) > 0

    def test_demo_reset_endpoint(self):
        resp = client.post(
            "/api/v1/demo/reset",
            headers=make_auth_header("brand_manager"),
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
