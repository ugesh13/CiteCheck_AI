# CiteCheck AI — UI States Audit & Architecture Matrix

> **Authoritative Specification & State Inventory**
> Audited against all 14 pages and actions in CiteCheck AI. Defines the implementation matrix for the 10 universal UI states under Rule S1–S5 (zero staged data, zero fake progress).

---

## 1. Universal State Kit Architecture (`src/components/states/`)

All 10 states are implemented as composable, accessible, reusable primitives in `src/components/states/`:

| Component | Responsibility & Accessibility Contract | Real Data / Condition Trigger |
| :--- | :--- | :--- |
| **`EmptyState`** | Explains what belongs here and provides clear primary/secondary call-to-action buttons. Uses `role="region"`. Text ≥ 12px, AA contrast. | Real empty dataset from query (`array.length === 0`). |
| **`LoadingState`** | Skeleton wireframes tailored to match the exact geometric layout of each card/table/editor, eliminating layout shift. | Query pending (`isLoading === true`). Disables action buttons. |
| **`ErrorState`** | Translates HTTP/API error codes into friendly human language with a concrete remedy, actual Retry handler, and support request ID. Uses `role="alert"`. | Real fetch failure (`isError === true` or HTTP 4xx/5xx). |
| **`OfflineBanner`** | Fixed non-blocking banner at top of viewport; preserves cached data; auto-retries active read queries on reconnection. Uses `role="status"` and `aria-live="polite"`. | Browser `navigator.onLine === false` or window `offline` event. |
| **`SlowNotice`** | Appears after 2.5s of pending server latency. Displays live elapsed seconds and server stage label. Informs of serverless cold starts. | Latency timer (`elapsedMs >= 2500`). Real timer, not simulated. |
| **`NoResults`** | Explains what was searched, offers a "Clear filters" button, computes fuzzy suggestions from real cached items, and offers "Create draft named '<query>'". | Search query matches 0 items while dataset is non-empty. |
| **`PermissionDenied`** | Explains role requirements (e.g. Creator vs Reviewer vs Brand Manager), why action is blocked, and provides a 1-click role switcher or navigation exit. | Server HTTP 403 or client role mismatch (`canEdit === false`). |
| **`SessionExpiredDialog`** | Captures active unsaved forms to `localStorage` before displaying a non-disruptive re-authentication modal; restores typed drafts seamlessly upon re-login. | Server HTTP 401, invalid JWT, or expired `exp` claim. |
| **`FieldError`** | Inline field error message displaying exact validation constraint ("At least 10 characters", "Valid future date required"). Announces via `aria-live="assertive"`. Focuses first invalid field on submit. | Zod schema validation failure on blur or submit. |
| **`SuccessPanel`** | Confirmation panel displaying exact state change ("Draft locked at v3") and immediate next action ("Back to queue", "View audit entry"). Subtle checkmark, respects `prefers-reduced-motion`. No confetti. | Successful mutation completion (`onSuccess`). |

---

## 2. Page & Action State Inventory

| Page / Action | Target File | Empty | Loading | Error | Offline | Slow | No Results | Perm Denied | Session Exp | Field Error | Success |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Overview (Dashboard)** | `src/App.tsx` | 🟡 (Basic) | 🟡 (Card) | 🟡 (Fallback) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) |
| **Drafts List** | `src/App.tsx` | 🟢 (Present) | 🟡 (Card) | 🟡 (Fallback) | 🔴 (Missing) | 🔴 (Missing) | 🟡 (Partial) | ⚪ (N/A) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) |
| **New Draft** | `src/App.tsx` | ⚪ (N/A) | 🟢 (Button) | 🟡 (Toast) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Creator) | 🔴 (Missing) | 🟡 (Zod) | 🟢 (Navigate) |
| **DOCX Ingestion Modal** | `src/App.tsx` | ⚪ (N/A) | 🟢 (Spinner) | 🟢 (Friendly) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Creator) | 🔴 (Missing) | 🟢 (Valid) | 🟢 (Created) |
| **Draft Room (Editor)** | `src/App.tsx` | 🟢 (No findings) | 🟡 (Card) | 🟡 (Fallback) | 🔴 (Missing) | 🔴 (Missing) | 🟡 (Filter) | 🟢 (Locked) | 🔴 (Missing) | 🟡 (Inline) | 🟡 (Toast) |
| **Review Queue** | `src/App.tsx` | 🟢 (Empty queue) | 🟡 (Card) | 🟡 (Fallback) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Desk) | 🔴 (Missing) | 🟡 (Inline) | 🟢 (Locked) |
| **Brand Kit** | `src/pages/brand-kit.tsx` | 🟢 (Empty tab) | 🟡 (Skeleton) | 🟢 (Error) | 🔴 (Missing) | 🔴 (Missing) | 🟡 (Filter) | 🟢 (Manager) | 🔴 (Missing) | 🟢 (Modal) | 🟢 (Toast) |
| **Renew Fact Modal** | `src/pages/brand-kit.tsx` | ⚪ (N/A) | 🟢 (Button) | 🟢 (Error) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Manager) | 🔴 (Missing) | 🟢 (Dates) | 🟢 (Audit) |
| **Verifier Lab** | `src/pages/verifier-lab.tsx` | ⚪ (N/A) | 🟢 (Real test) | 🟢 (Error) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | 🟢 (Inline) | 🟢 (Report) |
| **Gap Radar** | `src/pages/gap-radar.tsx` | 🟢 (No gaps) | 🟡 (Card) | 🟢 (Error) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Manager) | 🔴 (Missing) | 🟢 (Reason) | 🟢 (Audit) |
| **Audit Trail** | `src/pages/audit.tsx` | 🟢 (No rows) | 🟡 (Card) | 🟢 (Error) | 🔴 (Missing) | 🔴 (Missing) | 🟡 (Partial) | ⚪ (N/A) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (CSV) |
| **Settings** | `src/App.tsx` | ⚪ (N/A) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | ⚪ (N/A) | 🟢 (Toast) |
| **Login & Consent** | `src/App.tsx` | ⚪ (N/A) | 🟢 (Button) | 🟢 (Inline) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) | ⚪ (N/A) | 🟢 (Zod) | 🟢 (OAuth) |
| **Notification Center** | `src/App.tsx` | 🟢 (Empty list) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) | 🔴 (Missing) | ⚪ (N/A) | ⚪ (N/A) |

*Legend: 🟢 Complete & Verified | 🟡 Partial / Needs Shared Kit Component | 🔴 Missing (Target for Phase 2–7) | ⚪ Not Applicable*

---

## 3. Implementation Plan by Phase

1. **Phase 2**: Create `src/components/states/index.tsx` containing `EmptyState`, `LoadingState`, `ErrorState`. Deploy across Overview, Drafts, Draft Room, Review Queue, Brand Kit, Gap Radar, and Audit Trail.
2. **Phase 3**: Create `OfflineBanner` and `SlowNotice` in `src/components/states/`. Integrate in `AppShell` with window offline listener and 2.5s request timer.
3. **Phase 4**: Create `NoResults` with fuzzy candidate matching and "Create draft" CTA. Integrate across Drafts list search, Command palette, and Audit log filters.
4. **Phase 5**: Create `PermissionDenied` locked desk component and HTTP 403 boundary.
5. **Phase 6**: Create `SessionExpiredDialog` with auto-saving to `localStorage` and draft restoration.
6. **Phase 7**: Implement `FieldError` and `SuccessPanel` with focus management and reduced motion support.
7. **Phase 8**: Playwright automation suite verifying every state with screenshots.

