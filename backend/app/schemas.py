"""
CiteCheck AI — Pydantic Schemas.

All request / response models for the API, plus the CandidateFinding
model used internally by the 5-Gate Evidence Verifier.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class FindingCategory(str, Enum):
    tone = "tone"
    terminology = "terminology"
    claim = "claim"
    accessibility = "accessibility"
    formatting = "formatting"


class FindingSeverity(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class HumanDecision(str, Enum):
    accepted = "accepted"
    edited = "edited"
    dismissed = "dismissed"


class DraftStatus(str, Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    changes_requested = "changes_requested"


class VerificationStatus(str, Enum):
    verified = "verified"
    needs_review = "needs_review"
    dropped = "dropped"


# ─── Draft Schemas ────────────────────────────────────────────────────────────

class DraftCreate(BaseModel):
    """Request body for creating a new draft."""
    brand_kit_id: UUID
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    file_format: str = Field(default="markdown")
    creator_id: Optional[UUID] = None


class DraftResponse(BaseModel):
    """Response body for a single draft."""
    id: UUID
    brand_kit_id: UUID
    creator_id: Optional[UUID] = None
    title: str
    current_content: str
    file_format: str
    status: DraftStatus
    current_version: int
    created_at: datetime
    updated_at: datetime


class DraftDetailResponse(BaseModel):
    """Full draft detail including findings."""
    draft: DraftResponse
    findings: list[FindingResponse] = []


# ─── Candidate Finding (Internal — 5-Gate Input) ─────────────────────────────

class CandidateFinding(BaseModel):
    """
    Schema that every candidate finding MUST validate against (Gate 1).
    This is the structured input the verification pipeline expects.
    """
    category: FindingCategory
    severity: FindingSeverity
    exact_excerpt: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    cited_fact_code: Optional[str] = None
    cited_guideline_code: Optional[str] = None
    suggested_fix: Optional[str] = None


# ─── Finding Schemas ─────────────────────────────────────────────────────────

class FindingResponse(BaseModel):
    """Response body for a finding row."""
    id: UUID
    draft_id: UUID
    version_number: int
    category: FindingCategory
    severity: FindingSeverity
    exact_excerpt: str
    reason: str
    cited_fact_id: Optional[UUID] = None
    cited_guideline_id: Optional[UUID] = None
    suggested_fix: Optional[str] = None
    is_intent_guarded: bool
    verification_status: VerificationStatus
    created_at: datetime


# ─── Review Schemas ──────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    """Request body for POST /review-draft."""
    draft_id: UUID
    brand_kit_id: UUID


class SeverityCounts(BaseModel):
    high: int = 0
    medium: int = 0
    low: int = 0


class VerificationStats(BaseModel):
    total_candidates: int = 0
    passed_all_gates: int = 0
    dropped: int = 0
    needs_review: int = 0


class ReviewResponse(BaseModel):
    """Response body after running the review pipeline."""
    draft_id: UUID
    version_number: int
    findings: list[FindingResponse]
    severity_counts: SeverityCounts
    verification_stats: VerificationStats


# ─── Decision Schemas ────────────────────────────────────────────────────────

class DecisionCreate(BaseModel):
    """Request body for recording a human decision on a finding."""
    finding_id: UUID
    user_id: Optional[UUID] = None
    action: HumanDecision
    custom_edit_text: Optional[str] = None
    dismissal_reason: Optional[str] = None


class DecisionResponse(BaseModel):
    """Response body for a recorded decision."""
    id: UUID
    finding_id: UUID
    user_id: Optional[UUID] = None
    action: HumanDecision
    custom_edit_text: Optional[str] = None
    dismissal_reason: Optional[str] = None
    created_at: datetime


# ─── Analytics Schemas ───────────────────────────────────────────────────────

class GuidelineGapItem(BaseModel):
    """A single item in the Guideline Gap Radar."""
    guideline_id: Optional[UUID] = None
    guideline_code: Optional[str] = None
    guideline_title: Optional[str] = None
    total_findings: int
    dismissed_count: int
    dismiss_rate: float = Field(..., ge=0.0, le=1.0)
    top_dismissal_reasons: list[str] = []


class GuidelineGapRadarResponse(BaseModel):
    """Full response for the gap radar endpoint."""
    gaps: list[GuidelineGapItem]


# ─── Brand Kit Schemas ───────────────────────────────────────────────────────

class BrandKitResponse(BaseModel):
    """Response body for a brand kit."""
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

