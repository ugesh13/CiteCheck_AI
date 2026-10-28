"""
CiteCheck AI — Deterministic Rules Engine.

Runs regex-based checks against the draft content without any LLM calls.
Currently implements:

1. Forbidden Terminology Checker — flags usage of banned terms and suggests
   the approved alternative from approved_terms.
2. Basic Readability Scorer — flags sentences that are excessively long
   (>40 words) as potential accessibility / plain-language violations.
"""

from __future__ import annotations

import re
from typing import Any


def _build_term_pattern(forbidden_term: str) -> re.Pattern:
    """Build a case-insensitive word-boundary regex for a forbidden term."""
    escaped = re.escape(forbidden_term)
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


def check_forbidden_terms(
    draft_text: str,
    approved_terms: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Scan *draft_text* for any occurrence of forbidden terms defined in the
    brand kit's ``approved_terms`` table.

    Parameters
    ----------
    draft_text : str
        The full content of the draft.
    approved_terms : list[dict]
        Rows from the ``approved_terms`` table, each with keys:
        ``preferred_term``, ``forbidden_terms`` (list[str]), ``usage_note``.

    Returns
    -------
    list[dict]
        A list of candidate findings (raw dicts) ready for the 5-Gate
        verifier pipeline.
    """
    candidates: list[dict[str, Any]] = []

    for term_row in approved_terms:
        preferred: str = term_row["preferred_term"]
        forbidden_list: list[str] = term_row.get("forbidden_terms", [])
        usage_note: str = term_row.get("usage_note", "")

        for forbidden in forbidden_list:
            pattern = _build_term_pattern(forbidden)
            for match in pattern.finditer(draft_text):
                # Extract a window around the match for the excerpt
                start = max(0, match.start() - 30)
                end = min(len(draft_text), match.end() + 30)
                excerpt = draft_text[start:end]

                # Make sure the excerpt contains the exact match text
                exact_match_text = match.group(0)

                candidates.append({
                    "category": "terminology",
                    "severity": "medium",
                    "exact_excerpt": exact_match_text,
                    "reason": (
                        f"Forbidden term '{forbidden}' detected. "
                        f"Use '{preferred}' instead. {usage_note}"
                    ),
                    "cited_guideline_code": None,
                    "cited_fact_code": None,
                    "suggested_fix": preferred,
                })

    return candidates


def check_readability(
    draft_text: str,
    max_words_per_sentence: int = 40,
    guideline_code: str | None = None,
) -> list[dict[str, Any]]:
    """
    Flag sentences that exceed *max_words_per_sentence* as potential
    readability / accessibility violations.

    Parameters
    ----------
    draft_text : str
        The full content of the draft.
    max_words_per_sentence : int
        Threshold above which a sentence is flagged.
    guideline_code : str | None
        If provided, the finding will cite this guideline.

    Returns
    -------
    list[dict]
        Candidate findings for overly long sentences.
    """
    candidates: list[dict[str, Any]] = []

    # Simple sentence splitter — handles ., !, ? followed by whitespace
    sentences = re.split(r"(?<=[.!?])\s+", draft_text.strip())

    for sentence in sentences:
        word_count = len(sentence.split())
        if word_count > max_words_per_sentence:
            # Use first 120 chars as excerpt to keep it manageable
            excerpt = sentence[:120].strip()
            if excerpt not in draft_text:
                # Fallback: use the full sentence if truncation broke the match
                excerpt = sentence.strip()

            candidates.append({
                "category": "accessibility",
                "severity": "low",
                "exact_excerpt": excerpt,
                "reason": (
                    f"Sentence has {word_count} words (threshold: {max_words_per_sentence}). "
                    f"Consider breaking it into shorter sentences for readability."
                ),
                "cited_guideline_code": guideline_code,
                "cited_fact_code": None,
                "suggested_fix": None,
            })

    return candidates


def run_rules_engine(
    draft_text: str,
    approved_terms: list[dict[str, Any]],
    guidelines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Entry point: run all deterministic rule checkers and return a merged
    list of candidate findings.

    Parameters
    ----------
    draft_text : str
        The draft content.
    approved_terms : list[dict]
        Rows from approved_terms.
    guidelines : list[dict]
        Rows from guidelines — used to find a plain-language guideline code.

    Returns
    -------
    list[dict]
        Candidate findings for the 5-Gate verifier.
    """
    candidates: list[dict[str, Any]] = []

    # 1. Forbidden-term scan
    candidates.extend(check_forbidden_terms(draft_text, approved_terms))

    # 2. Readability scan — look for a plain-language guideline
    plain_lang_code: str | None = None
    for g in guidelines:
        if g.get("category") == "accessibility":
            plain_lang_code = g.get("guideline_code")
            break

    candidates.extend(check_readability(draft_text, guideline_code=plain_lang_code))

    return candidates
