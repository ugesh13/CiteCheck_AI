"""
CiteCheck AI — Frontend Bridge Tests.

Directly tests the bridge endpoints matching the Glassmorphic Frontend Builder:
1. Login & Auth token generation
2. Brand kit retrieval & mutations
3. Drafts lifecycle (create, fetch, versioning, review)
4. 5-Gate Evidence Verifier execution via /api/drafts/:id/review
5. Human review decisions (accept/edit/dismiss)
6. Gap Radar analytics and Audit log retrieval
"""

import pytest

from app.routers.frontend_bridge import (
    LoginRequest,
    DraftInput,
    DecisionInput,
    login,
    get_brand_kit,
    list_drafts,
    create_draft,
    get_draft,
    run_review,
    get_findings,
    apply_decision,
    get_gap_radar,
    get_audit_log,
)


class TestAuthBridge:
    def test_login_creator(self):
        req = LoginRequest(email="creator@acme.com", password="pass", role="creator")
        data = login(req)
        assert "token" in data
        assert data["user"]["role"] == "creator"
        assert data["user"]["name"] == "Meera Nair"

    def test_login_reviewer(self):
        req = LoginRequest(email="reviewer@acme.com", password="pass", role="reviewer")
        data = login(req)
        assert data["user"]["role"] == "reviewer"
        assert data["user"]["name"] == "Nisha Rao"


class TestBrandKitBridge:
    def test_get_brand_kit(self):
        data = get_brand_kit()
        assert "guidelines" in data
        assert "facts" in data
        assert "terms" in data
        assert len(data["guidelines"]) > 0


class TestDraftsAndReviewBridge:
    def test_list_and_create_draft(self):
        # 1. List drafts
        drafts = list_drafts()
        assert isinstance(drafts, list)
        assert len(drafts) > 0

        # 2. Create new draft
        inp = DraftInput(title="test-campaign.md", text="Our military-grade zero fees forever platform is 100% secure.")
        new_draft = create_draft(inp)
        assert new_draft["title"] == "test-campaign.md"
        draft_id = new_draft["id"]

        # 3. Retrieve draft
        fetched = get_draft(draft_id)
        assert fetched["id"] == draft_id

        # 4. Run 5-Gate Review pipeline on this draft
        review_data = run_review(draft_id)
        assert "findings" in review_data
        assert "dropped" in review_data
        findings = review_data["findings"]
        assert len(findings) > 0

        # 5. Check findings format matches frontend expectations
        f1 = findings[0]
        assert "id" in f1
        assert "excerpt" in f1
        assert "severity" in f1
        assert "suggested_fix" in f1
        assert "reason" in f1

        # 6. Test decision on finding (accept suggested fix)
        dec_req = DecisionInput(action="accept")
        dec_data = apply_decision(f1["id"], dec_req)
        assert dec_data["status"] == "resolved"


class TestAnalyticsAndAuditBridge:
    def test_gap_radar(self):
        data = get_gap_radar()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "rule" in data[0]
        assert "flagged" in data[0]
        assert "dismissed" in data[0]

    def test_audit_log(self):
        logs = get_audit_log()
        assert isinstance(logs, list)
        assert len(logs) > 0
        assert "action" in logs[0]
        assert "who" in logs[0]
