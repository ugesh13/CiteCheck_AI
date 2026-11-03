"""
CiteCheck AI — Store Repository Interface.

Defines the single source of truth for facts, guidelines, terms, drafts,
versions, findings, decisions, comments, audit logs, notifications, and analytics.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseStore(ABC):
    """Abstract interface implemented by SupabaseStore and MemoryStore."""

    # ── Brand Kit & Facts ────────────────────────────────────────────────────
    @abstractmethod
    def get_brand_kit(self) -> Dict[str, Any]:
        """Return dict with keys: 'guidelines', 'facts', 'terms'."""
        pass

    @abstractmethod
    def get_facts(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_fact_by_id(self, fact_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_fact(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_fact(self, fact_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def renew_fact(self, fact_id: str, new_expires_on: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def archive_fact(self, fact_id: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def get_fact_history(self, fact_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_facts_health(self) -> Dict[str, Any]:
        """Return counts: total, active, expiring_7, expiring_30, expired, archived."""
        pass

    # ── Guidelines & Rules ───────────────────────────────────────────────────
    @abstractmethod
    def get_guidelines(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_guideline_by_id(self, rule_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_guideline(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_guideline(self, rule_id: str, payload: Dict[str, Any], actor: str = "Brand Manager", reason: str = "") -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_guideline(self, rule_id: str, actor: str = "Brand Manager") -> bool:
        pass

    @abstractmethod
    def get_rule_revisions(self, rule_id: str) -> List[Dict[str, Any]]:
        pass

    # ── Terminology ──────────────────────────────────────────────────────────
    @abstractmethod
    def get_terms(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_term(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_term(self, term_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_term(self, term_id: str, actor: str = "Brand Manager") -> bool:
        pass

    # ── Drafts ───────────────────────────────────────────────────────────────
    @abstractmethod
    def list_drafts(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_draft(self, draft_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_draft(self, title: str, text: str, actor: str = "Creator", creator_id: str = "") -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_draft(self, draft_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_draft(self, draft_id: str, actor: str = "Creator") -> bool:
        pass

    # ── Draft Versions ───────────────────────────────────────────────────────
    @abstractmethod
    def list_versions(self, draft_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_version(self, draft_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_version(self, draft_id: str, text: str, diff_summary: Optional[Dict[str, Any]] = None, actor: str = "Creator") -> Dict[str, Any]:
        pass

    @abstractmethod
    def lock_version(self, draft_id: str, version_number: int, actor: str = "Reviewer") -> Dict[str, Any]:
        pass

    # ── Findings & Verification Traces ───────────────────────────────────────
    @abstractmethod
    def get_findings(self, draft_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_findings_for_version(self, draft_id: str, version_number: int, findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_finding_by_id(self, finding_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def update_finding_status(self, finding_id: str, status: str, resolution_meta: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def record_dropped_candidates(self, draft_id: str, version_number: int, dropped: List[Dict[str, Any]]) -> None:
        pass

    @abstractmethod
    def get_dropped_candidates(self, draft_id: str) -> List[Dict[str, Any]]:
        pass

    # ── Decisions ────────────────────────────────────────────────────────────
    @abstractmethod
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
        pass

    @abstractmethod
    def list_decisions(self, draft_id: Optional[str] = None) -> List[Dict[str, Any]]:
        pass

    # ── Comments ─────────────────────────────────────────────────────────────
    @abstractmethod
    def list_comments(self, draft_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def add_comment(
        self,
        draft_id: str,
        author: str,
        author_role: str,
        text: str,
        anchor_finding_id: Optional[str] = None,
        anchor_offsets: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        pass

    # ── Audit Logs & Tamper-Evident Hashing ───────────────────────────────────
    @abstractmethod
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
        pass

    @abstractmethod
    def list_audit_logs(
        self,
        actor: Optional[str] = None,
        role: Optional[str] = None,
        action: Optional[str] = None,
        draft_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def verify_chain_integrity(self) -> Dict[str, Any]:
        """Verify the tamper-evident SHA-256 hash chain across all audit log entries."""
        pass

    # ── Notifications ────────────────────────────────────────────────────────
    @abstractmethod
    def list_notifications(self, user_role: Optional[str] = None, unread_only: bool = False) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_notification(
        self,
        user_role: str,
        kind: str,
        title: str,
        body: str,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def mark_notification_read(self, notification_id: str) -> bool:
        pass

    @abstractmethod
    def scan_and_generate_alerts(self) -> Dict[str, Any]:
        """Idempotent scan that alerts on expiring/expired facts and blocked drafts."""
        pass

    # ── Dismissal Events & Gap Radar ─────────────────────────────────────────
    @abstractmethod
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
        pass

    @abstractmethod
    def list_dismissal_events(self, rule_id: Optional[str] = None) -> List[Dict[str, Any]]:
        pass

    # ── Seed / Reset ─────────────────────────────────────────────────────────
    @abstractmethod
    def reset_to_seed(self) -> None:
        """Reset the store with fresh, relative-dated demo data."""
        pass

