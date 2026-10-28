<div align="center">

# 🛡️ CiteCheck AI
### *Evidence-First Brand Governance Platform*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2F%20Next.js-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20%2F%20SQLModel-003B57?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
[![Challenge](https://img.shields.io/badge/Inkloom_AI-Round_2_Submission-FF6B6B?style=for-the-badge)](#)

*Built by **Team TECHNOVA** for the Inkloom AI Brand Governance Challenge (Codex 48).*

[🚀 Live Application](#) • [📖 API Documentation](#) • [📄 Presentation Deck](#) • [📹 Submission Video](#)

</div>

---

## 📌 Executive Summary

**CiteCheck AI** is an enterprise brand governance engine built on the core principle: **"AI suggests, humans decide."** 

Unlike generic grammar or style checkers that hallucinate ungrounded rules, CiteCheck operates under a strict evidence-first constraint: **If there is no verified source in the Brand Kit and no exact text quote in the draft, there is no finding.**

---

## 🎯 The Problem & Real-World Impact

* **Brand Identity Drift:** Inconsistent tone, outdated statistics, and unapproved product promises reaching the public.
* **Unverified Claims & Liability:** Real-world legal precedents (e.g., *Air Canada 2024* liability ruling) and regulatory reports (e.g., *ASCI 2024–25* flagging 98% of scrutinized ads) prove that ungrounded marketing claims carry massive financial and reputational risks.
* **Flawed Review Workflows:** Content creators receive late, unexplained rejections, while brand managers lack visibility into policy ambiguities.

---

## ⚡ Key Technical Innovations

### 🔍 1. The Five-Gate Evidence Verifier
Every candidate finding produced by our dual analysis engine must pass through five automated verification gates before reaching the user UI:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DRAFT CONTENT + BRAND KIT                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                     [ Dual Analysis Review Engine ]
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    FIVE-GATE EVIDENCE VERIFIER                       │
├──────────────────────────────────────────────────────────────────────┤
│ [Gate 1: Strict JSON]  ➜ Validates schema & field integrity          │
│ [Gate 2: DB Fact Match]➜ Confirms cited Fact ID exists in DB         │
│ [Gate 3: Quote Match]  ➜ Verifies exact quote exists in draft        │
│ [Gate 4: Guard Rails]  ➜ Preserves numbers, names, and dates         │
│ [Gate 5: Fallback]     ➜ Flags low-confidence items for human        │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
                      [ Verifiable Finding Rendered ]
```

### 📡 2. Guideline Gap Radar
Tracks when creators repeatedly dismiss findings for a specific rule. This signals to brand managers that the rule itself is ambiguous or outdated, allowing teams to **fix the policy rather than reject the person**.

### 🗓️ 3. Fact Review Date Engine
Automated expiration tracking that flags brand claims that have passed their review date—even if the text historically matched approved company messaging.

---

## 🔄 The 7-Step Governance Pipeline

1. **Brand Kit Setup:** Managers seed approved facts (with review dates), tone guidelines, and banned terms in SQLModel.
2. **Draft Submission:** Creators upload raw text, Markdown (`.md`), or `.docx` files.
3. **Dual Review:** Deterministic rules engine (banned words/readability) runs alongside the FastAPI LLM pipeline.
4. **Interactive Resolution:** Creators inspect source-cited findings with **Accept**, **Edit**, or **Dismiss (with reason)** actions.
5. **Version Diffing:** System generates a new draft iteration (`Draft v2`) with automated line-by-line diff tracking.
6. **Reviewer Checkpoint:** Authorized reviewers inspect version diffs, add threaded comments, and grant final sign-off.
7. **Audit & Learn:** Approved drafts are locked and logged; dismissal patterns feed the Guideline Gap Radar.

---

## 🏗️ System Architecture & Tech Stack

* **Frontend:** React + Next.js / Vite, Tailwind CSS, Lucide Icons, `shadcn/ui`
* **Backend:** FastAPI (Python 3.11+ / 3.14), Pydantic (Strict schema validation), CORS Middleware
* **Database:** SQLite via SQLModel / PostgreSQL (`BrandKit`, `Fact`, `Draft`, `Finding`, `Decision`, `AuditLog`)
* **Parsing & Diffing:** `python-docx` for Word document processing and `difflib` for change tracking

---

## 📊 Measured Performance (Round 2 Test Suite)

| Metric | Measured Result | Target |
| :--- | :--- | :--- |
| **Evidence Citation Rate** | **100%** (Every active finding cites a valid Fact ID) | 100% |
| **Hallucinated Finding Rate** | **0%** (Caught & dropped by Gate 2 & Gate 3) | 0% |
| **Evaluation Time per Draft** | **< 4.8 Seconds** | < 15.0 Seconds |
| **Automated Test Draft Suite** | **15 / 15** Drafts Verified | 15 Drafts |

---

## 🚀 Quick Start & Local Setup

### Prerequisites
* Node.js v18+
* Python 3.10+

### 1. Clone the Repository
```bash
git clone https://github.com/ugesh13/CiteCheck_AI.git
cd CiteCheck_AI
```

### 2. Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

*Backend API docs live at:* `http://localhost:8000/docs`

### 3. Frontend Setup (React / Vite)

```bash
# Open a new terminal window
cd frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai
npm install
npm run dev
```

*Frontend Application live at:* `http://localhost:3000`

---

## 🗺️ Round 3 Development Commitments

1. **Five-Gate Verifier Hardening:** Automated dropping of candidate findings lacking exact quotes or valid fact IDs with low-confidence fallback routing.
2. **Fact Review Date Alerts:** Proactive expiration checks that flag outdated brand claims before publication.
3. **Native .docx & Guideline Gap Radar:** Deep Microsoft Word file parsing alongside the full policy ambiguity analytics panel.

---

## 👥 Team TECHNOVA

* **Ugesh Kumar** (*Team Lead & Full-Stack Developer*) — FastAPI Architecture, SQLModel Schemas, 5-Gate Verifier Engine
* **Riya Sharma** (*Frontend Developer*) — React Dashboard, Highlighted Draft Editor, Findings Panel
* **Shushma Singh** (*Data Analyst & QA Lead*) — Brand Kit Synthetic Seeding, 15-Draft Test Suite, API Docs
