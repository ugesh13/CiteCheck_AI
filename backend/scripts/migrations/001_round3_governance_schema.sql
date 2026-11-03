-- =============================================================================
-- Migration 001: Round 3 Governance Schema Enhancements
-- Upgrades CiteCheck AI with full enterprise governance, fact expiry tracking,
-- tamper-evident audit log hashing, notification center, and dropped candidates.
-- =============================================================================

-- 1. approved_facts columns for lifecycle & expiry governance
ALTER TABLE public.approved_facts
    ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS expires_on DATE,
    ADD COLUMN IF NOT EXISTS owner_id TEXT,
    ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT 'Brand Governance Team',
    ADD COLUMN IF NOT EXISTS status_override TEXT,
    ADD COLUMN IF NOT EXISTS renewal_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS allowed_wording TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prohibited_wording TEXT[] DEFAULT '{}';

-- Backfill expires_on from legacy review_date if present
UPDATE public.approved_facts
SET expires_on = review_date
WHERE expires_on IS NULL AND review_date IS NOT NULL;

-- 2. Fact History table (audit of renewals, extensions, status changes)
CREATE TABLE IF NOT EXISTS public.fact_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fact_id         TEXT NOT NULL,
    action          TEXT NOT NULL, -- renewed, archived, created, edited, overridden
    actor           TEXT NOT NULL,
    actor_role      TEXT DEFAULT 'brand_manager',
    reason          TEXT NOT NULL,
    old_expires_on  DATE,
    new_expires_on  DATE,
    at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fact_history_fact_id ON public.fact_history(fact_id);

-- 3. Notifications table (role-targeted in-app notification center)
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_role   TEXT NOT NULL, -- creator, reviewer, brand_manager, all
    kind        TEXT NOT NULL, -- expiry_warning, fact_expired, draft_blocked, fact_renewed, changes_requested
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    ref_type    TEXT,          -- fact, draft, finding, rule
    ref_id      TEXT,
    read        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notifications(user_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- 4. Findings additions for deep verification trace & block mapping
ALTER TABLE public.findings
    ADD COLUMN IF NOT EXISTS verification_trace JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.95,
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'rules', -- rules | llm
    ADD COLUMN IF NOT EXISTS paragraph_ref TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- 5. Dropped Candidates table (real halluncination / unverified claim logs)
CREATE TABLE IF NOT EXISTS public.dropped_candidates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id    TEXT NOT NULL,
    version     INT NOT NULL DEFAULT 1,
    raw         JSONB NOT NULL,
    failed_gate INT NOT NULL,
    reason      TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dropped_draft ON public.dropped_candidates(draft_id);

-- 6. Decisions enhancements for Gap Radar theme clustering
ALTER TABLE public.decisions
    ADD COLUMN IF NOT EXISTS dismissal_theme TEXT,
    ADD COLUMN IF NOT EXISTS is_false_positive BOOLEAN DEFAULT FALSE;

-- 7. Draft Versions locking for reviewer sign-off
ALTER TABLE public.draft_versions
    ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS locked_by TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 8. Audit Logs: append-only rule & tamper-evident hash chaining
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS prev_hash TEXT,
    ADD COLUMN IF NOT EXISTS hash TEXT,
    ADD COLUMN IF NOT EXISTS actor_name TEXT,
    ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- Prevent updates and deletes on audit_logs for strict append-only immutability
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- 9. Dismissal Events table (powers real Gap Radar analytics)
CREATE TABLE IF NOT EXISTS public.dismissal_events (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_or_fact_id    TEXT NOT NULL,
    draft_id           TEXT NOT NULL,
    finding_id         TEXT,
    reason             TEXT NOT NULL,
    theme              TEXT NOT NULL,
    user_name          TEXT NOT NULL,
    user_role          TEXT NOT NULL DEFAULT 'creator',
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dismissal_events_rule ON public.dismissal_events(rule_or_fact_id);

-- 10. Rule Revisions table (tracks before/after changes to policies)
CREATE TABLE IF NOT EXISTS public.rule_revisions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id     TEXT NOT NULL,
    old_text    TEXT NOT NULL,
    new_text    TEXT NOT NULL,
    reason      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rule_revisions_rule ON public.rule_revisions(rule_id);

