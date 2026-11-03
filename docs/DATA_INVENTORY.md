# CiteCheck AI — Data and Third-Party Inventory

> **Draft — review by a qualified person before relying on it.**
> This document was generated directly from code inspection, endpoint audits, and Playwright network traffic captures (`docs/evidence/NETWORK_CAPTURE.json`) on the deployed demo (`https://citecheck-jet.vercel.app`).

---

## 1. Executive Summary

CiteCheck AI is a free hackathon demo built for content verification against ground-truth brand guidelines and facts. It operates under a **privacy-by-default, data-minimization architecture**:
- **Zero Third-Party Trackers or Analytics**: No Google Analytics, Segment, Meta Pixel, or telemetry beacons.
- **Zero Third-Party Font CDNs**: All fonts are served using high-performance native system font stacks; zero requests are made to `fonts.googleapis.com` or `fonts.gstatic.com`.
- **Zero Non-Essential Cookies**: Zero tracking or third-party cookies are set (`Cookies present: 0`).
- **Pseudonymized Client Telemetry**: Client IP addresses are salted and hashed via SHA-256 (`ip:<16-hex-chars>`) in volatile memory for sliding-window rate limiting; raw IP addresses are never logged or persisted.

---

## 2. Personal & User Data Inventory

| Data Item | Description & Scope | Storage Location | Retention Period | Recipients & Third Parties | Purpose & Legal Basis |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google OAuth Profile** | User's full name, email address, profile picture URL, and Google user ID (`sub`). Requested scopes: `openid email profile`. | Browser `localStorage` (`citecheck_user`), Supabase Auth session. | Duration of session / until sign-out. | Google Identity Services, Supabase Auth. | Session authentication and displaying user identity in workspace. |
| **Bearer Session Token** | Ephemeral JWT access token issued upon OAuth callback or demo role login. | Browser `localStorage` (`citecheck_token`). | Deleted on logout or browser cache purge. | Supabase Auth, Backend API via `Authorization: Bearer` header. | Stateless API request authorization and role validation. |
| **Active Persona / Role** | Active workspace permission role (`creator`, `reviewer`, `brand_manager`). | Browser `localStorage` (`citecheck_oauth_role`). | Retained across sessions until role switch or logout. | Backend API request context. | Role-based view switching and access control enforcement. |
| **Tour Dismissal Flag** | Boolean flag indicating whether the 7-step guided tour was dismissed (`'true'`). | Browser `localStorage` (`citecheck_dismiss_tour`). | Persistent until browser cache clear. | Client-side only. | UI preference: prevents intrusive popup on repeated visits. |
| **Draft Content** | Title, text content (.md, .txt, or uploaded .docx), character count, word count, version history. | Supabase PostgreSQL `drafts` / `draft_versions` table, serverless memory. | Hackathon demo lifecycle (purged periodically). | Backend API, external LLM provider (when review is explicitly triggered). | Verification against Brand Kit guidelines and facts. |
| **Review Findings & Decisions** | Finding ID, excerpt quote, offset range, severity, status, dismissal reason, human edited fix. | Supabase PostgreSQL `findings` table. | Hackathon demo lifecycle. | Backend API, workspace team members. | Workflow auditability and gap radar pattern aggregation. |
| **Audit Trail Records** | Action name, entity target, previous state, new state, actor name, timestamp, SHA-256 block hash. | Supabase PostgreSQL `audit_log` table. | Permanent for cryptographic hash chain continuity. | Workspace members with Brand Manager role. | Tamper-evident governance and verification integrity. |
| **Client IP Address** | Remote IP connecting to API endpoints. | Volatile memory only, hashed via `sha256(citecheck-salt:{ip})[:16]`. | Maximum 60 seconds (sliding window). | None (kept in serverless memory only). | Sliding-window DDoS and brute-force rate limiting (120 req/min). |

---

## 3. Third-Party Services & Host Allowlist

All outbound network requests from CiteCheck AI are strictly restricted to the following audited hosts:

| Hostname / Service | Category | Data Transmitted | Data Received | Justification |
| :--- | :--- | :--- | :--- | :--- |
| `citecheck-jet.vercel.app` | First-Party Hosting (Vercel) | Static assets, API routes, HTML documents. | Web application bundles, SSR responses. | Application delivery. |
| `*.supabase.co` | Database & Auth (Supabase) | Authentication tokens, draft mutations, audit logs. | Query results, JWT validation tokens. | Relational persistence and OAuth integration. |
| `accounts.google.com` | Identity Provider (Google OAuth) | Authorization code, client ID, PKCE challenge. | ID token containing name, email, avatar URL. | Secure passwordless sign-in for users. |
| `generativelanguage.googleapis.com` | LLM Review Engine (Gemini) *(Optional)* | Verbatim draft excerpts and relevant brand kit rules. | Candidate finding suggestions with confidence score. | AI-assisted rule suggestions (only when user clicks "Run review"). |

**Strictly Excluded Hosts**:
- ❌ `fonts.googleapis.com` / `fonts.gstatic.com` (Removed; system font stack utilized).
- ❌ `google-analytics.com` / `doubleclick.net` (Not installed).
- ❌ `segment.io` / `mixpanel.com` / `hotjar.com` (Not installed).
- ❌ Ad networks, trackers, or marketing pixels (Zero presence).

---

## 4. LocalStorage & Client Storage Inventory

Browser storage is strictly limited to 4 functional keys:

```typescript
const ALLOWED_LOCALSTORAGE_KEYS = [
  'citecheck_token',         // Active JWT bearer session token
  'citecheck_user',          // Active profile JSON { id, name, email, role }
  'citecheck_oauth_role',    // Current active role for persona switcher
  'citecheck_dismiss_tour',  // Dismissal state for guided onboarding
];
```

No cookies are set by CiteCheck AI (`Set-Cookie` header count: 0). Because no tracking, profiling, or non-essential cookies are utilized, no disruptive cookie wall or blocking banner is required under ePrivacy regulations. A non-blocking informative banner linking to `/privacy` provides complete transparency.

---

## 5. Verification & Telemetry Evidence

Automated continuous verification tests:
- `backend/tests/test_data_inventory.py::test_zero_third_party_fonts_in_html_files` ✅
- `backend/tests/test_data_inventory.py::test_ip_pseudonymization_in_rate_limiter` ✅
- `backend/tests/test_data_inventory.py::test_local_storage_keys_inventory` ✅
- Network capture log: `docs/evidence/NETWORK_CAPTURE.json` ✅

