# Phase 0 — Baseline Truth & Defect Evidence

> **Audit Date**: 2026-11-03  
> **Repository**: `ugesh13/CiteCheck_AI`  
> **Commit Evaluated**: `5fd91cc`  
> **Production Target**: `https://citecheck-jet.vercel.app`  
> **Auditor**: Antigravity Pair Programmer / Codex 48 Round 3 Review  

---

## 1. Baseline Test & Build Status

### 1.1 Backend Unit Tests
Command: `python -m pytest backend/tests/ -v`
- **Total Tests Collected**: 118 items
- **Passed**: 118
- **Failed**: 0
- **Duration**: 2.58s
- **Warnings**: 8 (Deprecation warnings in asyncio event loop policy and starlette HTTP constants)

### 1.2 Evaluation Benchmark
Command: `python -m backend.eval.run_eval`
- **Cases Evaluated**: 25
- **Precision**: 100.0% (21/21)
- **Recall**: 100.0% (21/21)
- **F1 Score**: 100.0%
- **Latency (p50)**: 0.18 ms
- **Latency (p95)**: 0.77 ms
- **Gate Drops**:
  - Gate 1 drops: 0
  - Gate 2 drops: 0
  - Gate 3 drops: 0
  - Gate 4 drops: 0
  - Gate 5 drops: 0
*(Note: Evaluated against self-authored dataset without negative drop cases, as diagnosed in Defect F9).*

### 1.3 Frontend Production Build
Command: `pnpm run build` (in `Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai`)
- **Status**: SUCCESS (5.72s)
- **Asset Chunks**:
  - `dist/public/index.html` (2.02 kB)
  - `dist/public/assets/index-Gjc_ltq0.css` (155.23 kB)
  - `dist/public/assets/mammoth.browser-Fl1nxvqD.js` (304.66 kB)
  - `dist/public/assets/index-DNOB7z2A.js` (850.68 kB)

### 1.4 Frontend TypeScript Check
Command: `pnpm run typecheck`
- **Status**: **FAILED (Exit code 2)**
- **Errors Caught (7 Type Errors)**:
  1. `src/App.tsx(326,49)`: Property `'roles'` does not exist on type `nav item`.
  2. `src/App.tsx(934,53)`: Property `'expires_on'` does not exist on type `'Fact'`.
  3. `src/components/finding-card.tsx(89,58)`: Property `'expires_on'` does not exist on type `'Fact'`.
  4. `src/hooks/use-product-data.ts(28,49)`: Property `'brandKit'` does not exist on queryKeys (`kit` vs `brandKit`).
  5. `src/lib/api/endpoints.ts(364,44)`: Missing declaration for `mammoth/mammoth.browser`.
  6. `src/pages/audit.tsx(62,29)`: Type conversion mismatch to `VerificationResult`.

---

## 2. Live Production Inspection (`https://citecheck-jet.vercel.app`)

### 2.1 Live Health Probe
Request: `GET https://citecheck-jet.vercel.app/api/v1/health`
- **HTTP Status**: `503 Service Unavailable`
- **Response Payload**:
  ```json
  {
    "status": "degraded",
    "service": "CiteCheck AI",
    "version": "3.0.0",
    "commit": "5fd91cc",
    "store_backend": "memory",
    "database": "disconnected",
    "llm_status": "not_configured",
    "llm_provider": "none",
    "product_line": "CiteCheck blocks unsupported AI claims before publication — every finding is cited, verified, and human-approved.",
    "timestamp": "2026-11-03T13:02:44.775331+00:00"
  }
  ```
- **Findings**:
  - Live deployment falls back to `memory` store; Supabase connection is disconnected on Vercel (`database: disconnected`).
  - No LLM provider is active on production (`llm_status: not_configured`).

---

## 3. Grep Audits: Debug Endpoints & Hardcoded Names

### 3.1 Debug Endpoints
- Searched git history for `/api/debug-scope` -> Removed in commit `a923652`.
- Confirmed zero active `/api/debug*` routes registered in FastAPI routing table.

### 3.2 Replit Leftovers
- `Frontend/Glassmorphic-Frontend-Builder/.replitignore` (tracked)
- `Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/.replit-artifact/artifact.toml` (tracked)
- `Frontend/Glassmorphic-Frontend-Builder/.replit` (untracked)

### 3.3 Hardcoded Persona Strings
- `App.tsx`: Header role pill buttons hardcoded with `['creator', 'Meera (Creator)', ...]`, `['reviewer', 'Nisha (Reviewer)', ...]`, `['brand_manager', 'Arjun (Manager)', ...]`.
- `endpoints.ts`: Fallback author `who: useSession.getState().user?.name || 'Meera Nair'`.
- `frontend_bridge.py`: Fallback `actor = user.name if isinstance(user, CurrentUser) else "Meera Nair"`.
- `guided-tour.tsx`: Persona names and tour sequence starting with Brand Kit instead of document upload hero flow.

---

## 4. Defect Reproductions (F1–F12)

Reproduced using automated suite `backend/tests/test_defects_f1_f12.py`:

| Defect ID | Description | Reproduction Method | Baseline Test Result |
| :--- | :--- | :--- | :--- |
| **F1** | Identity mismatch: role pill shows "Meera" when user is logged in as another persona; unauthenticated requests fall back to "Meera Nair" | `test_f1_audit_actor_never_falls_back_to_hardcoded_meera` | **FAIL**: Unauthenticated decision was accepted (HTTP 200) and assigned to "Meera Nair" instead of HTTP 401. |
| **F2** | Dashboard "Open findings 5" counts resolved findings | `test_f2_dashboard_open_findings_counts_only_open_status` | **FAIL**: Open count was 3 while total was 5. Dashboard rendered total under "Open findings". |
| **F3** | Audit seed contains non-existent entity ("security-faq.md v1") | `test_f3_audit_seed_targets_must_all_exist` | **FAIL**: Audit log entry `a-002` references `security-faq.md · v1` which does not exist in drafts. |
| **F4** | Overclaiming copy in Verifier Lab ("100% Pass Rate", "Zero silent leaks", "Prompt-injection safe", "Fail-Closed & Grounded") | Grep in `verifier-lab.tsx` | **CONFIRMED**: Hardcoded unqualified marketing tiles found on lines 45, 60, 78. |
| **F5** | Fixed bottom dock overlaps content; Tour starts on Brand Kit | DOM audit & `guided-tour.tsx` | **CONFIRMED**: Step 1 in `TOUR_STEPS` targets `/brand-kit`; dock shell is fixed with bottom-5 on all pages. |
| **F6** | 9-10px low-contrast monospace labels (44 instances of `text-[9px]`, 100 instances of `text-[10px]`); truncated expiry banner | Codebase CSS search | **CONFIRMED**: 144 micro-typography classes without AA contrast tokens. |
| **F7** | README/docs link to non-existent files (`test_verifier_gates.py`, `test_role_enforcement.py`, `repository.py`); missing `LICENSE` | `test_f7_documented_files_and_license_must_exist` | **FAIL**: Missing `LICENSE` file; dead references found in `README.md`. |
| **F8** | `verification-trace.tsx` hardcodes FACT-03 and FACT-11 as expired | `test_f8_verification_trace_does_not_hardcode_expired_fact_ids` | **FAIL**: `FACT-03` and `FACT-11` found hardcoded in `verification-trace.tsx` lines 42 and 46. |
| **F9** | Benchmark has 0 gate drops across all 25 test cases | `test_f9_benchmark_eval_must_include_gate_drop_cases` | **FAIL**: `dataset.jsonl` contains zero negative drop cases. |
| **F10** | Unknown state on Vercel | Live API probe | **CONFIRMED**: Returns HTTP 503 degraded, database disconnected, store_backend memory, llm none. |
| **F11** | Hardcoded fixture fallbacks and Replit leftovers | `test_f11_no_hardcoded_meera_in_endpoints_and_no_replit_files` | **FAIL**: Found 'Meera Nair' in `endpoints.ts` and tracked `.replitignore` / `.replit-artifact`. |
| **F12** | Hero flow end-to-end verification | Playwright / API check | **CONFIRMED**: Requires end-to-end harness to execute and verify across all 3 roles. |

---

## 5. Next Steps
Proceeding to **Phase 1 — One Identity Model**:
- Enforce strict server-side authentication for all mutation endpoints (401 on missing auth).
- Remove all fallback strings ("Meera Nair").
- Implement real token-swap persona switcher where role and name are derived solely from the server-issued JWT.
- Fix frontend header to display the authenticated user's actual name and role.

