<div align="center">

# 🛡️ CiteCheck AI
### *Enterprise Content Governance & Five-Gate Verification Engine*

> **"CiteCheck blocks unsupported AI claims before publication — every finding is cited, verified, and human-approved."**

[![Production URL](https://img.shields.io/badge/Production-Live_on_Vercel-000000?style=for-the-badge&logo=vercel)](https://citecheck-jet.vercel.app)
[![Challenge](https://img.shields.io/badge/Codex_48-Inkloom_AI_Final-6366F1?style=for-the-badge)](https://citecheck-jet.vercel.app)
[![Tests](https://img.shields.io/badge/Pytest-117_Passed-10B981?style=for-the-badge&logo=pytest)](https://github.com/ugesh13/CiteCheck_AI)
[![Evaluation](https://img.shields.io/badge/F1_Score-100%25-06B6D4?style=for-the-badge)](backend/eval/RESULTS.md)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

*Built by **Team TECHNOVA** for the Inkloom AI Brand Governance Final (Codex 48).*

[🚀 Live Application](https://citecheck-jet.vercel.app) • [📖 Interactive Verifier Lab](https://citecheck-jet.vercel.app/verifier-lab) • [📦 Round 3 Delivery Report](docs/ROUND3_DELIVERY.md) • [🎬 90-Second Demo Walkthrough](docs/DEMO_SCRIPT.md)

</div>

---

## 📌 Executive Summary

Modern generative AI tools produce fluent, confident marketing copy that frequently hallucinates product capabilities, cites outdated pricing, and breaches legal compliance. Real-world precedents—from the *Air Canada 2024* chatbot liability ruling to *ASCI 2024–25* regulatory crackdowns—demonstrate that unverified marketing claims carry severe financial and legal liabilities.

**CiteCheck AI** is an enterprise brand governance engine built on a non-negotiable principle: **"AI suggests, humans decide."**

Unlike generic spellcheckers or black-box LLM wrappers, CiteCheck operates under strict evidence-first enforcement: **If there is no verified source in the corporate Brand Kit and no exact quote in the draft, no finding reaches the user.**

---

## ⚡ The Three Promised Improvements (Delivered)

In Round 3, we committed to and delivered three core architectural advances:

| Promised Improvement | Implementation & Code Paths | Verification Evidence |
| :--- | :--- | :--- |
| **1. Five-Gate Verifier Hardening & Laboratory** | • Multi-tier pipeline in `backend/app/engine/verifier.py`<br>• Exact quote verification, fact ID validation, and confidence routing<br>• Real per-gate trace metadata attached to every candidate finding<br>• Dedicated test laboratory page at `/verifier-lab` | `backend/tests/test_verifier.py`<br>(20 automated tests passing)<br>`backend/tests/test_eval_harness.py` |
| **2. Proactive Fact Expiry Alerts & Governance** | • Real date evaluation relative to `now()` (Active, Expiring Soon, Expired)<br>• Database schema migration `001_round3_governance_schema.sql`<br>• Fact renewal modal, renewal history audit log, and notification center<br>• Hard sign-off block in Review Room preventing release of expired claims | `backend/tests/test_phase1_store_roles.py`<br>`src/components/brand-kit-facts.tsx`<br>`src/App.tsx (Review Queue Desk)` |
| **3. Native DOCX Parsing + Guideline Gap Radar** | • Secure Word extraction in `backend/app/engine/docx_parser.py`<br>• 4 MB Vercel budget, zip-bomb defense, encryption detection<br>• Headings & table extraction converted into semantic Markdown<br>• Living Guideline Gap Radar (`src/pages/gap-radar.tsx`) analyzing human dismissal patterns with one-click policy remediation | `backend/tests/test_docx_structure.py`<br>(11 security & format tests)<br>`backend/tests/test_gap_radar.py`<br>(4 policy tests) |

Detailed implementation breakdown and before/after comparisons are documented in [docs/ROUND3_DELIVERY.md](docs/ROUND3_DELIVERY.md).

---

## 🏗️ System Architecture

CiteCheck is built for reliable, zero-latency serverless execution on Vercel:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Vercel Serverless Edge Architecture                  │
├────────────────────────────────────────────────────────────────────────┤
│  Client (React 18 SPA + Vite + Tailwind + Glassmorphism)               │
│   ├── Role Switcher: Meera (Creator), Nisha (Reviewer), Arjun (Manager)│
│   ├── Five-Gate Funnel & Real-time Verification Traces                 │
│   └── Guideline Gap Radar & Interactive Guided Tour                    │
│                                │                                       │
│                                ▼                                       │
│  FastAPI Gateway (/api/index.py)                                       │
│   ├── Sliding-window in-memory Rate Limiter (10 runs/min per IP)       │
│   ├── Pydantic Input Length Bounds (draft <= 100k, comments <= 2k)     │
│   ├── Claims & Brand Kit Evidence Matcher (sub-millisecond TF-IDF)     │
│   ├── Honest LLM Reviewer (Gemini/Claude/GPT; timeout <= 8s, fallback) │
│   └── Five-Gate Verifier Engine (Strict Schema, Quote, Freshness)      │
│                                │                                       │
│                                ▼                                       │
│  Repository Store Layer (backend/app/store/)                           │
│   ├── SupabaseStore: PostgreSQL with RLS, foreign keys & migrations   │
│   └── MemoryStore: Zero-config fallback with relative-date demo seeder │
│                                │                                       │
│                                ▼                                       │
│  Cryptographic SHA-256 Tamper-Evident Audit Trail                      │
│   └── Chained block verification: GET /api/v1/audit-log/verify         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Ground-Truth Evaluation & Measured Performance

All metrics below are computed from our automated 25-case ground truth evaluation harness (`backend/eval/dataset.jsonl`), testing clean marketing copy, unsupported statistics, tone infractions, expired facts, and adversarial prompt injection attempts.

| Metric | Measured Value | Benchmark Target | Status |
| :--- | :---: | :---: | :---: |
| **Precision** | **100.0%** | ≥ 85.0% | ✅ Exceeded |
| **Recall** | **100.0%** | ≥ 75.0% | ✅ Exceeded |
| **F1 Score** | **100.0%** | ≥ 80.0% | ✅ Exceeded |
| **Five-Gate Drops Caught** | **5 / 5** | 100% | ✅ Verified |
| **p50 Latency (Deterministic)** | **0.19 ms** | < 200 ms | ✅ Sub-millisecond |
| **p95 Latency (Deterministic)** | **0.74 ms** | < 500 ms | ✅ Sub-millisecond |

### How to Reproduce Locally
```bash
python -m backend.eval.run_eval
```
Full breakdown of per-gate drops, precision/recall curves, and latency percentiles is available in [backend/eval/RESULTS.md](backend/eval/RESULTS.md).

---

## 🧪 Comprehensive Test Suite Matrix

CiteCheck's backend is backed by **117 automated pytest cases** spanning unit tests, integration paths, and adversarial edge cases:

| Test File | Cases | What It Proves |
| :--- | :---: | :--- |
| `test_verifier.py` | 20 | Exercises Gate 1 through Gate 5; verifies schema validity, exact excerpt matching, context preservation, expired fact routing, and 12-case adversarial selftest. |
| `test_phase1_store_roles.py` | 22 | Verifies server-side role enforcement (Creator, Reviewer, Brand Manager); asserts 403 on unauthorized mutations, validates JWT token decoding, and tests fact renewals. |
| `test_docx_structure.py` | 11 | Proves 4 MB file size enforcement, zip-bomb defense (ratio and entry count), password encryption detection, and structural heading/table Markdown extraction. |
| `test_gap_radar.py` | 4 | Verifies dynamic dismissal aggregation, dismissal rate calculations, theme breakdown, Brand Manager remediation actions, and audit logging. |
| `test_adversarial.py` | 10 | Validates resilience against giant payloads, SQL injection strings, prompt injection delimiters, corrupted/forged JWTs, and audit trail tampering. |
| `test_eval_harness.py` | 1 | Executes the 25-case ground-truth benchmark and programmatically asserts Precision ≥ 0.85 and Recall ≥ 0.75. |
| `test_governance.py` | 33 | Validates brand kit CRUD, finding resolution workflows (Accept/Edit/Dismiss), and draft version diff generation. |
| `test_api.py` | 16 | Validates core REST endpoints, health probes, and demo seeding endpoints. |

**Run all tests:**
```bash
pytest backend/tests -v
```

---

## 🚀 Quick Start & Local Setup

### Option A: Zero-Config Local Setup (Uses In-Memory Store)
Requires Python 3.10+ and Node.js 18+. No database setup required.

```bash
# 1. Clone the repository
git clone https://github.com/ugesh13/CiteCheck_AI.git
cd CiteCheck_AI

# 2. Set up Backend
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. In a new terminal, launch the Frontend
cd ../Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai
pnpm install
pnpm dev
```
* Visit `http://localhost:3000` to interact with the application.
* Visit `http://localhost:8000/docs` for the interactive Swagger OpenAPI specifications.

### Option B: Production Setup with Supabase
1. Copy `.env.example` to `.env` and configure your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key
   SUPABASE_JWT_SECRET=your_jwt_secret
   ```
2. Apply the migration scripts in order:
   * `backend/scripts/schema.sql` (Base schema)
   * `backend/scripts/migrations/001_round3_governance_schema.sql` (Round 3 governance tables)
3. Run the relative-date demo seeder:
   ```bash
   python -m backend.scripts.seed_demo
   ```

---

## 🎭 One-Click Persona Switching for Demo & Evaluation

CiteCheck features a persistent **Role Switcher Pill Trio** in the top navigation bar, allowing evaluators to switch personas instantly without re-logging in:

1. **Meera Nair (Creator):**
   * Upload drafts (`.docx`, `.md`, raw text).
   * Run the Five-Gate Verifier.
   * Inspect detailed per-gate verification traces.
   * Accept suggested fixes, edit excerpts inline, or dismiss findings with friction reasons.
2. **Nisha Rao (Reviewer):**
   * Inspect line-by-line colored version diffs (`v1` vs `v2`).
   * Add threaded reviewer comments.
   * Verify the **Blocked Sign-off Guardrail**: If an active finding cites an expired fact, approval is prevented until the fact is renewed.
   * Grant final publication approval and cryptographically lock the draft version.
3. **Arjun Mehta (Brand Manager):**
   * Inspect the **Fact Health Strip** (Active, Expiring Soon, Expired).
   * Renew expired or expiring facts with custom validity dates and mandatory audit reasons.
   * Inspect the **Guideline Gap Radar**: Identify policies causing high creator friction and apply one-click remediation (*Clarify Threshold*, *Exempt Context*, *Archive*).
   * Audit Trail: Inspect the append-only ledger and verify SHA-256 chain integrity.

For a fast 90-second evaluator walkthrough, see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

---

## 🔭 Honest Limitations & Engineering Roadmap

We prioritize transparency. Below is an honest appraisal of CiteCheck's current scope and roadmap:

### What CiteCheck Does Today
* ✅ Deterministic claim & brand-evidence matching with sub-millisecond execution.
* ✅ Honest LLM support (Gemini, Claude, GPT) with prompt-injection defense and graceful fallback when unconfigured.
* ✅ Strict Five-Gate Verification with transparent per-candidate trace generation and dropped candidate tracking.
* ✅ Semantic DOCX parsing with zip-bomb safeguards and 4 MB serverless budget.
* ✅ Policy friction tracking via the Guideline Gap Radar.
* ✅ Cryptographic SHA-256 tamper-evident audit logging.

### What is Out of Scope Today
* ⚠️ OCR / Scanned PDF parsing (currently supports `.docx`, `.md`, and `.txt`).
* ⚠️ Real-time collaborative multi-user editing (Google Docs style concurrent typing).
* ⚠️ Automatic autonomous guideline modification (all guideline changes require human brand manager confirmation).

### Post-Hackathon Roadmap
1. **Multi-Modal Document Parsing:** Native PDF and slide deck (`.pptx`) parsing using layout-aware chunking.
2. **Multilingual Brand Kits:** Cross-lingual claim verification for global marketing organizations (Spanish, German, Japanese).
3. **SSO & Directory Sync:** Enterprise SAML 2.0 / Okta integration for corporate role provisioning.
4. **CMS Integrations:** Pre-publication verification plugins for WordPress, Contentful, and HubSpot.

---

## 👥 Team TECHNOVA

* **Ugesh Kumar** (*Full-Stack & Systems Architecture*) — Five-Gate Verifier Engine, Store Layer, DOCX Parser, Evaluation Harness.
* **Riya Sharma** (*Frontend & UX Engineering*) — Glassmorphic UI Components, Gap Radar, Fact Renewal Workflows, Guided Tour.
* **Shushma Singh** (*QA & Brand Governance*) — Ground-Truth Benchmark Dataset, Adversarial Test Cases, API Documentation.

---

<div align="center">
<b>CiteCheck AI</b> — <i>Every finding cited, verified, and human-approved.</i>
</div>
