"""
CiteCheck AI — Dynamic Seed Demo Dataset Generator.

Generates realistic, relative-to-today demo data so the live demo never goes stale.
Can be executed standalone:
    python -m backend.scripts.seed_demo
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import hashlib
from typing import Any, Dict, List
from uuid import uuid4


def compute_audit_hash(prev_hash: str, timestamp: str, who: str, role: str, action: str, target: str, reason: str, details: str) -> str:
    content = f"{prev_hash}|{timestamp}|{who}|{role}|{action}|{target}|{reason}|{details}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def generate_seed_data() -> Dict[str, Any]:
    today = datetime.now(timezone.utc).date()
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()

    # Relative dates
    d_expired_4 = (today - timedelta(days=4)).isoformat()
    d_expired_18 = (today - timedelta(days=18)).isoformat()
    d_expiring_7 = (today + timedelta(days=7)).isoformat()
    d_expiring_21 = (today + timedelta(days=21)).isoformat()
    d_active_90 = (today + timedelta(days=90)).isoformat()
    d_active_180 = (today + timedelta(days=180)).isoformat()
    d_active_365 = (today + timedelta(days=365)).isoformat()

    # 1. Guidelines
    guidelines = [
        {
            "id": "GUIDE-01",
            "title": "Claims need proof",
            "text": "Never use superlatives unless supported by an approved, current fact.",
            "category": "claim",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-02",
            "title": "Plainspoken confidence",
            "text": "Use clear, useful language. Avoid guarantees and absolute promises.",
            "category": "tone",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-03",
            "title": "Payments terminology",
            "text": "Say “UPI payment”, not “UPI transaction”.",
            "category": "terminology",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-04",
            "title": "Security language",
            "text": "Do not use “military-grade”. Describe specific controls instead.",
            "category": "tone",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-05",
            "title": "Numbers and dates",
            "text": "Promotional values and eligibility always need a current source.",
            "category": "formatting",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-06",
            "title": "Human review",
            "text": "A reviewer must decide any change to a number, date, or named entity.",
            "category": "tone",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-07",
            "title": "Respectful tone",
            "text": "Avoid fear-based language and pressure tactics.",
            "category": "tone",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-08",
            "title": "Product naming",
            "text": "Use Lumen Pay on first mention; Lumen thereafter.",
            "category": "terminology",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-09",
            "title": "No lifetime promises",
            "text": "Do not promise a price or feature will never change.",
            "category": "claim",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
        {
            "id": "GUIDE-10",
            "title": "Accessibility",
            "text": "Use short sentences and explain specialist terms.",
            "category": "accessibility",
            "created_at": (now_dt - timedelta(days=60)).isoformat(),
        },
    ]

    # 2. Approved Facts
    facts = [
        {
            "id": "FACT-01",
            "text": "Lumen Pay is a digital wallet built for simple, secure everyday UPI payments.",
            "source": "Product Overview v2",
            "effective_from": (today - timedelta(days=120)).isoformat(),
            "expires_on": d_active_365,
            "review_date": d_active_365,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 1,
            "tags": ["core", "positioning"],
        },
        {
            "id": "FACT-02",
            "text": "Users can link bank accounts via UPI to pay merchant QR codes and contacts.",
            "source": "Payments Specification 2026",
            "effective_from": (today - timedelta(days=90)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["payments", "upi"],
        },
        {
            "id": "FACT-03",
            "text": "Pricing: fees are reviewed quarterly; no lifetime zero-fee promises.",
            "source": "Lumen Pay pricing policy Q3",
            "effective_from": (today - timedelta(days=110)).isoformat(),
            "expires_on": d_expired_18,
            "review_date": d_expired_18,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["pricing", "compliance"],
        },
        {
            "id": "FACT-04",
            "text": "Every payment generates an instant in-app digital receipt with UTR.",
            "source": "Core Payments Engine Doc",
            "effective_from": (today - timedelta(days=90)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["receipts"],
        },
        {
            "id": "FACT-05",
            "text": "Customer support is accessible 24/7 directly within the Lumen Pay mobile application.",
            "source": "In-App Support SLA",
            "effective_from": (today - timedelta(days=100)).isoformat(),
            "expires_on": d_active_365,
            "review_date": d_active_365,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 2,
            "tags": ["support", "sla"],
        },
        {
            "id": "FACT-06",
            "text": "Payment history and itemized monthly summaries are available in the app.",
            "source": "Account Features Spec",
            "effective_from": (today - timedelta(days=60)).isoformat(),
            "expires_on": d_active_90,
            "review_date": d_active_90,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["account"],
        },
        {
            "id": "FACT-07",
            "text": "Approved claims: no superlatives without verifiable market share audits.",
            "source": "Brand governance policy 2026",
            "effective_from": (today - timedelta(days=150)).isoformat(),
            "expires_on": d_active_365,
            "review_date": d_active_365,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 1,
            "tags": ["governance", "claims"],
        },
        {
            "id": "FACT-08",
            "text": "Account setup requires mobile number verification and standard device binding.",
            "source": "Security & Onboarding Guide",
            "effective_from": (today - timedelta(days=120)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["security", "onboarding"],
        },
        {
            "id": "FACT-09",
            "text": "Data in transit is protected using TLS 1.3 encryption across all public APIs.",
            "source": "Security Whitepaper 2026",
            "effective_from": (today - timedelta(days=180)).isoformat(),
            "expires_on": d_active_365,
            "review_date": d_active_365,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 1,
            "tags": ["security", "encryption"],
        },
        {
            "id": "FACT-10",
            "text": "Users can configure biometrics (fingerprint / Face Unlock) to authorize payments.",
            "source": "Authentication Architecture",
            "effective_from": (today - timedelta(days=70)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["biometrics", "auth"],
        },
        {
            "id": "FACT-11",
            "text": "Cashback up to 15% on eligible payments during the launch offer.",
            "source": "Launch offer terms (synthetic)",
            "effective_from": (today - timedelta(days=90)).isoformat(),
            "expires_on": d_expired_4,
            "review_date": d_expired_4,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["promotions", "cashback"],
        },
        {
            "id": "FACT-12",
            "text": "Lumen Pay supports UPI payments for everyday purchases.",
            "source": "Product capability sheet",
            "effective_from": (today - timedelta(days=80)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["core"],
        },
        {
            "id": "FACT-13",
            "text": "Daily transaction limits follow NPCI guidelines and user-configured banking limits.",
            "source": "Compliance & Regulatory Manual",
            "effective_from": (today - timedelta(days=120)).isoformat(),
            "expires_on": d_active_180,
            "review_date": d_active_180,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["limits", "npci"],
        },
        {
            "id": "FACT-14",
            "text": "The app interface is available in English, with Hindi localization launching in Q1.",
            "source": "Localization Roadmap",
            "effective_from": (today - timedelta(days=45)).isoformat(),
            "expires_on": d_expiring_7,
            "review_date": d_expiring_7,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["roadmap", "localization"],
        },
        {
            "id": "FACT-15",
            "text": "Users can view their payment history in the app.",
            "source": "Product capability sheet",
            "effective_from": (today - timedelta(days=45)).isoformat(),
            "expires_on": d_expiring_21,
            "review_date": d_expiring_21,
            "is_active": True,
            "owner_id": "brand_manager",
            "owner_name": "Arjun Mehta",
            "renewal_count": 0,
            "tags": ["account"],
        },
    ]

    # 3. Approved Terminology
    terms = [
        {"id": "TERM-01", "banned": "UPI transaction", "preferred": "UPI payment", "usage_note": "Say UPI payment"},
        {"id": "TERM-02", "banned": "military-grade", "preferred": "specific security control", "usage_note": "Describe controls"},
        {"id": "TERM-03", "banned": "guaranteed", "preferred": "descriptive, sourced language", "usage_note": "No guarantees"},
        {"id": "TERM-04", "banned": "forever", "preferred": "a current, reviewed timeframe", "usage_note": "No forever promises"},
        {"id": "TERM-05", "banned": "most trusted", "preferred": "a specific claim supported by evidence", "usage_note": "Needs third-party audit"},
        {"id": "TERM-06", "banned": "zero fees", "preferred": "fees reviewed quarterly", "usage_note": "Pricing subject to periodic review"},
    ]

    # 4. Drafts & Versions
    drafts = {
        "draft-1": {
            "id": "draft-1",
            "title": "app-store-listing.md",
            "text": "Lumen Pay is India’s most trusted wallet and charges zero fees forever.",
            "version": 2,
            "status": "Changes requested",
            "updated_at": (now_dt - timedelta(hours=3)).isoformat(),
            "findings_count": 2,
            "open_findings_count": 1,
            "is_seed": True,
        },
        "draft-2": {
            "id": "draft-2",
            "title": "launch-email.md",
            "text": "Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.",
            "version": 3,
            "status": "In review",
            "updated_at": (now_dt - timedelta(hours=5)).isoformat(),
            "findings_count": 1,
            "open_findings_count": 1,
            "is_seed": True,
        },
        "draft-3": {
            "id": "draft-3",
            "title": "blog-security.md",
            "text": "Our military-grade security protects each UPI transaction.",
            "version": 1,
            "status": "Draft",
            "updated_at": (now_dt - timedelta(days=1)).isoformat(),
            "findings_count": 2,
            "open_findings_count": 2,
            "is_seed": True,
        },
        "draft-4": {
            "id": "draft-4",
            "title": "security-faq.md",
            "text": "Lumen Pay uses TLS 1.3 encryption and device binding for secure UPI payments.",
            "version": 1,
            "status": "Approved",
            "updated_at": (now_dt - timedelta(days=7)).isoformat(),
            "findings_count": 0,
            "open_findings_count": 0,
            "is_seed": True,
        },
    }

    versions = {
        "draft-1": [
            {"id": "v-1-1", "version": 1, "text": "Lumen Pay is a wallet for everyday payments.", "created_at": (now_dt - timedelta(days=2)).isoformat(), "locked": True, "locked_by": "Nisha Rao"},
            {"id": "v-1-2", "version": 2, "text": "Lumen Pay is India’s most trusted wallet and charges zero fees forever.", "created_at": (now_dt - timedelta(hours=3)).isoformat(), "locked": False},
        ],
        "draft-2": [
            {"id": "v-2-1", "version": 1, "text": "Join Lumen Pay today and experience instant UPI payments across India.", "created_at": (now_dt - timedelta(days=3)).isoformat(), "locked": True},
            {"id": "v-2-2", "version": 2, "text": "Join Lumen Pay today and get guaranteed unlimited cashback on every payment this year.", "created_at": (now_dt - timedelta(days=2)).isoformat(), "locked": True},
            {"id": "v-2-3", "version": 3, "text": "Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.", "created_at": (now_dt - timedelta(hours=5)).isoformat(), "locked": False},
        ],
        "draft-4": [],
        "draft-3": [
            {"id": "v-3-1", "version": 1, "text": "Our military-grade security protects each UPI transaction.", "created_at": (now_dt - timedelta(days=1)).isoformat(), "locked": False, "is_seed": True},
        ],
        "draft-4": [
            {"id": "v-4-1", "version": 1, "text": "Lumen Pay uses TLS 1.3 encryption and device binding for secure UPI payments.", "created_at": (now_dt - timedelta(days=7)).isoformat(), "locked": True, "locked_by": "Nisha Rao", "is_seed": True},
        ],
    }

    # 5. Verified Findings with Traces
    findings = {
        "draft-1": [
            {
                "id": "F-101",
                "draft_id": "draft-1",
                "version_number": 2,
                "excerpt": "most trusted",
                "start": 21,
                "end": 32,
                "type": "Claim",
                "category": "claim",
                "severity": "high",
                "source": "rules",
                "source_ref_id": "FACT-07",
                "reason": "A superlative needs current evidence. No approved fact supports “most trusted”.",
                "suggested_fix": "a wallet built for simple, everyday payments",
                "fix_needs_human": False,
                "confidence": 0.94,
                "status": "accepted",
                "paragraph_ref": "p-1",
                "verification_trace": [
                    {"gate": 1, "name": "Schema Validation", "result": "passed", "message": "Valid Pydantic candidate structure", "evidence": "Schema v2"},
                    {"gate": 2, "name": "Source Exists", "result": "passed", "message": "Cited FACT-07 and GUIDE-01 exist in active Brand Kit", "evidence": "FACT-07 (active)"},
                    {"gate": 3, "name": "Exact Quote", "result": "passed", "message": "Exact quote found at characters 21–32", "evidence": "'most trusted'"},
                    {"gate": 4, "name": "Fix Preserves Facts", "result": "passed", "message": "Fix introduces no hallucinated numbers or altered entities", "evidence": "Entities preserved"},
                    {"gate": 5, "name": "Freshness & Confidence", "result": "passed", "message": "Cited fact expires in 365 days; confidence 0.94 >= 0.80", "evidence": "Active"},
                ],
            },
            {
                "id": "F-102",
                "draft_id": "draft-1",
                "version_number": 2,
                "excerpt": "zero fees forever",
                "start": 51,
                "end": 68,
                "type": "Claim",
                "category": "claim",
                "severity": "high",
                "source": "rules",
                "source_ref_id": "FACT-03",
                "reason": "Pricing is reviewed quarterly. An absolute lifetime promise violates GUIDE-09.",
                "suggested_fix": "fees reviewed quarterly",
                "fix_needs_human": True,
                "confidence": 0.91,
                "status": "open",
                "paragraph_ref": "p-1",
                "verification_trace": [
                    {"gate": 1, "name": "Schema Validation", "result": "passed", "message": "Valid Pydantic candidate structure", "evidence": "Schema v2"},
                    {"gate": 2, "name": "Source Exists", "result": "passed", "message": "Cited FACT-03 exists in active Brand Kit", "evidence": "FACT-03"},
                    {"gate": 3, "name": "Exact Quote", "result": "passed", "message": "Exact quote found at characters 51–68", "evidence": "'zero fees forever'"},
                    {"gate": 4, "name": "Fix Preserves Facts", "result": "warning", "message": "Fix replaces lifetime guarantee with policy terms; requires human verification", "evidence": "fix_needs_human=true"},
                    {"gate": 5, "name": "Freshness & Confidence", "result": "blocked_expired_fact", "message": "Cited fact FACT-03 expired on " + d_expired_18, "evidence": "EXPIRED"},
                ],
            },
        ],
        "draft-2": [
            {
                "id": "F-105",
                "draft_id": "draft-2",
                "version_number": 3,
                "excerpt": "cashback up to 15%",
                "start": 36,
                "end": 54,
                "type": "Claim",
                "category": "claim",
                "severity": "high",
                "source": "rules",
                "source_ref_id": "FACT-11",
                "reason": f"The cited fact FACT-11 (Launch cashback) expired on {d_expired_4}. Promotional rate requires human renewal or override before approval.",
                "suggested_fix": "cashback up to 10% (confirm current promotional campaign approval)",
                "fix_needs_human": True,
                "confidence": 0.88,
                "status": "open",
                "verification_status": "blocked_expired_fact",
                "paragraph_ref": "p-1",
                "verification_trace": [
                    {"gate": 1, "name": "Schema Validation", "result": "passed", "message": "Valid schema format", "evidence": "Schema v2"},
                    {"gate": 2, "name": "Source Exists", "result": "passed", "message": "Cited FACT-11 exists in Brand Kit", "evidence": "FACT-11"},
                    {"gate": 3, "name": "Exact Quote", "result": "passed", "message": "Exact quote verified at characters 36–54", "evidence": "'cashback up to 15%'"},
                    {"gate": 4, "name": "Fix Preserves Facts", "result": "warning", "message": "Fix changes percentage from 15% to 10%; flagged for human review", "evidence": "15% -> 10%"},
                    {"gate": 5, "name": "Freshness & Confidence", "result": "blocked_expired_fact", "message": f"Blocked: FACT-11 expired on {d_expired_4}. Approval locked.", "evidence": "Expired Fact Block"},
                ],
            }
        ],
        "draft-3": [
            {
                "id": "F-108",
                "draft_id": "draft-3",
                "version_number": 1,
                "excerpt": "military-grade",
                "start": 4,
                "end": 18,
                "type": "Terminology",
                "category": "terminology",
                "severity": "medium",
                "source": "rules",
                "source_ref_id": "GUIDE-04",
                "reason": "Banned buzzword. Describe specific controls (e.g. TLS 1.3 or device binding) per GUIDE-04.",
                "suggested_fix": "TLS 1.3 encrypted",
                "fix_needs_human": False,
                "confidence": 0.98,
                "status": "open",
                "paragraph_ref": "p-1",
                "verification_trace": [
                    {"gate": 1, "name": "Schema Validation", "result": "passed", "message": "Valid", "evidence": "OK"},
                    {"gate": 2, "name": "Source Exists", "result": "passed", "message": "GUIDE-04 exists", "evidence": "GUIDE-04"},
                    {"gate": 3, "name": "Exact Quote", "result": "passed", "message": "Verbatim quote verified", "evidence": "'military-grade'"},
                    {"gate": 4, "name": "Fix Preserves Facts", "result": "passed", "message": "Preserves core technical meaning", "evidence": "Preserved"},
                    {"gate": 5, "name": "Freshness & Confidence", "result": "passed", "message": "Confidence 0.98 >= 0.80", "evidence": "Passed"},
                ],
            },
            {
                "id": "F-109",
                "draft_id": "draft-3",
                "version_number": 1,
                "excerpt": "UPI transaction",
                "start": 42,
                "end": 57,
                "type": "Terminology",
                "category": "terminology",
                "severity": "low",
                "source": "rules",
                "source_ref_id": "GUIDE-03",
                "reason": "Preferred terminology: use 'UPI payment' instead of 'UPI transaction'.",
                "suggested_fix": "UPI payment",
                "fix_needs_human": False,
                "confidence": 0.99,
                "status": "open",
                "paragraph_ref": "p-1",
                "verification_trace": [
                    {"gate": 1, "name": "Schema Validation", "result": "passed", "message": "Valid", "evidence": "OK"},
                    {"gate": 2, "name": "Source Exists", "result": "passed", "message": "GUIDE-03 and TERM-01 exist", "evidence": "GUIDE-03"},
                    {"gate": 3, "name": "Exact Quote", "result": "passed", "message": "Verbatim quote verified", "evidence": "'UPI transaction'"},
                    {"gate": 4, "name": "Fix Preserves Facts", "result": "passed", "message": "Terminology substitution is clean", "evidence": "Clean"},
                    {"gate": 5, "name": "Freshness & Confidence", "result": "passed", "message": "Confidence 0.99", "evidence": "Passed"},
                ],
            },
        ],
    }

    # 6. Dropped Candidates (real hallucination logs stopped by verifier)
    dropped = {
        "draft-1": [
            {
                "id": "drop-d1-1",
                "draft_id": "draft-1",
                "version": 2,
                "failed_gate": 2,
                "reason": "Cited source 'FACT-99' does not exist in the active Brand Kit (invented hallucination blocked).",
                "raw": {
                    "excerpt": "most trusted",
                    "cited_fact_code": "FACT-99",
                    "reason": "Claim cited non-existent audit document.",
                    "confidence": 0.92,
                },
                "created_at": (now_dt - timedelta(hours=3)).isoformat(),
            }
        ],
        "draft-2": [
            {
                "id": "drop-d2-1",
                "draft_id": "draft-2",
                "version": 3,
                "failed_gate": 3,
                "reason": "Excerpt 'unlimited free transfers' does not appear verbatim in draft content.",
                "raw": {
                    "excerpt": "unlimited free transfers",
                    "cited_guideline_code": "GUIDE-01",
                    "reason": "Model proposed finding for text altered in previous revision.",
                    "confidence": 0.85,
                },
                "created_at": (now_dt - timedelta(hours=5)).isoformat(),
            }
        ],
    }

    # 7. Comments
    comments = {
        "draft-1": [
            {
                "id": "c-1",
                "author": "Nisha Rao",
                "author_role": "reviewer",
                "text": "Please adjust the superlative claim before release.",
                "created_at": (now_dt - timedelta(hours=2)).isoformat(),
                "anchor_finding_id": "F-101",
            }
        ],
        "draft-2": [
            {
                "id": "c-2",
                "author": "Nisha Rao",
                "author_role": "reviewer",
                "text": "FACT-11 has expired. We cannot approve launch-email until Brand Governance extends the campaign window or Legal approves an override.",
                "created_at": (now_dt - timedelta(hours=4)).isoformat(),
                "anchor_finding_id": "F-105",
            }
        ],
    }

    # 8. Hash-Chained Tamper-Evident Audit Log
    raw_audit_entries = [
        {"who": "Arjun Mehta", "role": "brand_manager", "action": "Seeded governance baseline", "target": "Brand Kit", "reason": "Codex 48 production baseline initialization", "details": "10 guidelines, 15 facts, 6 terms", "time_offset_days": 14},
        {"who": "Nisha Rao", "role": "reviewer", "action": "Approved & locked draft", "target": "security-faq.md · v1", "reason": "All 4 findings resolved and verified against Brand Kit", "details": "Final sign-off recorded for production release", "time_offset_days": 7},
        {"who": "Arjun Mehta", "role": "brand_manager", "action": "Flagged expired fact", "target": "Brand Kit · FACT-11", "reason": f"Promotional campaign review date expired on {d_expired_4}", "details": "Fact status changed to Expired", "time_offset_days": 4},
        {"who": "Nisha Rao", "role": "reviewer", "action": "Requested changes", "target": "app-store-listing.md · v2", "reason": "Pricing claim needs updated review date", "details": "Comment: Please adjust the lifetime zero-fee claim before release", "time_offset_days": 1},
        {"who": "Meera Nair", "role": "creator", "action": "Dismissed finding with reason", "target": "launch-email.md · F-105", "reason": "Campaign pre-approved in board minutes", "details": "Rule GUIDE-01 dismissed: Q4 launch promotional budget approved", "time_offset_hours": 12},
        {"who": "Meera Nair", "role": "creator", "action": "Accepted suggested fix", "target": "app-store-listing.md · F-101", "reason": "Replaced unapproved superlative 'most trusted'", "details": "Changed to 'a wallet built for simple, everyday payments'", "time_offset_hours": 2},
    ]

    genesis_hash = "GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000"
    current_prev_hash = genesis_hash
    audit_logs = []

    for idx, item in enumerate(raw_audit_entries):
        if "time_offset_days" in item:
            entry_time = (now_dt - timedelta(days=item["time_offset_days"])).isoformat()
        else:
            entry_time = (now_dt - timedelta(hours=item.get("time_offset_hours", 1))).isoformat()

        entry_hash = compute_audit_hash(
            current_prev_hash,
            entry_time,
            item["who"],
            item["role"],
            item["action"],
            item["target"],
            item["reason"],
            item["details"],
        )
        audit_logs.append({
            "id": f"a-{idx + 1:03d}",
            "who": item["who"],
            "role": item["role"],
            "action": item["action"],
            "target": item["target"],
            "timestamp": entry_time,
            "reason": item["reason"],
            "details": item["details"],
            "prev_hash": current_prev_hash,
            "hash": entry_hash,
            "is_seed": True,
        })
        current_prev_hash = entry_hash

    # Reverse audit_logs so latest is first in list views
    audit_logs_reversed = list(reversed(audit_logs))

    # 9. Dismissal Events (for real Guideline Gap Radar calculation across past 6 weeks)
    dismissal_events = [
        {"id": "de-01", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-1", "finding_id": "F-01", "reason": "Superlative justified by third party audit report", "theme": "too broad", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=36)).isoformat()},
        {"id": "de-02", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-2", "finding_id": "F-02", "reason": "Launch campaign legal exception granted", "theme": "campaign/legal exception", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=31)).isoformat()},
        {"id": "de-03", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-3", "finding_id": "F-03", "reason": "Allowed superlative in CEO keynote quotes", "theme": "testimonial/quote", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=26)).isoformat()},
        {"id": "de-04", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-4", "finding_id": "F-04", "reason": "Rule too broad for B2B partner decks", "theme": "too broad", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=20)).isoformat()},
        {"id": "de-05", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-5", "finding_id": "F-05", "reason": "Too restrictive for technical comparisons", "theme": "technical audience", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=14)).isoformat()},
        {"id": "de-06", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-6", "finding_id": "F-06", "reason": "Legal signed off promotional copy exception", "theme": "campaign/legal exception", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=8)).isoformat()},
        {"id": "de-07", "rule_or_fact_id": "GUIDE-01", "draft_id": "draft-7", "finding_id": "F-07", "reason": "Too broad for award announcement context", "theme": "too broad", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=2)).isoformat()},
        {"id": "de-08", "rule_or_fact_id": "GUIDE-04", "draft_id": "draft-3", "finding_id": "F-08", "reason": "Security whitepaper uses industry term", "theme": "technical audience", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=22)).isoformat()},
        {"id": "de-09", "rule_or_fact_id": "GUIDE-04", "draft_id": "draft-8", "finding_id": "F-09", "reason": "Defense procurement requirement specifies this exact phrase", "theme": "campaign/legal exception", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=12)).isoformat()},
        {"id": "de-10", "rule_or_fact_id": "GUIDE-09", "draft_id": "draft-1", "finding_id": "F-10", "reason": "Lifetime zero fees applies to introductory tier only", "theme": "campaign/legal exception", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=15)).isoformat()},
        {"id": "de-11", "rule_or_fact_id": "GUIDE-09", "draft_id": "draft-9", "finding_id": "F-11", "reason": "Grandfathered customer commitment", "theme": "too broad", "user_name": "Meera Nair", "user_role": "creator", "created_at": (now_dt - timedelta(days=5)).isoformat()},
    ]

    # 10. Fact History
    fact_history = [
        {
            "id": "fh-01",
            "fact_id": "FACT-01",
            "action": "renewed",
            "actor": "Arjun Mehta",
            "actor_role": "brand_manager",
            "reason": "Annual core positioning verification",
            "old_expires_on": (today - timedelta(days=30)).isoformat(),
            "new_expires_on": d_active_365,
            "at": (now_dt - timedelta(days=28)).isoformat(),
        },
        {
            "id": "fh-02",
            "fact_id": "FACT-05",
            "action": "renewed",
            "actor": "Arjun Mehta",
            "actor_role": "brand_manager",
            "reason": "Customer support 24/7 SLA reaffirmed by operations team",
            "old_expires_on": (today - timedelta(days=10)).isoformat(),
            "new_expires_on": d_active_365,
            "at": (now_dt - timedelta(days=9)).isoformat(),
        },
    ]

    # 11. Notifications
    notifications = [
        {
            "id": "notif-01",
            "user_role": "brand_manager",
            "kind": "fact_expired",
            "title": "Fact FACT-11 has expired",
            "body": f"Promotional launch cashback fact expired on {d_expired_4}. Renewal required.",
            "ref_type": "fact",
            "ref_id": "FACT-11",
            "read": False,
            "created_at": (now_dt - timedelta(days=4)).isoformat(),
        },
        {
            "id": "notif-02",
            "user_role": "reviewer",
            "kind": "draft_blocked",
            "title": "Draft blocked by expired fact",
            "body": "Draft 'launch-email.md' cites expired FACT-11. Review approval is locked.",
            "ref_type": "draft",
            "ref_id": "draft-2",
            "read": False,
            "created_at": (now_dt - timedelta(hours=5)).isoformat(),
        },
        {
            "id": "notif-03",
            "user_role": "brand_manager",
            "kind": "expiry_warning",
            "title": "Fact FACT-14 expiring in 7 days",
            "body": f"Hindi localization roadmap fact expires on {d_expiring_7}.",
            "ref_type": "fact",
            "ref_id": "FACT-14",
            "read": False,
            "created_at": (now_dt - timedelta(hours=12)).isoformat(),
        },
    ]

    return {
        "guidelines": guidelines,
        "facts": facts,
        "terms": terms,
        "drafts": drafts,
        "versions": versions,
        "findings": findings,
        "dropped": dropped,
        "comments": comments,
        "audit": audit_logs_reversed,
        "dismissal_events": dismissal_events,
        "fact_history": fact_history,
        "notifications": notifications,
        "rule_revisions": [],
        "decisions": [],
    }


if __name__ == "__main__":
    data = generate_seed_data()
    print(f"Generated seed data successfully:")
    print(f"  Facts: {len(data['facts'])}")
    print(f"  Guidelines: {len(data['guidelines'])}")
    print(f"  Terms: {len(data['terms'])}")
    print(f"  Drafts: {len(data['drafts'])}")
    print(f"  Audit entries: {len(data['audit'])}")
    print(f"  Dismissal events: {len(data['dismissal_events'])}")

