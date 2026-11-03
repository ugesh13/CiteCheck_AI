"""
CiteCheck AI — Deterministic Claims & Evidence Detection Engine.

Detects:
1. Superlative & absolute claims ("most trusted", "#1", "zero fees", "forever", "100%", "guaranteed")
   cites governing guideline (GUIDE-01 / GUIDE-09) and semantic-overlap fact code.
2. Numeric & statistical claims (percentages, currency, metrics) compared against approved facts.
   - If number matches an expired fact -> cites that fact code (triggers Gate 5 freshness block).
   - If number has no supporting approved fact -> flags unsupported statistic citing GUIDE-05.
3. Tone / pressure tactics (GUIDE-07): "act now", "urgent", "limited time", "don't miss out", "hurry".
4. Product naming order (GUIDE-08): "Lumen Pay" on first mention; "Lumen" thereafter.

Formula for confidence:
- Exact lexical pattern match: 0.95
- Unsupported statistic (regex number not in kit): 0.88
- Token overlap semantic match: min(0.95, 0.70 + 0.05 * matched_tokens)
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Token extraction pattern
_STAT_PATTERN = re.compile(
    r"(?:"
    r"[$₹€£]\s*\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:INR|USD|EUR|GBP|%)\b|"
    r"\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*percent\b|"
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"
    r")",
    re.IGNORECASE,
)

_SUPERLATIVES = [
    (r"\bmost trusted\b", "most trusted", "GUIDE-01", "FACT-07", "a wallet built for simple, everyday payments"),
    (r"\b#1\b|\bnumber one\b|\bno\.?\s*1\b", "#1", "GUIDE-01", "FACT-07", "leading"),
    (r"\bbest (?:wallet|app|platform|service)\b", "best", "GUIDE-01", "FACT-07", "reliable"),
    (r"\bzero fees forever\b", "zero fees forever", "GUIDE-09", "FACT-03", "fees reviewed quarterly"),
    (r"\bzero fees\b", "zero fees", "GUIDE-09", "FACT-03", "transparent pricing reviewed quarterly"),
    (r"\bforever\b", "forever", "GUIDE-09", "FACT-03", "for the current term"),
    (r"\bguaranteed(?:\s+unlimited)?\b", "guaranteed", "GUIDE-02", "FACT-07", "designed for high reliability"),
    (r"\b100% (?:secure|uptime|error-free|guaranteed)\b", "100%", "GUIDE-01", "FACT-09", "99.9% uptime backed by TLS 1.3 encryption"),
    (r"\balways\b", "always", "GUIDE-02", None, "consistently"),
    (r"\bnever\b", "never", "GUIDE-02", None, "rarely"),
]

_PRESSURE_TACTICS = [
    (r"\b(?:act now|urgent|hurry|don't miss out|before it's too late|last chance|limited time only)\b", "Urgent / pressure wording violates plainspoken confidence policy", "GUIDE-07", "Explore features at your convenience"),
    (r"\b(?:penalty|risk of suspension|immediate action required)\b", "Fear-based tactic detected", "GUIDE-07", "Please verify your account details"),
]


def _extract_tokens(text: str) -> Set[str]:
    """Tokenize text into lowercase alphanumeric words."""
    return {w.lower() for w in re.findall(r"\b[a-zA-Z0-9_%₹$]{2,}\b", text)}


def find_overlapping_fact(excerpt: str, facts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Finds best matching approved fact using token set overlap."""
    exc_tokens = _extract_tokens(excerpt)
    if not exc_tokens:
        return None

    best_match = None
    best_score = 0

    for f in facts:
        f_text = f.get("text") or f.get("statement", "")
        f_tokens = _extract_tokens(f_text)
        overlap = len(exc_tokens.intersection(f_tokens))
        if overlap > best_score and overlap >= 2:
            best_score = overlap
            best_match = f

    return best_match


def detect_claims_and_evidence(
    draft_text: str,
    brand_kit: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Executes deep deterministic claim, statistic, tone, and product naming checks.
    Produces CandidateFinding compatible dicts ready for 5-Gate pipeline.
    """
    candidates: List[Dict[str, Any]] = []
    facts = brand_kit.get("facts", [])
    guidelines = {g["id"]: g for g in brand_kit.get("guidelines", [])}

    # Extract all numeric/stat tokens across all approved facts
    known_fact_stats: Dict[str, List[Dict[str, Any]]] = {}
    for f in facts:
        f_text = f.get("text") or f.get("statement", "")
        found_stats = _STAT_PATTERN.findall(f_text)
        for stat in found_stats:
            stat_clean = stat.strip().lower()
            known_fact_stats.setdefault(stat_clean, []).append(f)

    # 1. Superlatives & Absolute Claims Check
    for pattern, label, default_guide, default_fact, suggested_fix in _SUPERLATIVES:
        for m in re.finditer(pattern, draft_text, re.IGNORECASE):
            excerpt = m.group(0)

            # Check if there is a more specific overlapping fact
            overlapping_fact = find_overlapping_fact(excerpt, facts)
            fact_id = overlapping_fact["id"] if overlapping_fact else default_fact

            # Confidence formula: exact lexical match is 0.95
            confidence = 0.95

            guide_id = default_guide
            reason = (
                f"Absolute or superlative claim '{excerpt}' detected. "
                f"Requires verifiable proof per {guide_id}."
            )
            if fact_id:
                reason += f" Compare with approved fact {fact_id}."

            candidates.append({
                "category": "claim",
                "severity": "high",
                "exact_excerpt": excerpt,
                "reason": reason,
                "cited_guideline_code": guide_id,
                "cited_fact_code": fact_id,
                "suggested_fix": suggested_fix,
                "confidence": confidence,
                "source": "rules",
            })

    # 2. Unsupported Statistics & Expired Fact Metric Verification
    for m in _STAT_PATTERN.finditer(draft_text):
        stat_text = m.group(0)
        stat_clean = stat_text.strip().lower()

        # Check if this exact number/percentage matches any approved fact
        matching_facts = known_fact_stats.get(stat_clean, [])
        if not matching_facts:
            # Check partial match (e.g. '15%' in 'cashback up to 15%')
            for f in facts:
                f_stmt = (f.get("text") or f.get("statement", "")).lower()
                if stat_clean in f_stmt:
                    matching_facts.append(f)

        if matching_facts:
            # Fact exists! Check if it is expired
            fact = matching_facts[0]
            fid = fact.get("id") or fact.get("fact_code")
            expires_val = fact.get("expires_on") or fact.get("review_date")
            is_expired = False
            if expires_val:
                try:
                    exp_date = date.fromisoformat(str(expires_val)[:10])
                    if exp_date < datetime.now(timezone.utc).date():
                        is_expired = True
                except ValueError:
                    pass

            # If fact is expired, generate candidate citing this fact so Gate 5 fires!
            if is_expired:
                # Extract surrounding window for meaningful excerpt
                start = max(0, m.start() - 15)
                end = min(len(draft_text), m.end() + 15)
                window_excerpt = draft_text[start:end].strip()
                if stat_text not in window_excerpt:
                    window_excerpt = stat_text

                candidates.append({
                    "category": "claim",
                    "severity": "high",
                    "exact_excerpt": window_excerpt,
                    "reason": (
                        f"Statistic '{stat_text}' cites approved fact {fid}, but this fact expired on {expires_val}. "
                        "Overdue promotional claim must be renewed before publication."
                    ),
                    "cited_guideline_code": "GUIDE-05",
                    "cited_fact_code": fid,
                    "suggested_fix": f"{stat_text} (requires current campaign confirmation)",
                    "confidence": 0.90,
                    "source": "rules",
                })
        else:
            # Unsupported statistic!
            # Don't flag if it was already part of a superlative (e.g. '100% secure')
            already_flagged = any(stat_text in c["exact_excerpt"] for c in candidates)
            if not already_flagged:
                candidates.append({
                    "category": "claim",
                    "severity": "high",
                    "exact_excerpt": stat_text,
                    "reason": (
                        f"Unsupported statistic '{stat_text}' detected with no supporting approved fact in the Brand Kit. "
                        "Promotional metrics and values require a current approved source per GUIDE-05."
                    ),
                    "cited_guideline_code": "GUIDE-05",
                    "cited_fact_code": None,
                    "suggested_fix": None,
                    "confidence": 0.88,
                    "source": "rules",
                })

    # 3. Tone & Pressure Tactics (GUIDE-07)
    for pattern, issue_desc, guide_code, fix_text in _PRESSURE_TACTICS:
        for m in re.finditer(pattern, draft_text, re.IGNORECASE):
            excerpt = m.group(0)
            candidates.append({
                "category": "tone",
                "severity": "medium",
                "exact_excerpt": excerpt,
                "reason": f"{issue_desc} ('{excerpt}'). Use respectful, neutral language per {guide_code}.",
                "cited_guideline_code": guide_code,
                "cited_fact_code": None,
                "suggested_fix": fix_text,
                "confidence": 0.92,
                "source": "rules",
            })

    # 4. Product Naming Hierarchy (GUIDE-08)
    # Rule: "Use Lumen Pay on first mention; Lumen thereafter."
    # If the first mention of the product in the text is "Lumen" instead of "Lumen Pay", flag it!
    lumen_pay_match = re.search(r"\bLumen Pay\b", draft_text)
    lumen_solo_match = re.search(r"\bLumen\b(?!\s+Pay\b)", draft_text)

    if lumen_solo_match:
        if not lumen_pay_match or lumen_solo_match.start() < lumen_pay_match.start():
            candidates.append({
                "category": "terminology",
                "severity": "low",
                "exact_excerpt": lumen_solo_match.group(0),
                "reason": (
                    "First product mention in content must be 'Lumen Pay' per GUIDE-08. "
                    "Use 'Lumen Pay' on first mention; 'Lumen' thereafter."
                ),
                "cited_guideline_code": "GUIDE-08",
                "cited_fact_code": None,
                "suggested_fix": "Lumen Pay",
                "confidence": 0.95,
                "source": "rules",
            })

    return candidates
