# 🎬 CiteCheck AI — 90-Second Judge Evaluation Walkthrough
### *Fast, High-Impact Demo Script for Inkloom AI Brand Governance Final*

> **Universal Product Line:**  
> *"CiteCheck blocks unsupported AI claims before publication — every finding is cited, verified, and human-approved."*

**Live Production Link:** [https://citecheck-jet.vercel.app](https://citecheck-jet.vercel.app)  
**Estimated Time:** 90 Seconds  
**Demo Personas:**  
1. ✍️ **Meera Nair (Creator)** — Draft authoring, verification, and resolution.  
2. 👓 **Nisha Rao (Reviewer)** — Verification audit, threaded review, and publication sign-off.  
3. 🏛️ **Arjun Mehta (Brand Manager)** — Fact governance, expiration renewal, and policy gap remediation.

---

### Step 0: Quick Reset & Environment Health (10 Seconds)
1. Open [https://citecheck-jet.vercel.app](https://citecheck-jet.vercel.app).
2. Look at the top navigation bar: Note the **Role Switcher Pill Trio** (`Meera`, `Nisha`, `Arjun`) and the **Health Status Indicator** (`Supabase / Memory Store`, `LLM Status`).
3. *(Optional)* Click your user avatar in the top right → click **"Restart Guided Tour"** for the interactive multi-step tour.

---

### Act 1: The Creator Experience — Evidence-First Verification (30 Seconds)
1. **Switch Role to Meera (Creator):** Click `Meera (Creator)` in the header.
2. **Open the Review Room:** Navigate to **Review Room** (or `/review`).
3. **Inspect the Draft:** Notice the sample draft for *Lumen Pay*:
   > *"Lumen Pay is the world's most trusted payments infrastructure... processing over 99.999% uptime with 0% transaction fees forever."*
4. **Click "Run Five-Gate Review":**
   * Watch the findings render instantly in **< 1 millisecond**.
   * Note the **Five-Gate Funnel Bar**: Shows total candidates processed, active findings, and gate drops.
5. **Inspect the 5-Gate Trace:**
   * Expand the finding for *"most trusted"*: Click **"Five-Gate Trace"** to view all five checkmarks:
     * `Gate 1 (Strict Schema): PASSED`
     * `Gate 2 (Brand Kit Match: GUIDE-01): PASSED`
     * `Gate 3 (Exact Quote Verification): PASSED`
     * `Gate 4 (Context Guardrail): PASSED`
     * `Gate 5 (Fact Expiry Check): PASSED`
6. **Resolve Findings:**
   * Click **Accept Fix** on the first finding to automatically substitute compliant phrasing.
   * On an unsupported statistic finding, click **Dismiss**, select reason **"Tone Mismatch"** or **"Context Exception"**, and type a brief comment: *"Approved for Q4 pilot campaign"*.

---

### Act 2: The Reviewer Checkpoint — Guardrails Against Expired Claims (20 Seconds)
1. **Switch Role to Nisha (Reviewer):** Click `Nisha (Reviewer)` in the header.
2. Notice the role banner updates instantly with Reviewer privileges.
3. Look at the **Blocked Sign-off Guardrail**:
   * If a draft cites an expired corporate fact (`FACT-03`), note that the **"Approve & Lock Draft"** button is disabled with an amber warning:
     > *"Sign-off blocked: 1 finding cites an expired corporate fact. Requires Brand Manager renewal before publication."*
4. Click **View Version Diff** to see line-by-line colored diffs (`Draft v1` vs `Draft v2`).
5. Add a threaded review comment: *"Ready for brand approval once marketing updates the expired stat."*

---

### Act 3: Brand Governance & Policy Remediation (30 Seconds)
1. **Switch Role to Arjun (Brand Manager):** Click `Arjun (Brand Manager)` in the header.
2. **Navigate to Brand Kit → Facts (`/brand-kit`):**
   * Inspect the **Fact Health Strip**: Live counts of Active, Expiring Soon (<30 days), and Expired facts.
   * Click the **"Needs Renewal"** filter pill.
   * Click **Renew** on the expired fact: Select a new expiration date (+90 days), provide reason *"Audited with finance team"*, and click **Confirm Renewal**.
   * Click **View Renewal History** to see the complete immutable audit trail of who changed what and when.
3. **Navigate to Guideline Gap Radar (`/gap-radar`):**
   * Observe the policy friction ranking: See which guidelines have high creator dismissal rates.
   * Click **"View Friction Analysis"** on `GUIDE-01` (Superlatives): Read the real creator comments explaining why the rule triggered false alarms.
   * Click **"Exempt Context"** or **"Clarify Threshold"**: Select the remediation action to update company guidelines in one click.
4. **Navigate to Audit Trail (`/audit`):**
   * Inspect the append-only log recording every user action.
   * Click **"Verify Chain Integrity"**: Observe the cryptographic SHA-256 hash validation confirming zero log tampering.

---

### Summary for Judges
* In 90 seconds, you witnessed the complete governance loop:
  * **No hallucinated findings:** Guaranteed by the Five-Gate Verifier.
  * **No expired claims published:** Guaranteed by automated Gate 5 freshness checks.
  * **No rigid bureaucracy:** Creator dismissals directly inform Brand Managers via the Guideline Gap Radar.
  * **Zero fiction:** All traces, hashes, and renewal histories are backed by real database models and code paths.
