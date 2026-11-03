"""
CiteCheck AI — In-Memory Store Implementation.

Provides deterministic, thread-safe persistence with relative-to-today date seeding.
Used in local dev, testing, and Vercel serverless environments when Supabase is not connected.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import hashlib
import threading
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.store.base import BaseStore
try:
    from backend.scripts.seed_demo import compute_audit_hash, generate_seed_data
except ModuleNotFoundError:
    from scripts.seed_demo import compute_audit_hash, generate_seed_data


def compute_fact_status(fact: Dict[str, Any], today: Optional[date] = None) -> str:
    """
    Computes real server-side status for an approved fact based on expires_on:
    - Archived: is_active is False or explicitly archived
    - Expired: expires_on < today
    - Expiring (≤7d): expires_on <= today + 7 days
    - Expiring soon: expires_on <= today + 30 days
    - Active: expires_on > today + 30 days
    """
    if not fact.get("is_active", True) or fact.get("status_override") == "archived":
        return "Archived"

    if today is None:
        today = datetime.now(timezone.utc).date()

    expires_val = fact.get("expires_on") or fact.get("review_date")
    if not expires_val:
        return "Active"

    if isinstance(expires_val, str):
        try:
            exp_date = date.fromisoformat(expires_val[:10])
        except ValueError:
            return "Active"
    elif isinstance(expires_val, date):
        exp_date = expires_val
    else:
        return "Active"

    if exp_date < today:
        return "Expired"
    elif exp_date <= today + timedelta(days=7):
        return "Expiring (≤7d)"
    elif exp_date <= today + timedelta(days=30):
        return "Expiring soon"
    else:
        return "Active"


class MemoryStore(BaseStore):
    """Full implementation of BaseStore backed by in-memory structures."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.reset_to_seed()

    def reset_to_seed(self) -> None:
        """Deterministically resets to seed data with dates relative to today."""
        with self._lock:
            data = generate_seed_data()
            self._guidelines: List[Dict[str, Any]] = data["guidelines"]
            self._facts: List[Dict[str, Any]] = data["facts"]
            self._terms: List[Dict[str, Any]] = data["terms"]
            self._drafts: Dict[str, Dict[str, Any]] = data["drafts"]
            self._versions: Dict[str, List[Dict[str, Any]]] = data["versions"]
            self._findings: Dict[str, List[Dict[str, Any]]] = data["findings"]
            self._dropped: Dict[str, List[Dict[str, Any]]] = data["dropped"]
            self._comments: Dict[str, List[Dict[str, Any]]] = data["comments"]
            # Audit stored in chronological order internally for clean hash chaining
            self._audit: List[Dict[str, Any]] = list(reversed(data["audit"]))
            self._dismissal_events: List[Dict[str, Any]] = data["dismissal_events"]
            self._fact_history: List[Dict[str, Any]] = data["fact_history"]
            self._notifications: List[Dict[str, Any]] = data["notifications"]
            self._rule_revisions: List[Dict[str, Any]] = data.get("rule_revisions", [])
            self._decisions: List[Dict[str, Any]] = data.get("decisions", [])

    # ── Brand Kit & Facts ────────────────────────────────────────────────────
    def get_brand_kit(self) -> Dict[str, Any]:
        with self._lock:
            today = datetime.now(timezone.utc).date()
            facts_with_status = []
            for f in self._facts:
                f_copy = dict(f)
                f_copy["computed_status"] = compute_fact_status(f_copy, today)
                facts_with_status.append(f_copy)

            return {
                "guidelines": [dict(g) for g in self._guidelines],
                "facts": facts_with_status,
                "terms": [dict(t) for t in self._terms],
            }

    def get_facts(self) -> List[Dict[str, Any]]:
        with self._lock:
            today = datetime.now(timezone.utc).date()
            result = []
            for f in self._facts:
                f_copy = dict(f)
                f_copy["computed_status"] = compute_fact_status(f_copy, today)
                result.append(f_copy)
            return result

    def get_fact_by_id(self, fact_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            today = datetime.now(timezone.utc).date()
            for f in self._facts:
                if str(f.get("id")) == str(fact_id):
                    f_copy = dict(f)
                    f_copy["computed_status"] = compute_fact_status(f_copy, today)
                    return f_copy
            return None

    def create_fact(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            item = dict(payload)
            if "id" not in item:
                item["id"] = f"FACT-{len(self._facts) + 1:02d}"
            if "expires_on" not in item and "review_date" in item:
                item["expires_on"] = item["review_date"]
            if "review_date" not in item and "expires_on" in item:
                item["review_date"] = item["expires_on"]
            item.setdefault("is_active", True)
            item.setdefault("renewal_count", 0)
            item.setdefault("owner_name", actor)
            item.setdefault("tags", [])
            self._facts.insert(0, item)

            self.append_audit_log(
                who=actor,
                role="brand_manager",
                action="Created approved fact",
                target=f"Brand Kit · {item['id']}",
                reason="Added new verified brand statement",
                details=item.get("text", "")[:80],
            )
            return dict(item)

    def update_fact(self, fact_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            for f in self._facts:
                if str(f.get("id")) == str(fact_id):
                    f.update(payload)
                    if "expires_on" in payload:
                        f["review_date"] = payload["expires_on"]
                    self.append_audit_log(
                        who=actor,
                        role="brand_manager",
                        action="Updated approved fact",
                        target=f"Brand Kit · {fact_id}",
                        reason=payload.get("reason", "Fact details updated"),
                        details=f.get("text", "")[:80],
                    )
                    return dict(f)
            return payload

    def renew_fact(self, fact_id: str, new_expires_on: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            for f in self._facts:
                if str(f.get("id")) == str(fact_id):
                    old_date = f.get("expires_on") or f.get("review_date")
                    f["expires_on"] = new_expires_on
                    f["review_date"] = new_expires_on
                    f["is_active"] = True
                    f["status_override"] = None
                    f["renewal_count"] = f.get("renewal_count", 0) + 1

                    # Record history
                    hist_entry = {
                        "id": f"fh-{uuid4().hex[:6]}",
                        "fact_id": fact_id,
                        "action": "renewed",
                        "actor": actor,
                        "actor_role": "brand_manager",
                        "reason": reason,
                        "old_expires_on": old_date,
                        "new_expires_on": new_expires_on,
                        "at": datetime.now(timezone.utc).isoformat(),
                    }
                    self._fact_history.insert(0, hist_entry)

                    # Append audit log
                    self.append_audit_log(
                        who=actor,
                        role="brand_manager",
                        action="Renewed approved fact",
                        target=f"Brand Kit · {fact_id}",
                        reason=reason,
                        details=f"Extended expiry from {old_date} to {new_expires_on}",
                    )

                    # Create in-app notification
                    self.create_notification(
                        user_role="creator",
                        kind="fact_renewed",
                        title=f"Fact {fact_id} renewed",
                        body=f"{fact_id} was renewed until {new_expires_on} by {actor}. Reason: {reason}",
                        ref_type="fact",
                        ref_id=fact_id,
                    )
                    return dict(f)

            raise KeyError(f"Fact '{fact_id}' not found.")

    def archive_fact(self, fact_id: str, reason: str, actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            for f in self._facts:
                if str(f.get("id")) == str(fact_id):
                    old_date = f.get("expires_on")
                    f["is_active"] = False
                    f["status_override"] = "archived"

                    hist_entry = {
                        "id": f"fh-{uuid4().hex[:6]}",
                        "fact_id": fact_id,
                        "action": "archived",
                        "actor": actor,
                        "actor_role": "brand_manager",
                        "reason": reason,
                        "old_expires_on": old_date,
                        "new_expires_on": None,
                        "at": datetime.now(timezone.utc).isoformat(),
                    }
                    self._fact_history.insert(0, hist_entry)

                    self.append_audit_log(
                        who=actor,
                        role="brand_manager",
                        action="Archived approved fact",
                        target=f"Brand Kit · {fact_id}",
                        reason=reason,
                        details="Fact deactivated and archived from active use",
                    )
                    return dict(f)
            raise KeyError(f"Fact '{fact_id}' not found.")

    def get_fact_history(self, fact_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(h) for h in self._fact_history if str(h.get("fact_id")) == str(fact_id)]

    def get_facts_health(self) -> Dict[str, Any]:
        with self._lock:
            today = datetime.now(timezone.utc).date()
            total = len(self._facts)
            active = 0
            expiring_7 = 0
            expiring_30 = 0
            expired = 0
            archived = 0

            for f in self._facts:
                status = compute_fact_status(f, today)
                if status == "Archived":
                    archived += 1
                elif status == "Expired":
                    expired += 1
                elif status == "Expiring (≤7d)":
                    expiring_7 += 1
                    expiring_30 += 1
                elif status == "Expiring soon":
                    expiring_30 += 1
                else:
                    active += 1

            return {
                "total": total,
                "active": active,
                "expiring_7": expiring_7,
                "expiring_30": expiring_30,
                "expired": expired,
                "archived": archived,
            }

    # ── Guidelines & Rules ───────────────────────────────────────────────────
    def get_guidelines(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(g) for g in self._guidelines]

    def get_guideline_by_id(self, rule_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            for g in self._guidelines:
                if str(g.get("id")) == str(rule_id):
                    return dict(g)
            return None

    def create_guideline(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            item = dict(payload)
            if "id" not in item:
                item["id"] = f"GUIDE-{len(self._guidelines) + 1:02d}"
            item.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            self._guidelines.insert(0, item)

            self.append_audit_log(
                who=actor,
                role="brand_manager",
                action="Created brand guideline",
                target=f"Brand Kit · {item['id']}",
                reason="Added new brand rule",
                details=item.get("title", ""),
            )
            return dict(item)

    def update_guideline(self, rule_id: str, payload: Dict[str, Any], actor: str = "Brand Manager", reason: str = "") -> Dict[str, Any]:
        with self._lock:
            for g in self._guidelines:
                if str(g.get("id")) == str(rule_id):
                    old_text = g.get("text", "")
                    g.update(payload)
                    new_text = g.get("text", "")

                    if old_text != new_text:
                        revision = {
                            "id": f"rev-{uuid4().hex[:6]}",
                            "rule_id": rule_id,
                            "old_text": old_text,
                            "new_text": new_text,
                            "reason": reason or payload.get("reason", "Rule text updated"),
                            "actor": actor,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                        self._rule_revisions.insert(0, revision)

                    self.append_audit_log(
                        who=actor,
                        role="brand_manager",
                        action="Updated brand guideline",
                        target=f"Brand Kit · {rule_id}",
                        reason=reason or "Guideline rule updated",
                        details=g.get("title", ""),
                    )
                    return dict(g)
            return payload

    def delete_guideline(self, rule_id: str, actor: str = "Brand Manager") -> bool:
        with self._lock:
            initial_len = len(self._guidelines)
            self._guidelines = [g for g in self._guidelines if str(g.get("id")) != str(rule_id)]
            if len(self._guidelines) < initial_len:
                self.append_audit_log(
                    who=actor,
                    role="brand_manager",
                    action="Deleted brand guideline",
                    target=f"Brand Kit · {rule_id}",
                    reason="Retired guideline policy",
                )
                return True
            return False

    def get_rule_revisions(self, rule_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._rule_revisions if str(r.get("rule_id")) == str(rule_id)]

    # ── Terminology ──────────────────────────────────────────────────────────
    def get_terms(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(t) for t in self._terms]

    def create_term(self, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            item = dict(payload)
            if "id" not in item:
                item["id"] = f"TERM-{len(self._terms) + 1:02d}"
            self._terms.insert(0, item)
            self.append_audit_log(
                who=actor,
                role="brand_manager",
                action="Added approved terminology",
                target=f"Brand Kit · {item['id']}",
                reason="Set preferred term mapping",
                details=f"Forbidden: {item.get('banned')} -> Preferred: {item.get('preferred')}",
            )
            return dict(item)

    def update_term(self, term_id: str, payload: Dict[str, Any], actor: str = "Brand Manager") -> Dict[str, Any]:
        with self._lock:
            for t in self._terms:
                if str(t.get("id")) == str(term_id):
                    t.update(payload)
                    self.append_audit_log(
                        who=actor,
                        role="brand_manager",
                        action="Updated approved terminology",
                        target=f"Brand Kit · {term_id}",
                        details=f"Preferred: {t.get('preferred')}",
                    )
                    return dict(t)
            return payload

    def delete_term(self, term_id: str, actor: str = "Brand Manager") -> bool:
        with self._lock:
            initial = len(self._terms)
            self._terms = [t for t in self._terms if str(t.get("id")) != str(term_id)]
            return len(self._terms) < initial

    # ── Drafts ───────────────────────────────────────────────────────────────
    def list_drafts(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(d) for d in self._drafts.values()]

    def get_draft(self, draft_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            d = self._drafts.get(draft_id)
            return dict(d) if d else None

    def create_draft(self, title: str, text: str, actor: str = "Creator", creator_id: str = "") -> Dict[str, Any]:
        with self._lock:
            draft_id = f"draft-{uuid4().hex[:6]}"
            now_str = datetime.now(timezone.utc).isoformat()
            draft = {
                "id": draft_id,
                "title": title,
                "text": text,
                "version": 1,
                "status": "Draft",
                "updated_at": now_str,
                "findings_count": 0,
                "creator": actor,
                "creator_id": creator_id or "u-creator",
            }
            self._drafts[draft_id] = draft
            self._versions[draft_id] = [
                {
                    "id": f"v-{draft_id}-1",
                    "version": 1,
                    "text": text,
                    "created_at": now_str,
                    "locked": False,
                }
            ]
            self._findings[draft_id] = []
            self._dropped[draft_id] = []
            self._comments[draft_id] = []

            self.append_audit_log(
                who=actor,
                role="creator",
                action="Created new draft",
                target=title,
                details=f"Initialized draft {draft_id} v1",
                draft_id=draft_id,
            )
            return dict(draft)

    def update_draft(self, draft_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            draft = self._drafts.get(draft_id)
            if not draft:
                raise KeyError(f"Draft '{draft_id}' not found.")
            draft.update(payload)
            draft["updated_at"] = datetime.now(timezone.utc).isoformat()
            return dict(draft)

    def delete_draft(self, draft_id: str, actor: str = "Creator") -> bool:
        with self._lock:
            if draft_id in self._drafts:
                title = self._drafts[draft_id].get("title", draft_id)
                del self._drafts[draft_id]
                self._versions.pop(draft_id, None)
                self._findings.pop(draft_id, None)
                self._dropped.pop(draft_id, None)
                self._comments.pop(draft_id, None)
                self.append_audit_log(
                    who=actor,
                    role="creator",
                    action="Deleted draft",
                    target=title,
                    draft_id=draft_id,
                )
                return True
            return False

    # ── Draft Versions ───────────────────────────────────────────────────────
    def list_versions(self, draft_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(v) for v in self._versions.get(draft_id, [])]

    def get_version(self, draft_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        with self._lock:
            versions = self._versions.get(draft_id, [])
            for v in versions:
                if v.get("version") == version_number:
                    return dict(v)
            return None

    def create_version(self, draft_id: str, text: str, diff_summary: Optional[Dict[str, Any]] = None, actor: str = "Creator") -> Dict[str, Any]:
        with self._lock:
            draft = self._drafts.get(draft_id)
            if not draft:
                raise KeyError(f"Draft '{draft_id}' not found.")

            versions = self._versions.setdefault(draft_id, [])
            new_version_num = len(versions) + 1
            now_str = datetime.now(timezone.utc).isoformat()

            new_v = {
                "id": f"v-{draft_id}-{new_version_num}",
                "version": new_version_num,
                "text": text,
                "created_at": now_str,
                "locked": False,
                "diff_summary": diff_summary,
            }
            versions.append(new_v)

            draft["text"] = text
            draft["version"] = new_version_num
            draft["updated_at"] = now_str

            self.append_audit_log(
                who=actor,
                role="creator",
                action="Created draft revision",
                target=f"{draft.get('title')} · v{new_version_num}",
                details=f"New version created ({len(text)} chars)",
                draft_id=draft_id,
            )
            return dict(new_v)

    def lock_version(self, draft_id: str, version_number: int, actor: str = "Reviewer") -> Dict[str, Any]:
        with self._lock:
            versions = self._versions.get(draft_id, [])
            for v in versions:
                if v.get("version") == version_number:
                    v["locked"] = True
                    v["locked_by"] = actor
                    v["locked_at"] = datetime.now(timezone.utc).isoformat()
                    return dict(v)
            raise KeyError(f"Version {version_number} of draft '{draft_id}' not found.")

    # ── Findings & Verification Traces ───────────────────────────────────────
    def get_findings(self, draft_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(f) for f in self._findings.get(draft_id, [])]

    def save_findings_for_version(self, draft_id: str, version_number: int, findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        with self._lock:
            # Idempotent: replaces findings for this draft
            self._findings[draft_id] = [dict(f) for f in findings]
            if draft_id in self._drafts:
                self._drafts[draft_id]["findings_count"] = len(findings)
            return [dict(f) for f in findings]

    def get_finding_by_id(self, finding_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            for draft_id, findings in self._findings.items():
                for f in findings:
                    if str(f.get("id")) == str(finding_id):
                        return dict(f)
            return None

    def update_finding_status(self, finding_id: str, status: str, resolution_meta: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        with self._lock:
            for draft_id, findings in self._findings.items():
                for f in findings:
                    if str(f.get("id")) == str(finding_id):
                        f["status"] = status
                        if resolution_meta:
                            f.update(resolution_meta)
                        return dict(f)
            return None

    def record_dropped_candidates(self, draft_id: str, version_number: int, dropped: List[Dict[str, Any]]) -> None:
        with self._lock:
            self._dropped[draft_id] = [dict(d) for d in dropped]

    def get_dropped_candidates(self, draft_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(d) for d in self._dropped.get(draft_id, [])]

    # ── Decisions ────────────────────────────────────────────────────────────
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
        with self._lock:
            decision = {
                "id": f"dec-{uuid4().hex[:6]}",
                "finding_id": finding_id,
                "action": action,
                "actor": actor,
                "actor_role": actor_role,
                "reason": reason or "",
                "custom_edit_text": custom_edit_text,
                "dismissal_theme": dismissal_theme,
                "is_false_positive": is_false_positive,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._decisions.append(decision)
            return decision

    def list_decisions(self, draft_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if not draft_id:
                return [dict(d) for d in self._decisions]
            # Match finding IDs in this draft
            draft_findings = {str(f["id"]) for f in self._findings.get(draft_id, [])}
            return [dict(d) for d in self._decisions if str(d.get("finding_id")) in draft_findings]

    # ── Comments ─────────────────────────────────────────────────────────────
    def list_comments(self, draft_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(c) for c in self._comments.get(draft_id, [])]

    def add_comment(
        self,
        draft_id: str,
        author: str,
        author_role: str,
        text: str,
        anchor_finding_id: Optional[str] = None,
        anchor_offsets: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            comments = self._comments.setdefault(draft_id, [])
            comment = {
                "id": f"c-{uuid4().hex[:6]}",
                "author": author,
                "author_role": author_role,
                "text": text,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "anchor_finding_id": anchor_finding_id,
                "anchor_offsets": anchor_offsets,
            }
            comments.append(comment)
            return dict(comment)

    # ── Audit Logs & Tamper-Evident Hashing ───────────────────────────────────
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
        with self._lock:
            now_str = datetime.now(timezone.utc).isoformat()
            genesis_hash = "GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000"
            prev_hash = self._audit[-1]["hash"] if self._audit else genesis_hash

            entry_hash = compute_audit_hash(
                prev_hash=prev_hash,
                timestamp=now_str,
                who=who,
                role=role,
                action=action,
                target=target,
                reason=reason,
                details=details,
            )

            entry = {
                "id": f"a-{len(self._audit) + 1:03d}",
                "who": who,
                "role": role,
                "action": action,
                "target": target,
                "timestamp": now_str,
                "reason": reason,
                "details": details,
                "draft_id": draft_id,
                "prev_hash": prev_hash,
                "hash": entry_hash,
            }
            self._audit.append(entry)
            return dict(entry)

    def list_audit_logs(
        self,
        actor: Optional[str] = None,
        role: Optional[str] = None,
        action: Optional[str] = None,
        draft_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            # Return latest entries first
            results = list(reversed(self._audit))
            if actor:
                results = [r for r in results if actor.lower() in r.get("who", "").lower()]
            if role:
                results = [r for r in results if r.get("role") == role]
            if action:
                results = [r for r in results if action.lower() in r.get("action", "").lower()]
            if draft_id:
                results = [r for r in results if r.get("draft_id") == draft_id]
            if search:
                s_lower = search.lower()
                results = [
                    r for r in results
                    if s_lower in r.get("who", "").lower()
                    or s_lower in r.get("action", "").lower()
                    or s_lower in r.get("target", "").lower()
                    or s_lower in r.get("reason", "").lower()
                    or s_lower in r.get("details", "").lower()
                ]
            return [dict(r) for r in results[:limit]]

    def verify_chain_integrity(self) -> Dict[str, Any]:
        """Verify the tamper-evident SHA-256 hash chain across all audit log entries."""
        with self._lock:
            genesis_hash = "GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000"
            expected_prev = genesis_hash

            for idx, entry in enumerate(self._audit):
                if entry.get("prev_hash") != expected_prev:
                    return {
                        "valid": False,
                        "tampered_at_index": idx,
                        "tampered_entry_id": entry.get("id"),
                        "reason": f"Mismatched prev_hash: expected '{expected_prev}', got '{entry.get('prev_hash')}'",
                        "entries_checked": idx,
                    }

                recomputed = compute_audit_hash(
                    prev_hash=expected_prev,
                    timestamp=entry["timestamp"],
                    who=entry["who"],
                    role=entry["role"],
                    action=entry["action"],
                    target=entry["target"],
                    reason=entry.get("reason", ""),
                    details=entry.get("details", ""),
                )

                if entry.get("hash") != recomputed:
                    return {
                        "valid": False,
                        "tampered_at_index": idx,
                        "tampered_entry_id": entry.get("id"),
                        "reason": f"Content tampering detected: stored hash '{entry.get('hash')}' does not match recomputed hash '{recomputed}'",
                        "entries_checked": idx,
                    }

                expected_prev = entry["hash"]

            return {
                "valid": True,
                "entries_checked": len(self._audit),
                "latest_hash": expected_prev,
                "message": f"Cryptographic integrity verified: all {len(self._audit)} entries match SHA-256 chain.",
            }

    # ── Notifications ────────────────────────────────────────────────────────
    def list_notifications(self, user_role: Optional[str] = None, unread_only: bool = False) -> List[Dict[str, Any]]:
        with self._lock:
            items = self._notifications
            if user_role and user_role != "all":
                items = [n for n in items if n.get("user_role") in (user_role, "all")]
            if unread_only:
                items = [n for n in items if not n.get("read", False)]
            return [dict(n) for n in sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)]

    def create_notification(
        self,
        user_role: str,
        kind: str,
        title: str,
        body: str,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            notif = {
                "id": f"notif-{uuid4().hex[:6]}",
                "user_role": user_role,
                "kind": kind,
                "title": title,
                "body": body,
                "ref_type": ref_type,
                "ref_id": ref_id,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._notifications.insert(0, notif)
            return dict(notif)

    def mark_notification_read(self, notification_id: str) -> bool:
        with self._lock:
            for n in self._notifications:
                if str(n.get("id")) == str(notification_id):
                    n["read"] = True
                    return True
            return False

    def scan_and_generate_alerts(self) -> Dict[str, Any]:
        """Idempotent scan that alerts on expiring/expired facts and blocked drafts."""
        with self._lock:
            today = datetime.now(timezone.utc).date()
            generated = 0

            # Scan facts
            for f in self._facts:
                fid = f.get("id", "")
                status = compute_fact_status(f, today)
                if status == "Expired":
                    # Check if unread alert exists
                    exists = any(
                        n.get("kind") == "fact_expired" and n.get("ref_id") == fid and not n.get("read", False)
                        for n in self._notifications
                    )
                    if not exists:
                        self.create_notification(
                            user_role="brand_manager",
                            kind="fact_expired",
                            title=f"Fact {fid} has expired",
                            body=f"Fact {fid} expired on {f.get('expires_on')}. Content citing it is blocked.",
                            ref_type="fact",
                            ref_id=fid,
                        )
                        generated += 1
                elif status in ("Expiring (≤7d)", "Expiring soon"):
                    exists = any(
                        n.get("kind") == "expiry_warning" and n.get("ref_id") == fid and not n.get("read", False)
                        for n in self._notifications
                    )
                    if not exists:
                        self.create_notification(
                            user_role="brand_manager",
                            kind="expiry_warning",
                            title=f"Fact {fid} expiring soon",
                            body=f"Fact {fid} expires on {f.get('expires_on')}. Action: review and renew.",
                            ref_type="fact",
                            ref_id=fid,
                        )
                        generated += 1

            # Scan drafts with blocked findings
            for draft_id, findings in self._findings.items():
                blocked_facts = [f.get("source_ref_id") for f in findings if f.get("status") == "blocked_expired_fact"]
                if blocked_facts:
                    exists = any(
                        n.get("kind") == "draft_blocked" and n.get("ref_id") == draft_id and not n.get("read", False)
                        for n in self._notifications
                    )
                    if not exists:
                        draft_title = self._drafts.get(draft_id, {}).get("title", draft_id)
                        self.create_notification(
                            user_role="reviewer",
                            kind="draft_blocked",
                            title=f"Draft '{draft_title}' blocked by expired fact",
                            body=f"Draft cites expired fact(s) {', '.join(set(blocked_facts))}. Approval locked.",
                            ref_type="draft",
                            ref_id=draft_id,
                        )
                        generated += 1

            return {"scanned": True, "new_alerts_generated": generated}

    # ── Dismissal Events & Gap Radar ─────────────────────────────────────────
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
        with self._lock:
            event = {
                "id": f"de-{uuid4().hex[:6]}",
                "rule_or_fact_id": rule_or_fact_id,
                "draft_id": draft_id,
                "finding_id": finding_id,
                "reason": reason,
                "theme": theme,
                "user_name": user_name,
                "user_role": user_role,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._dismissal_events.append(event)
            return dict(event)

    def list_dismissal_events(self, rule_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if not rule_id:
                return [dict(e) for e in self._dismissal_events]
            return [dict(e) for e in self._dismissal_events if str(e.get("rule_or_fact_id")) == str(rule_id)]

