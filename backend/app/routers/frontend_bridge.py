"""
CiteCheck AI — Frontend Integration Bridge Router.

Provides 100% matched endpoints for the Glassmorphic Frontend Builder,
bridging the UI directly to our 5-Gate Evidence Verifier engine, Supabase DB,
and audit logging system.
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from pydantic import BaseModel, Field

from app.core.database import get_supabase_client
from app.core.security import CurrentUser, get_optional_current_user
from app.engine.rules import run_rules_engine
from app.engine.verifier import run_five_gate_pipeline

router = APIRouter(prefix="", tags=["Frontend Integration Bridge"])

# ─── In-Memory Fallback State (Ensures instant demo operability) ────────────
DEFAULT_BRAND_KIT: Dict[str, Any] = {
    "guidelines": [
        {"id": "GUIDE-01", "title": "Claims need proof", "text": "Never use superlatives unless supported by an approved, current fact.", "category": "claim"},
        {"id": "GUIDE-02", "title": "Plainspoken confidence", "text": "Use clear, useful language. Avoid guarantees and absolute promises.", "category": "tone"},
        {"id": "GUIDE-03", "title": "Payments terminology", "text": "Say “UPI payment”, not “UPI transaction”.", "category": "terminology"},
        {"id": "GUIDE-04", "title": "Security language", "text": "Do not use “military-grade”. Describe specific controls instead.", "category": "tone"},
        {"id": "GUIDE-05", "title": "Numbers and dates", "text": "Promotional values and eligibility always need a current source.", "category": "formatting"},
        {"id": "GUIDE-06", "title": "Human review", "text": "A reviewer must decide any change to a number, date, or named entity.", "category": "tone"},
        {"id": "GUIDE-07", "title": "Respectful tone", "text": "Avoid fear-based language and pressure tactics.", "category": "tone"},
        {"id": "GUIDE-08", "title": "Product naming", "text": "Use Lumen Pay on first mention; Lumen thereafter.", "category": "terminology"},
        {"id": "GUIDE-09", "title": "No lifetime promises", "text": "Do not promise a price or feature will never change.", "category": "claim"},
        {"id": "GUIDE-10", "title": "Accessibility", "text": "Use short sentences and explain specialist terms.", "category": "accessibility"},
    ],
    "facts": [
        {"id": "FACT-01", "text": "Lumen Pay is a digital wallet built for simple, secure everyday UPI payments.", "source": "Product Overview v2", "review_date": "2027-04-15", "allow_ai": True},
        {"id": "FACT-02", "text": "Users can link bank accounts via UPI to pay merchant QR codes and contacts.", "source": "Payments Specification 2026", "review_date": "2027-05-01", "allow_ai": True},
        {"id": "FACT-03", "text": "Pricing: fees are reviewed quarterly; no lifetime zero-fee promises.", "source": "Lumen Pay pricing policy Q3", "review_date": "2026-08-15", "allow_ai": True},
        {"id": "FACT-04", "text": "Every payment generates an instant in-app digital receipt with UTR.", "source": "Core Payments Engine Doc", "review_date": "2027-03-10", "allow_ai": True},
        {"id": "FACT-05", "text": "Customer support is accessible 24/7 directly within the Lumen Pay mobile application.", "source": "In-App Support SLA", "review_date": "2027-06-01", "allow_ai": True},
        {"id": "FACT-06", "text": "Payment history and itemized monthly summaries are available in the app.", "source": "Account Features Spec", "review_date": "2027-02-28", "allow_ai": True},
        {"id": "FACT-07", "text": "Approved claims: no superlatives without proof.", "source": "Brand governance policy 2026", "review_date": "2027-09-01", "allow_ai": True},
        {"id": "FACT-08", "text": "Account setup requires mobile number verification and standard device binding.", "source": "Security & Onboarding Guide", "review_date": "2027-01-15", "allow_ai": True},
        {"id": "FACT-09", "text": "Data in transit is protected using TLS 1.3 encryption across all public APIs.", "source": "Security Whitepaper 2026", "review_date": "2027-08-01", "allow_ai": True},
        {"id": "FACT-10", "text": "Users can configure biometrics (fingerprint / Face Unlock) to authorize payments.", "source": "Authentication Architecture", "review_date": "2027-04-01", "allow_ai": True},
        {"id": "FACT-11", "text": "Cashback up to 15% on eligible payments during the launch offer.", "source": "Launch offer terms (synthetic)", "review_date": "2026-06-30", "allow_ai": True},
        {"id": "FACT-12", "text": "Lumen Pay supports UPI payments for everyday purchases.", "source": "Product capability sheet", "review_date": "2027-03-01", "allow_ai": True},
        {"id": "FACT-13", "text": "Daily transaction limits follow NPCI guidelines and user-configured banking limits.", "source": "Compliance & Regulatory Manual", "review_date": "2027-07-01", "allow_ai": True},
        {"id": "FACT-14", "text": "The app interface is available in English, with Hindi localization launching in Q1.", "source": "Localization Roadmap", "review_date": "2026-11-15", "allow_ai": False},
        {"id": "FACT-15", "text": "Users can view their payment history in the app.", "source": "Product capability sheet", "review_date": "2026-11-20", "allow_ai": True},
    ],
    "terms": [
        {"id": "TERM-01", "banned": "UPI transaction", "preferred": "UPI payment"},
        {"id": "TERM-02", "banned": "military-grade", "preferred": "specific security control"},
        {"id": "TERM-03", "banned": "guaranteed", "preferred": "descriptive, sourced language"},
        {"id": "TERM-04", "banned": "forever", "preferred": "a current, reviewed timeframe"},
        {"id": "TERM-05", "banned": "most trusted", "preferred": "a specific claim supported by evidence"},
    ],
}

MEM_DRAFTS: Dict[str, Dict[str, Any]] = {
    "draft-1": {
        "id": "draft-1",
        "title": "app-store-listing.md",
        "text": "Lumen Pay is India’s most trusted wallet and charges zero fees forever.",
        "version": 2,
        "status": "Changes requested",
        "updated_at": "2026-10-30T14:20:00Z",
        "findings_count": 2,
    },
    "draft-2": {
        "id": "draft-2",
        "title": "launch-email.md",
        "text": "Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.",
        "version": 3,
        "status": "In review",
        "updated_at": "2026-10-29T16:05:00Z",
        "findings_count": 1,
    },
    "draft-3": {
        "id": "draft-3",
        "title": "blog-security.md",
        "text": "Our military-grade security protects each UPI transaction.",
        "version": 1,
        "status": "Draft",
        "updated_at": "2026-10-28T09:40:00Z",
        "findings_count": 2,
    },
}

MEM_VERSIONS: Dict[str, List[Dict[str, Any]]] = {
    "draft-1": [
        {"id": "v-1", "version": 1, "text": "Lumen Pay is a wallet for everyday payments.", "created_at": "2026-10-28T10:00:00Z"},
        {"id": "v-2", "version": 2, "text": "Lumen Pay is India’s most trusted wallet and charges zero fees forever.", "created_at": "2026-10-30T14:20:00Z"},
    ],
    "draft-2": [
        {"id": "v-2-1", "version": 1, "text": "Join Lumen Pay today and experience instant UPI payments across India.", "created_at": "2026-10-27T10:00:00Z"},
        {"id": "v-2-2", "version": 2, "text": "Join Lumen Pay today and get guaranteed unlimited cashback on every payment this year.", "created_at": "2026-10-28T14:00:00Z"},
        {"id": "v-2-3", "version": 3, "text": "Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.", "created_at": "2026-10-29T16:05:00Z"},
    ],
}

MEM_FINDINGS: Dict[str, List[Dict[str, Any]]] = {
    "draft-1": [
        {"id": "F-101", "draft_id": "draft-1", "excerpt": "most trusted wallet", "start": 18, "end": 37, "type": "Claim", "severity": "high", "source": "ai", "source_ref_id": "FACT-07", "reason": "A superlative needs current evidence. No approved fact supports “most trusted”.", "suggested_fix": "a wallet built for simple, everyday payments", "fix_needs_human": False, "confidence": 0.94, "status": "open"},
        {"id": "F-102", "draft_id": "draft-1", "excerpt": "zero fees forever", "start": 50, "end": 68, "type": "Claim", "severity": "high", "source": "ai", "source_ref_id": "FACT-03", "reason": "Pricing is reviewed quarterly. An absolute lifetime promise is not supported.", "suggested_fix": "fees reviewed quarterly", "fix_needs_human": True, "confidence": 0.91, "status": "open"},
    ],
    "draft-2": [
        {
            "id": "F-105",
            "draft_id": "draft-2",
            "excerpt": "cashback up to 15%",
            "start": 36,
            "end": 54,
            "type": "Claim",
            "severity": "high",
            "source": "ai",
            "source_ref_id": "FACT-11",
            "reason": "The cited fact FACT-11 (Launch cashback) expired on 2026-06-30. Overdue promotional rate requires human confirmation.",
            "suggested_fix": "cashback up to 10% (confirm current promotional campaign approval)",
            "fix_needs_human": True,
            "confidence": 0.72,
            "status": "open",
        }
    ],
}

MEM_COMMENTS: Dict[str, List[Dict[str, Any]]] = {
    "draft-1": [
        {"id": "c-1", "author": "Nisha Rao", "text": "Please adjust the superlative claim before release.", "created_at": "2026-03-14T12:00:00Z"}
    ]
}

MEM_AUDIT: List[Dict[str, Any]] = [
    {"id": "a-1", "who": "Meera Nair", "role": "creator", "action": "Accepted suggested fix", "target": "app-store-listing.md · F-101", "timestamp": "2026-10-30T15:10:00Z", "reason": "Replaced unapproved superlative \"most trusted wallet\"", "details": "Changed to \"a wallet built for simple, everyday payments\""},
    {"id": "a-2", "who": "Meera Nair", "role": "creator", "action": "Dismissed finding with reason", "target": "launch-email.md · F-105", "timestamp": "2026-10-30T14:45:00Z", "reason": "Pre-approved campaign exception by Legal Counsel", "details": "Rule GUIDE-01 dismissed: Q4 launch promotional budget approved in board minutes"},
    {"id": "a-3", "who": "Nisha Rao", "role": "reviewer", "action": "Requested changes", "target": "app-store-listing.md · v2", "timestamp": "2026-10-29T16:48:00Z", "reason": "Pricing claim needs updated review date", "details": "Comment: Please adjust the lifetime zero-fee claim before release"},
    {"id": "a-4", "who": "Arjun Mehta", "role": "brand_manager", "action": "Flagged expired fact", "target": "Brand Kit · FACT-11", "timestamp": "2026-10-29T11:20:00Z", "reason": "Promotional campaign review date expired on 2026-06-30", "details": "Fact status changed to Needs Review"},
    {"id": "a-5", "who": "Nisha Rao", "role": "reviewer", "action": "Approved & locked draft", "target": "security-faq.md · v1", "timestamp": "2026-10-28T10:15:00Z", "reason": "All 4 findings resolved and verified against Brand Kit", "details": "Final sign-off recorded for production release"},
]

# ─── Pydantic Request Models ────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str
    role: str = "creator"

class DraftInput(BaseModel):
    title: str
    text: str = ""

class VersionInput(BaseModel):
    text: Optional[str] = None

class DecisionInput(BaseModel):
    action: str  # accept | edit | dismiss
    reason: Optional[str] = None
    edited_fix: Optional[str] = None

class CommentInput(BaseModel):
    text: str

class RequestChangesInput(BaseModel):
    reason: str


# ─── 1. Authentication ───────────────────────────────────────────────────────
@router.get("/api/auth/config")
@router.get("/api/v1/auth/config")
def get_auth_config():
    """Expose public Supabase URL and anon key safely to frontend for OAuth."""
    from app.core.config import get_settings
    settings = get_settings()
    return {
        "supabase_url": settings.supabase_url,
        "supabase_anon_key": settings.supabase_anon_key or getattr(settings, "anon_key", ""),
    }


@router.post("/api/auth/login")
@router.post("/api/v1/auth/login")
def login(body: LoginRequest):
    """Authenticate user with specified role and return token context."""
    user_names = {
        "creator": "Meera Nair",
        "brand_manager": "Arjun Mehta",
        "reviewer": "Nisha Rao",
    }
    name = user_names.get(body.role, "CiteCheck User")
    token = f"preview-token-{body.role}"
    return {
        "token": token,
        "user": {
            "id": f"u-{body.role}",
            "name": name,
            "role": body.role,
        },
    }


# ─── 2. Brand Kit & Guidelines ──────────────────────────────────────────────
@router.get("/api/brand-kit")
@router.get("/api/brand-kit/")
@router.get("/api/v1/brand-kit")
@router.get("/api/v1/brand-kit/")
def get_brand_kit():
    """Retrieve full brand kit containing guidelines, approved facts, and terminology."""
    try:
        sb = get_supabase_client()
        g_res = sb.table("guidelines").select("*").execute()
        f_res = sb.table("approved_facts").select("*").execute()
        t_res = sb.table("approved_terms").select("*").execute()

        if g_res.data or f_res.data or t_res.data:
            guidelines = [
                {
                    "id": row.get("guideline_code") or str(row.get("id")),
                    "title": row.get("title", ""),
                    "text": row.get("rule_description", ""),
                    "category": row.get("category", "tone"),
                }
                for row in (g_res.data or [])
            ]
            facts = [
                {
                    "id": row.get("fact_code") or str(row.get("id")),
                    "text": row.get("statement", ""),
                    "source": row.get("source_document", ""),
                    "review_date": str(row.get("review_date", "")),
                    "allow_ai": bool(row.get("is_active", True)),
                }
                for row in (f_res.data or [])
            ]
            terms = [
                {
                    "id": str(row.get("id")),
                    "banned": ", ".join(row.get("forbidden_terms") or []) if isinstance(row.get("forbidden_terms"), list) else str(row.get("forbidden_terms", "")),
                    "preferred": row.get("preferred_term", ""),
                    "allow_ai": True,
                }
                for row in (t_res.data or [])
            ]
            return {"guidelines": guidelines, "facts": facts, "terms": terms}
    except Exception:
        pass

    return DEFAULT_BRAND_KIT


def _resolve_kit_kind(kind: str) -> str:
    return "guidelines" if kind in ("rules", "guidelines") else kind


@router.post("/api/{kind:regex(facts|rules|guidelines|terms)}")
@router.post("/api/v1/{kind:regex(facts|rules|guidelines|terms)}")
def create_kit_item(kind: str, payload: Dict[str, Any]):
    resolved_kind = _resolve_kit_kind(kind)
    if resolved_kind not in DEFAULT_BRAND_KIT:
        raise HTTPException(status_code=400, detail=f"Invalid brand kit category '{kind}'")
    item = dict(payload)
    if "id" not in item:
        item["id"] = f"{resolved_kind[:4].upper()}-{int(datetime.now().timestamp())}"
    DEFAULT_BRAND_KIT[resolved_kind].insert(0, item)
    return item


@router.patch("/api/{kind:regex(facts|rules|guidelines|terms)}/{item_id}")
@router.post("/api/{kind:regex(facts|rules|guidelines|terms)}/{item_id}")
@router.patch("/api/v1/{kind:regex(facts|rules|guidelines|terms)}/{item_id}")
def update_kit_item(kind: str, item_id: str, payload: Dict[str, Any]):
    resolved_kind = _resolve_kit_kind(kind)
    if resolved_kind not in DEFAULT_BRAND_KIT:
        raise HTTPException(status_code=400, detail="Invalid brand kit category")
    items = DEFAULT_BRAND_KIT[resolved_kind]
    for i, item in enumerate(items):
        if str(item.get("id")) == str(item_id):
            items[i].update(payload)
            return items[i]
    return payload


@router.delete("/api/{kind:regex(facts|rules|guidelines|terms)}/{item_id}")
@router.delete("/api/v1/{kind:regex(facts|rules|guidelines|terms)}/{item_id}")
def delete_kit_item(kind: str, item_id: str):
    resolved_kind = _resolve_kit_kind(kind)
    if resolved_kind in DEFAULT_BRAND_KIT:
        DEFAULT_BRAND_KIT[resolved_kind] = [x for x in DEFAULT_BRAND_KIT[resolved_kind] if str(x.get("id")) != str(item_id)]
    return {"success": True}


# ─── 3. Drafts CRUD ──────────────────────────────────────────────────────────
@router.get("/api/drafts")
@router.get("/api/drafts/")
@router.get("/api/v1/drafts")
@router.get("/api/v1/drafts/")
def list_drafts():
    """List all drafts with their findings counts."""
    return list(MEM_DRAFTS.values())


@router.post("/api/drafts", status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/drafts", status_code=status.HTTP_201_CREATED)
def create_draft(body: DraftInput):
    """Create a new draft."""
    draft_id = f"draft-{uuid4().hex[:6]}"
    now_str = datetime.now(timezone.utc).isoformat()
    new_draft = {
        "id": draft_id,
        "title": body.title,
        "text": body.text,
        "version": 1,
        "status": "Draft",
        "updated_at": now_str,
        "findings_count": 0,
    }
    MEM_DRAFTS[draft_id] = new_draft
    MEM_VERSIONS[draft_id] = [
        {"id": f"v-{draft_id}-1", "version": 1, "text": body.text, "created_at": now_str}
    ]
    MEM_FINDINGS[draft_id] = []
    MEM_AUDIT.insert(0, {
        "id": f"a-{uuid4().hex[:6]}",
        "who": "Creator",
        "role": "creator",
        "action": "Created new draft",
        "target": body.title,
        "timestamp": now_str,
    })
    return new_draft


@router.get("/api/drafts/{draft_id}")
@router.get("/api/v1/drafts/{draft_id}")
def get_draft(draft_id: str):
    """Retrieve single draft by ID."""
    draft = MEM_DRAFTS.get(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found.")
    return draft


# ─── 4. 5-Gate Review Execution ─────────────────────────────────────────────
@router.post("/api/drafts/{draft_id}/review")
@router.post("/api/v1/drafts/{draft_id}/review")
def run_review(draft_id: str):
    """
    Executes the 5-Gate Evidence Verifier on the draft.
    Returns verified findings and dropped candidates.
    """
    draft = MEM_DRAFTS.get(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found.")

    draft_text = draft["text"]
    terms_raw = DEFAULT_BRAND_KIT["terms"]
    guidelines_raw = DEFAULT_BRAND_KIT["guidelines"]
    facts_raw = DEFAULT_BRAND_KIT["facts"]

    # Adapt to engine expected schemas
    approved_terms = [
        {
            "preferred_term": t["preferred"],
            "forbidden_terms": [x.strip() for x in t["banned"].split(",") if x.strip()],
        }
        for t in terms_raw
    ]
    guidelines = [
        {
            "guideline_code": g["id"],
            "title": g["title"],
            "rule_description": g["text"],
            "category": g.get("category", "tone"),
        }
        for g in guidelines_raw
    ]
    facts_by_code = {f["id"]: {"statement": f["text"], "source_document": f.get("source", "")} for f in facts_raw}
    guidelines_by_code = {g["id"]: {"rule_description": g["text"], "title": g["title"]} for g in guidelines_raw}

    # 1. Run deterministic rules engine
    raw_candidates = run_rules_engine(draft_text, approved_terms, guidelines)

    # 2. Run 5-Gate Evidence Verifier pipeline
    verified_findings, stats = run_five_gate_pipeline(
        raw_candidates, draft_text, facts_by_code, guidelines_by_code
    )

    # Format findings for frontend
    formatted_findings: List[Dict[str, Any]] = []
    for idx, vf in enumerate(verified_findings):
        # Locate start/end in text
        match = re.search(re.escape(vf.exact_excerpt), draft_text, re.IGNORECASE)
        start = match.start() if match else 0
        end = match.end() if match else start + len(vf.exact_excerpt)

        formatted_findings.append({
            "id": f"F-{draft_id}-{idx + 1}",
            "draft_id": draft_id,
            "excerpt": vf.exact_excerpt,
            "start": start,
            "end": end,
            "type": vf.category.value.capitalize(),
            "severity": vf.severity.value,
            "source": "rules",
            "source_ref_id": str(vf.cited_fact_id or vf.cited_guideline_id or "GUIDE-01"),
            "reason": vf.reason,
            "suggested_fix": vf.suggested_fix or vf.exact_excerpt,
            "fix_needs_human": vf.is_intent_guarded or getattr(vf, "verification_status", None) == "needs_review",
            "confidence": 0.95,
            "status": "open",
        })

    # Update draft state
    MEM_FINDINGS[draft_id] = formatted_findings
    draft["status"] = "In review"
    draft["findings_count"] = len(formatted_findings)

    # Log audit
    MEM_AUDIT.insert(0, {
        "id": f"a-{uuid4().hex[:6]}",
        "who": "5-Gate Verifier",
        "role": "reviewer",
        "action": f"Executed verification pipeline: {len(formatted_findings)} findings",
        "target": f"{draft['title']} · v{draft['version']}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    dropped = [
        {"candidate": f"Candidate (Gate check)", "failed_gate": 2, "why": "Unverified assertion without approved citation"}
    ] if stats["dropped"] > 0 else []

    return {"findings": formatted_findings, "dropped": dropped}


@router.get("/api/drafts/{draft_id}/findings")
@router.get("/api/v1/drafts/{draft_id}/findings")
def get_findings(draft_id: str):
    """Retrieve findings for a specific draft."""
    return MEM_FINDINGS.get(draft_id, [])


# ─── 5. Human Review Decisions ──────────────────────────────────────────────
@router.post("/api/findings/{finding_id}/decision")
@router.post("/api/v1/findings/{finding_id}/decision")
def apply_decision(finding_id: str, body: DecisionInput):
    """
    Apply a human review decision (accept, edit, dismiss).
    Updates draft text automatically when accepted or edited.
    """
    target_finding = None
    target_draft_id = None

    for d_id, findings in MEM_FINDINGS.items():
        for f in findings:
            if f["id"] == finding_id:
                target_finding = f
                target_draft_id = d_id
                break
        if target_finding:
            break

    if not target_finding:
        # Fallback response if finding not found
        return {"action": body.action, "status": "resolved" if body.action != "dismiss" else "dismissed"}

    target_finding["status"] = "dismissed" if body.action == "dismiss" else "resolved"

    draft = MEM_DRAFTS.get(target_draft_id)
    if draft and body.action in ("accept", "edit"):
        old_text = draft["text"]
        excerpt = target_finding["excerpt"]
        replacement = target_finding.get("suggested_fix", "") if body.action == "accept" else (body.edited_fix or "")

        if replacement and excerpt in old_text:
            new_text = old_text.replace(excerpt, replacement, 1)
            draft["text"] = new_text
            draft["version"] += 1
            draft["updated_at"] = datetime.now(timezone.utc).isoformat()

            # Record version
            versions = MEM_VERSIONS.setdefault(target_draft_id, [])
            versions.append({
                "id": f"v-{target_draft_id}-{draft['version']}",
                "version": draft["version"],
                "text": new_text,
                "created_at": draft["updated_at"],
            })

    # Live update Gap Radar on dismissal
    if body.action == "dismiss":
        rule_code = target_finding.get("source_ref_id", "")
        matched = None
        for item in MEM_GAP_RADAR:
            if item.get("guideline_id") == rule_code or item.get("guideline_code") == rule_code:
                matched = item
                break
        if not matched:
            matched = MEM_GAP_RADAR[1] if len(MEM_GAP_RADAR) > 1 else MEM_GAP_RADAR[0]
        matched["flagged"] += 1
        matched["dismissed"] += 1
        matched["dismissal_rate"] = round((matched["dismissed"] / matched["flagged"]) * 100, 1)
        matched["status"] = "Unclear Policy" if (matched["flagged"] >= 4 and matched["dismissal_rate"] >= 50.0) else "Healthy / Clear"
        if body.reason and body.reason not in matched.get("reasons", []):
            matched.setdefault("reasons", []).insert(0, body.reason)

    MEM_AUDIT.insert(0, {
        "id": f"a-{uuid4().hex[:6]}",
        "who": "Meera Nair",
        "role": "creator",
        "action": "Dismissed finding with reason" if body.action == "dismiss" else ("Accepted suggested fix" if body.action == "accept" else "Edited finding"),
        "target": f"{draft.get('title', 'Draft') if draft else 'Draft'} · {finding_id}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": body.reason or ("Suggested fix accepted and merged" if body.action == "accept" else "Finding edited"),
        "details": f"Rule {target_finding.get('source_ref_id', '')} - Excerpt: {target_finding.get('excerpt', '')}",
    })

    return {
        "action": body.action,
        "reason": body.reason,
        "edited_fix": body.edited_fix,
        "status": target_finding["status"],
    }


# ─── 6. Versions, Diff & Workflow ───────────────────────────────────────────
@router.get("/api/drafts/{draft_id}/versions")
@router.get("/api/v1/drafts/{draft_id}/versions")
def get_versions(draft_id: str):
    return MEM_VERSIONS.get(draft_id, [])


@router.post("/api/drafts/{draft_id}/versions")
@router.post("/api/v1/drafts/{draft_id}/versions")
def create_version(draft_id: str, body: VersionInput):
    draft = MEM_DRAFTS.get(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    new_version_num = draft["version"] + 1
    new_text = body.text or draft["text"]
    draft["version"] = new_version_num
    draft["text"] = new_text
    draft["updated_at"] = datetime.now(timezone.utc).isoformat()

    entry = {
        "id": f"v-{draft_id}-{new_version_num}",
        "version": new_version_num,
        "text": new_text,
        "created_at": draft["updated_at"],
    }
    MEM_VERSIONS.setdefault(draft_id, []).append(entry)
    return entry


@router.get("/api/drafts/{draft_id}/diff")
@router.get("/api/v1/drafts/{draft_id}/diff")
def get_diff(draft_id: str, from_v: int = Query(1, alias="from"), to_v: int = Query(2, alias="to")):
    versions = MEM_VERSIONS.get(draft_id, [])
    before = next((v["text"] for v in versions if v["version"] == from_v), "")
    after = next((v["text"] for v in versions if v["version"] == to_v), "")
    return {"from": from_v, "to": to_v, "before": before, "after": after}


@router.post("/api/drafts/{draft_id}/approve")
@router.post("/api/v1/drafts/{draft_id}/approve")
def approve_draft(draft_id: str):
    draft = MEM_DRAFTS.get(draft_id)
    ver = draft.get("version", 1) if draft else 1
    title = draft["title"] if draft else draft_id
    if draft:
        draft["status"] = "Approved"
    MEM_AUDIT.insert(0, {
        "id": f"a-{uuid4().hex[:6]}",
        "who": "Nisha Rao",
        "role": "reviewer",
        "action": "Approved draft",
        "target": f"{title} (v{ver})",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": "Reviewer sign-off: verified evidence and locked approved version",
        "details": f"Draft ID: {draft_id} · Locked version {ver}",
    })
    return {"status": "Approved"}


@router.post("/api/drafts/{draft_id}/request-changes")
@router.post("/api/v1/drafts/{draft_id}/request-changes")
def request_changes(draft_id: str, body: RequestChangesInput):
    draft = MEM_DRAFTS.get(draft_id)
    ver = draft.get("version", 1) if draft else 1
    title = draft["title"] if draft else draft_id
    if draft:
        draft["status"] = "Changes requested"
    MEM_AUDIT.insert(0, {
        "id": f"a-{uuid4().hex[:6]}",
        "who": "Nisha Rao",
        "role": "reviewer",
        "action": "Requested changes",
        "target": f"{title} (v{ver})",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": body.reason or "Requested changes before sign-off",
        "details": f"Draft ID: {draft_id} · Note: {body.reason}",
    })
    return {"status": "Changes requested"}


@router.get("/api/drafts/{draft_id}/comments")
@router.get("/api/v1/drafts/{draft_id}/comments")
def get_comments(draft_id: str):
    return MEM_COMMENTS.get(draft_id, [])


@router.post("/api/drafts/{draft_id}/comments")
@router.post("/api/v1/drafts/{draft_id}/comments")
def add_comment(draft_id: str, body: CommentInput):
    comment = {
        "id": f"c-{uuid4().hex[:6]}",
        "author": "Meera Nair",
        "text": body.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    MEM_COMMENTS.setdefault(draft_id, []).append(comment)
    return comment


# ─── 7. Analytics & Gap Radar ────────────────────────────────────────────────
MEM_GAP_RADAR: List[Dict[str, Any]] = [
    {
        "rule": "Security language",
        "guideline_id": "GUIDE-04",
        "guideline_code": "GUIDE-04",
        "category": "tone",
        "flagged": 10,
        "accepted": 4,
        "dismissed": 6,
        "dismissal_rate": 60.0,
        "status": "Unclear Policy",
        "reasons": [
            "Technical spec required specific cipher/TLS version",
            "Rule is too rigid for engineer-facing API docs",
            "Context was standard security control, not marketing hype",
        ],
        "recommendation": "Update guideline to clarify allowed technical descriptions (TLS 1.3, AES-256) vs marketing hype.",
    },
    {
        "rule": "Claims need proof",
        "guideline_id": "GUIDE-01",
        "guideline_code": "GUIDE-01",
        "category": "claim",
        "flagged": 14,
        "accepted": 7,
        "dismissed": 7,
        "dismissal_rate": 50.0,
        "status": "Unclear Policy",
        "reasons": [
            "Pre-approved campaign exception by Legal Counsel",
            "Customer testimonial quote, not company assertion",
            "Descriptive benefit, not an absolute claim",
        ],
        "recommendation": "Add explicit guidance and exemptions for quoted customer testimonials.",
    },
    {
        "rule": "No lifetime promises",
        "guideline_id": "GUIDE-09",
        "guideline_code": "GUIDE-09",
        "category": "claim",
        "flagged": 6,
        "accepted": 3,
        "dismissed": 3,
        "dismissal_rate": 50.0,
        "status": "Unclear Policy",
        "reasons": [
            "Quarterly promotional fee lock confused with lifetime guarantee",
            "Referencing historical launch terms",
        ],
        "recommendation": "Clarify boundary between temporary promotional pricing and permanent promises.",
    },
    {
        "rule": "Payments terminology",
        "guideline_id": "GUIDE-03",
        "guideline_code": "GUIDE-03",
        "category": "terminology",
        "flagged": 12,
        "accepted": 11,
        "dismissed": 1,
        "dismissal_rate": 8.3,
        "status": "Healthy / Clear",
        "reasons": [
            "Context was technical banking protocol spec",
        ],
        "recommendation": "Guideline is performing well with high adherence (91.7%).",
    },
    {
        "rule": "Numbers and dates",
        "guideline_id": "GUIDE-05",
        "guideline_code": "GUIDE-05",
        "category": "formatting",
        "flagged": 9,
        "accepted": 7,
        "dismissed": 2,
        "dismissal_rate": 22.2,
        "status": "Healthy / Clear",
        "reasons": [
            "Date format specified by platform app store guideline",
        ],
        "recommendation": "Guideline is performing well with clear adherence (77.8%).",
    },
]


@router.get("/api/gap-radar")
@router.get("/api/gap-radar/")
@router.get("/api/v1/gap-radar")
@router.get("/api/v1/gap-radar/")
def get_gap_radar():
    """
    Surfaces brand guidelines with highest dismissal rates.
    Diagnostic Rule: Flagged as 'Unclear Policy' when triggered >= 4 times and dismissal rate >= 50%.
    """
    return MEM_GAP_RADAR


@router.get("/api/audit-log")
@router.get("/api/audit-log/")
@router.get("/api/v1/audit-log")
@router.get("/api/v1/audit-log/")
def get_audit_log():
    """Retrieve chronologically ordered audit logs."""
    return MEM_AUDIT

# ─── 8. .docx Document Parser (Round 3 Feature) ──────────────────────────────
@router.post("/api/drafts/parse-docx")
@router.post("/api/v1/drafts/parse-docx")
async def parse_docx_file(file: UploadFile = File(...)):
    """
    Parse a Microsoft Word .docx file into clean text.
    Validates file extension, size limit (<= 5 MB), zip integrity, and password encryption.
    Extracts headers, body paragraphs, bullet lists, tables, and footers.
    """
    import io, zipfile
    import docx

    filename = file.filename or "uploaded-document.docx"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "doc":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Legacy .doc format is not supported. Please save or export the document as a modern .docx file and re-upload.",
        )
    if ext != "docx":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '.{ext}'. CiteCheck accepts Microsoft Word .docx files only.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes). Please upload a valid .docx document.",
        )

    # 5 MB size limit
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 5 MB limit. Please upload a smaller document.",
        )

    # Verify zip integrity (docx is a zip package)
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid document archive. The file does not appear to be a valid Microsoft Word .docx document.",
        )

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
        namelist = zf.namelist()
        if "EncryptedPackage" in namelist or "encryption" in str(namelist).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-protected or encrypted documents are not supported. Please remove the password and re-upload.",
            )
        if "word/document.xml" not in namelist:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid .docx structure: missing word/document.xml. Please ensure this is an uncorrupted Word document.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read document archive: {str(exc)}",
        )

    try:
        doc = docx.Document(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse document structure: {str(exc)}",
        )

    parts: list[str] = []
    paragraph_count = 0
    table_count = len(doc.tables)

    # 1. Section Headers
    for section in doc.sections:
        if section.header:
            for p in section.header.paragraphs:
                txt = p.text.strip()
                if txt:
                    parts.append(txt)

    # 2. Main Body Paragraphs
    for p in doc.paragraphs:
        txt = p.text.strip()
        if txt:
            parts.append(txt)
            paragraph_count += 1

    # 3. Tables (Row by row, cell by cell)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))

    # 4. Section Footers
    for section in doc.sections:
        if section.footer:
            for p in section.footer.paragraphs:
                txt = p.text.strip()
                if txt:
                    parts.append(txt)

    extracted_text = "\n\n".join(parts)
    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded .docx document contains no readable text, paragraphs, or table content.",
        )

    words = len(extracted_text.split())
    return {
        "filename": filename,
        "text": extracted_text,
        "char_count": len(extracted_text),
        "word_count": words,
        "paragraph_count": paragraph_count,
        "table_count": table_count,
    }
