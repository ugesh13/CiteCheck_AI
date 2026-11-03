"""
Tests for Guideline Gap Radar dynamic computation, dismissal events, and Brand Manager remediation.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import DEMO_PERSONAS, create_access_token
from app.store.memory import MemoryStore
from app.store.provider import get_store, set_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_store():
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


def test_get_gap_radar_dynamic_metrics():
    res = client.get("/api/v1/gap-radar")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) > 0

    # Ensure sorted by dismissal_rate descending
    rates = [item["dismissal_rate"] for item in items]
    assert rates == sorted(rates, reverse=True)

    # Check GUIDE-01 has Unclear Policy due to high seed dismissals
    guide_01 = next((item for item in items if item["guideline_id"] == "GUIDE-01"), None)
    assert guide_01 is not None
    assert guide_01["status"] == "Unclear Policy"
    assert guide_01["dismissed"] >= 5
    assert guide_01["dismissal_rate"] >= 50.0
    assert len(guide_01["reasons"]) > 0
    assert len(guide_01["events"]) >= 5
    assert "too broad" in guide_01["themes"]


def test_dismissal_increments_gap_radar():
    store = get_store()
    headers = make_auth_header("creator")

    # Post decision: dismiss finding
    payload = {
        "action": "dismiss",
        "reason": "Test dismiss: technical audit report exception",
        "dismissal_theme": "technical audience",
        "is_false_positive": True,
    }
    # Finding F-102 belongs to draft-1
    res = client.post("/api/v1/findings/F-102/decision", json=payload, headers=headers)
    assert res.status_code == 200

    # Gap radar reflects updated dismissal count
    updated_radar = client.get("/api/v1/gap-radar").json()
    events = store.list_dismissal_events()
    assert any(e.get("reason") == "Test dismiss: technical audit report exception" for e in events)


def test_gap_radar_action_role_enforcement():
    headers = make_auth_header("creator")

    # Creator tries to remediate rule -> 403 Forbidden
    payload = {
        "action": "edit_text",
        "new_text": "Updated rule text",
        "reason": "Clarified policy",
    }
    res = client.post("/api/v1/gap-radar/GUIDE-01/action", json=payload, headers=headers)
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"] or "Brand manager role required" in res.json()["detail"] or "action requires" in res.json()["detail"]


def test_gap_radar_brand_manager_remediation_actions():
    headers = make_auth_header("brand_manager")

    # 1. Exempt in Context
    exempt_payload = {
        "action": "exempt_context",
        "reason": "Permitted in partner joint announcements with partner approval",
        "details": "partner_briefs",
    }
    res = client.post("/api/v1/gap-radar/GUIDE-01/action", json=exempt_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "[Permitted Contexts & Exceptions]" in data["new_text"]

    # 2. Clarify Thresholds
    clarify_payload = {
        "action": "clarify_thresholds",
        "reason": "Bullet points exempt from maximum word count limit",
        "details": "bullet_lists",
    }
    res = client.post("/api/v1/gap-radar/GUIDE-01/action", json=clarify_payload, headers=headers)
    assert res.status_code == 200
    assert "[Clarified Thresholds & Criteria]" in res.json()["new_text"]

    # 3. Verify audit log entry created
    store = get_store()
    logs = store.list_audit_logs(role="brand_manager")
    assert any("Updated brand guideline" in log["action"] and "GUIDE-01" in log["target"] for log in logs)
