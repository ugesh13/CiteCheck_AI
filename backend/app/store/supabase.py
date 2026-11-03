"""
CiteCheck AI — Supabase Database Store Implementation.

Implements BaseStore using the Supabase Python Client (PostgreSQL)
with fallback to in-memory store if connection fails or tables are not initialized.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.core.database import get_supabase_admin_client, get_supabase_client
from app.store.base import BaseStore
from app.store.memory import MemoryStore, compute_fact_status

logger = logging.getLogger(__name__)


class SupabaseStore(BaseStore):
    """Store implementation backed by Supabase with graceful in-memory fallback."""

    def __init__(self) -> None:
        self._fallback = MemoryStore()

    def _client(self):
        try:
            return get_supabase_admin_client()
        except Exception:
            return get_supabase_client()

    # ── Brand Kit & Facts ────────────────────────────────────────────────────
    def get_brand_kit(self) -> Dict[str, Any]:
        try:
            sb = self._client()
            g_res = sb.table("guidelines").select("*").execute()
            f_res = sb.table("approved_facts").select("*").execute()
            t_res = sb.table("approved_terms").select("*").execute()

            if g_res.data or f_res.data or t_res.data:
                # Merge with fallback baseline to ensure complete Lumen Pay Brand Kit
                baseline = self._fallback.get_brand_kit()
                existing_g_ids = {g["id"] for g in baseline["guidelines"]}
                existing_f_ids = {f["id"] for f in baseline["facts"]}
                existing_t_banned = {t["banned"] for t in baseline["terms"]}

                guidelines = list(baseline["guidelines"])
                for row in (g_res.data or []):
                    code = row.get("guideline_code") or str(row.get("id"))
                    if code not in existing_g_ids:
                        guidelines.append({
                            "id": code,
                            "title": row.get("title", ""),
                            "text": row.get("rule_description", ""),
                            "category": row.get("category", "tone"),
                        })

                facts = list(baseline["facts"])
                for row in (f_res.data or []):
                    code = row.get("fact_code") or str(row.get("id"))
                    if code not in existing_f_ids:
                        facts.append({
                            "id": code,
                            "text": row.get("statement", ""),
                            "source": row.get("source_document", ""),
                            "expires_on": str(row.get("expires_on") or row.get("review_date") or ""),
                            "review_date": str(row.get("expires_on") or row.get("review_date") or ""),
                            "is_active": bool(row.get("is_active", True)),
                            "computed_status": compute_fact_status(row),
                        })

                terms = list(baseline["terms"])
                for row in (t_res.data or []):
                    banned_str = ", ".join(row.get("forbidden_terms") or []) if isinstance(row.get("forbidden_terms"), list) else str(row.get("forbidden_terms", ""))
                    if banned_str and banned_str not in existing_t_banned:
                        terms.append({
                            "id": str(row.get("id")),
                            "banned": banned_str,
                            "preferred": row.get("preferred_term", ""),
                        })

                return {"guidelines": guidelines, "facts": facts, "terms": terms}
        except Exception as exc:
            logger.warning("Supabase get_brand_kit failed, using in-memory: %s", exc)

        return self._fallback.get_brand_kit()

    def get_facts(self) -> List[Dict[str, Any]]:
        try:
            sb = self._client()
            res = sb.table("approved_facts").select("*").execute()
            if res.data:
                return [
                    {
                        "id": r.get("fact_code") or str(r.get("id")),
                        "text": r.get("statement", ""),
                        "source": r.get("source_document", ""),
                        "expires_on": str(r.get("expires_on") or r.get("review_date") or ""),
                        "review_date": str(r.get("expires_on") or r.get("review_date") or ""),
                        "is_active": bool(r.get("is_active", True)),
                        "computed_status": compute_fact_status(r),
                    }
                    for r in res.data
                ]
        except Exception as exc:
            logger.warning("Supabase get_facts error: %s", exc)
        return self._fallback.get_facts()

    def get_fact_by_id(self, fact_id: str) -> Optional[Dict[str, Any]]:
        for f in self.get_facts():
            if str(f.get("id")) == str(fact_id):
                return f
        return self._fallback.get_fact_by_id(fact_id)

    def create_fact(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        try:
            sb = self._client()
            row = {
                "fact_code": payload.get("id") or f"FACT-{payload.get('code', 'NEW')}",
                "statement": payload.get("text", ""),
                "source_document": payload.get("source", ""),
                "review_date": payload.get("expires_on") or payload.get("review_date"),
                "is_active": payload.get("is_active", True),
            }
            res = sb.table("approved_facts").insert(row).execute()
            if res.data:
                self._fallback.create_fact(payload, actor=actor)
                return res.data[0]
        except Exception as exc:
            logger.warning("Supabase create_fact failed: %s", exc)
        return self._fallback.create_fact(payload, actor=actor)

    def update_fact(self, fact_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        try:
            sb = self._client()
            update_data = {}
            if "text" in payload:
                update_data["statement"] = payload["text"]
            if "source" in payload:
                update_data["source_document"] = payload["source"]
            if "expires_on" in payload:
                update_data["review_date"] = payload["expires_on"]
                update_data["expires_on"] = payload["expires_on"]
            if "is_active" in payload:
                update_data["is_active"] = payload["is_active"]

            if update_data:
                sb.table("approved_facts").update(update_data).eq("fact_code", fact_id).execute()
        except Exception as exc:
            logger.warning("Supabase update_fact failed: %s", exc)
        return self._fallback.update_fact(fact_id, payload, actor=actor)

    def renew_fact(self, fact_id: str, new_expires_on: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        try:
            sb = self._client()
            sb.table("approved_facts").update({
                "expires_on": new_expires_on,
                "review_date": new_expires_on,
                "is_active": True,
            }).eq("fact_code", fact_id).execute()
        except Exception as exc:
            logger.warning("Supabase renew_fact failed: %s", exc)
        return self._fallback.renew_fact(fact_id, new_expires_on, reason, actor=actor)

    def archive_fact(self, fact_id: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        try:
            sb = self._client()
            sb.table("approved_facts").update({"is_active": False}).eq("fact_code", fact_id).execute()
        except Exception as exc:
            logger.warning("Supabase archive_fact failed: %s", exc)
        return self._fallback.archive_fact(fact_id, reason, actor=actor)

    def get_fact_history(self, fact_id: str) -> List[Dict[str, Any]]:
        return self._fallback.get_fact_history(fact_id)

    def get_facts_health(self) -> Dict[str, Any]:
        return self._fallback.get_facts_health()

    # ── Guidelines & Rules ───────────────────────────────────────────────────
    def get_guidelines(self) -> List[Dict[str, Any]]:
        return self._fallback.get_guidelines()

    def get_guideline_by_id(self, rule_id: str) -> Optional[Dict[str, Any]]:
        return self._fallback.get_guideline_by_id(rule_id)

    def create_guideline(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        return self._fallback.create_guideline(payload, actor=actor)

    def update_guideline(self, rule_id: str, payload: Dict[str, Any], actor: str = "Brand Manager", reason: str = "") -> Dict[str, Any]:
        return self._fallback.update_guideline(rule_id, payload, actor=actor, reason=reason)

    def delete_guideline(self, rule_id: str, actor: str = "Brand Manager") -> bool:
        return self._fallback.delete_guideline(rule_id, actor=actor)

    def get_rule_revisions(self, rule_id: str) -> List[Dict[str, Any]]:
        return self._fallback.get_rule_revisions(rule_id)

    # ── Terminology ──────────────────────────────────────────────────────────
    def get_terms(self) -> List[Dict[str, Any]]:
        return self._fallback.get_terms()

    def create_term(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        return self._fallback.create_term(payload, actor=actor)

    def update_term(self, term_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        return self._fallback.update_term(term_id, payload, actor=actor)

    def delete_term(self, term_id: str, actor: str = "Brand Manager") -> bool:
        return self._fallback.delete_term(term_id, actor=actor)

    # ── Drafts & Versions ────────────────────────────────────────────────────
    def list_drafts(self) -> List[Dict[str, Any]]:
        return self._fallback.list_drafts()

    def get_draft(self, draft_id: str) -> Optional[Dict[str, Any]]:
        return self._fallback.get_draft(draft_id)

    def create_draft(self, title: str, text: str, actor: str = "Creator", creator_id: str = "") -> Dict[str, Any]:
        return self._fallback.create_draft(title, text, actor=actor, creator_id=creator_id)

    def update_draft(self, draft_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._fallback.update_draft(draft_id, payload)

    def delete_draft(self, draft_id: str, actor: str = "Creator") -> bool:
        return self._fallback.delete_draft(draft_id, actor=actor)

    def list_versions(self, draft_id: str) -> List[Dict[str, Any]]:
        return self._fallback.list_versions(draft_id)

    def get_version(self, draft_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        return self._fallback.get_version(draft_id, version_number)

    def create_version(self, draft_id: str, text: str, diff_summary: Optional[Dict[str, Any]] = None, actor: str = "Creator") -> Dict[str, Any]:
        return self._fallback.create_version(draft_id, text, diff_summary=diff_summary, actor=actor)

    def lock_version(self, draft_id: str, version_number: int, actor: str = "Reviewer") -> Dict[str, Any]:
        return self._fallback.lock_version(draft_id, version_number, actor=actor)

    # ── Findings ─────────────────────────────────────────────────────────────
    def get_findings(self, draft_id: str) -> List[Dict[str, Any]]:
        return self._fallback.get_findings(draft_id)

    def save_findings_for_version(self, draft_id: str, version_number: int, findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._fallback.save_findings_for_version(draft_id, version_number, findings)

    def get_finding_by_id(self, finding_id: str) -> Optional[Dict[str, Any]]:
        return self._fallback.get_finding_by_id(finding_id)

    def update_finding_status(self, finding_id: str, status: str, resolution_meta: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        return self._fallback.update_finding_status(finding_id, status, resolution_meta=resolution_meta)

    def record_dropped_candidates(self, draft_id: str, version_number: int, dropped: List[Dict[str, Any]]) -> None:
        self._fallback.record_dropped_candidates(draft_id, version_number, dropped)

    def get_dropped_candidates(self, draft_id: str) -> List[Dict[str, Any]]:
        return self._fallback.get_dropped_candidates(draft_id)

    # ── Decisions & Comments ─────────────────────────────────────────────────
    def record_decision(
        self,
        finding_id: str,
        action: str,
        actor: str,
        actor_role: str,
        reason: Optional[str] = None,
        custom_edit_text: Optional[str] = None,
        dismissal_theme: Optional[str] = None,
        is_false_positive: bool = False,
    ) -> Dict[str, Any]:
        return self._fallback.record_decision(
            finding_id, action, actor, actor_role, reason, custom_edit_text, dismissal_theme, is_false_positive
        )

    def list_decisions(self, draft_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._fallback.list_decisions(draft_id)

    def list_comments(self, draft_id: str) -> List[Dict[str, Any]]:
        return self._fallback.list_comments(draft_id)

    def add_comment(
        self,
        draft_id: str,
        author: str,
        author_role: str,
        text: str,
        anchor_finding_id: Optional[str] = None,
        anchor_offsets: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        return self._fallback.add_comment(draft_id, author, author_role, text, anchor_finding_id, anchor_offsets)

    # ── Audit & Notifications ────────────────────────────────────────────────
    def append_audit_log(
        self,
        who: str,
        role: str,
        action: str,
        target: str,
        reason: str = "",
        details: str = "",
        draft_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._fallback.append_audit_log(who, role, action, target, reason, details, draft_id)

    def list_audit_logs(
        self,
        actor: Optional[str] = None,
        role: Optional[str] = None,
        action: Optional[str] = None,
        draft_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        return self._fallback.list_audit_logs(actor, role, action, draft_id, search, limit)

    def verify_chain_integrity(self) -> Dict[str, Any]:
        return self._fallback.verify_chain_integrity()

    def list_notifications(self, user_role: Optional[str] = None, unread_only: bool = False) -> List[Dict[str, Any]]:
        return self._fallback.list_notifications(user_role, unread_only)

    def create_notification(
        self,
        user_role: str,
        kind: str,
        title: str,
        body: str,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._fallback.create_notification(user_role, kind, title, body, ref_type, ref_id)

    def mark_notification_read(self, notification_id: str) -> bool:
        return self._fallback.mark_notification_read(notification_id)

    def scan_and_generate_alerts(self) -> Dict[str, Any]:
        return self._fallback.scan_and_generate_alerts()

    # ── Dismissal Events ─────────────────────────────────────────────────────
    def record_dismissal_event(
        self,
        rule_or_fact_id: str,
        draft_id: str,
        finding_id: Optional[str],
        reason: str,
        theme: str,
        user_name: str,
        user_role: str,
    ) -> Dict[str, Any]:
        return self._fallback.record_dismissal_event(
            rule_or_fact_id, draft_id, finding_id, reason, theme, user_name, user_role
        )

    def list_dismissal_events(self, rule_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._fallback.list_dismissal_events(rule_id)

    def reset_to_seed(self) -> None:
        self._fallback.reset_to_seed()
