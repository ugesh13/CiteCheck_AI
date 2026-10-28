-- =============================================================================
-- CiteCheck AI — Full Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Custom Enums ────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('creator', 'brand_manager', 'reviewer');
CREATE TYPE finding_category AS ENUM ('tone', 'terminology', 'claim', 'accessibility', 'formatting');
CREATE TYPE finding_severity AS ENUM ('high', 'medium', 'low');
CREATE TYPE human_decision_type AS ENUM ('accepted', 'edited', 'dismissed');
CREATE TYPE draft_status_type AS ENUM ('draft', 'under_review', 'approved', 'changes_requested');
CREATE TYPE verification_status_type AS ENUM ('verified', 'needs_review', 'dropped');

-- ─── 1. Profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT,
    role        user_role NOT NULL DEFAULT 'creator',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Brand Kits ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_kits (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    created_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Guidelines ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guidelines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_kit_id    UUID NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
    guideline_code  TEXT NOT NULL UNIQUE,
    category        finding_category NOT NULL,
    title           TEXT NOT NULL,
    rule_description TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Approved Facts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approved_facts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_kit_id    UUID NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
    fact_code       TEXT NOT NULL UNIQUE,
    statement       TEXT NOT NULL,
    source_document TEXT NOT NULL,
    review_date     DATE NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Approved Terminology ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approved_terms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_kit_id    UUID NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
    preferred_term  TEXT NOT NULL,
    forbidden_terms TEXT[] NOT NULL,
    usage_note      TEXT
);

-- ─── 6. Drafts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drafts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_kit_id    UUID NOT NULL REFERENCES public.brand_kits(id),
    creator_id      UUID REFERENCES public.profiles(id),
    title           TEXT NOT NULL,
    current_content TEXT NOT NULL,
    file_format     TEXT DEFAULT 'markdown',
    status          draft_status_type DEFAULT 'draft',
    current_version INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. Draft Versions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.draft_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id        UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    content_text    TEXT NOT NULL,
    diff_summary    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(draft_id, version_number)
);

-- ─── 8. Findings (5-Gate Engine Output) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.findings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id            UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
    version_number      INT NOT NULL,
    category            finding_category NOT NULL,
    severity            finding_severity NOT NULL,
    exact_excerpt       TEXT NOT NULL,
    reason              TEXT NOT NULL,
    cited_fact_id       UUID REFERENCES public.approved_facts(id),
    cited_guideline_id  UUID REFERENCES public.guidelines(id),
    suggested_fix       TEXT,
    is_intent_guarded   BOOLEAN DEFAULT FALSE,
    verification_status verification_status_type DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. Decisions (Human Review Workflow) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decisions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id       UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES public.profiles(id),
    action           human_decision_type NOT NULL,
    custom_edit_text TEXT,
    dismissal_reason TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. Audit Logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id    UUID REFERENCES public.drafts(id),
    actor_id    UUID REFERENCES public.profiles(id),
    action_type TEXT NOT NULL,
    payload     JSONB,
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. Automatic Updated At Trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_brand_kits_updated_at ON public.brand_kits;
CREATE TRIGGER trigger_brand_kits_updated_at
    BEFORE UPDATE ON public.brand_kits
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_drafts_updated_at ON public.drafts;
CREATE TRIGGER trigger_drafts_updated_at
    BEFORE UPDATE ON public.drafts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── 12. Performance B-Tree Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_brand_kits_created_by ON public.brand_kits(created_by);
CREATE INDEX IF NOT EXISTS idx_guidelines_brand_kit_id ON public.guidelines(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_approved_facts_brand_kit_id ON public.approved_facts(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_approved_terms_brand_kit_id ON public.approved_terms(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_drafts_creator_id ON public.drafts(creator_id);
CREATE INDEX IF NOT EXISTS idx_drafts_brand_kit_id ON public.drafts(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_id ON public.draft_versions(draft_id);
CREATE INDEX IF NOT EXISTS idx_findings_draft_id ON public.findings(draft_id);
CREATE INDEX IF NOT EXISTS idx_findings_cited_fact_id ON public.findings(cited_fact_id);
CREATE INDEX IF NOT EXISTS idx_findings_cited_guideline_id ON public.findings(cited_guideline_id);
CREATE INDEX IF NOT EXISTS idx_decisions_finding_id ON public.decisions(finding_id);
CREATE INDEX IF NOT EXISTS idx_decisions_user_id ON public.decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_draft_id ON public.audit_logs(draft_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- ─── Row Level Security (RLS) & Multi-Tenancy Isolation ──────────────────────

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Production Policy: Strict User Isolation (Active when auth.uid() is populated)
CREATE POLICY "Strict user draft isolation" ON public.drafts
    FOR ALL
    USING (auth.uid() IS NULL OR auth.uid() = creator_id)
    WITH CHECK (auth.uid() IS NULL OR auth.uid() = creator_id);

-- Permissive policies for Demo / Anonymous access:
CREATE POLICY "Allow read drafts"   ON public.drafts    FOR SELECT USING (true);
CREATE POLICY "Allow insert drafts" ON public.drafts    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update drafts" ON public.drafts    FOR UPDATE USING (true);
CREATE POLICY "Allow all findings"  ON public.findings  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Allow all decisions" ON public.decisions  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Allow all audit logs" ON public.audit_logs FOR ALL   USING (true) WITH CHECK (true);

-- ─── Seed Data ──────────────────────────────────────────────────────────────

INSERT INTO public.brand_kits (id, name, description)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Acme Corp Brand Kit 2026',
    'Official enterprise tone and product facts'
) ON CONFLICT DO NOTHING;

INSERT INTO public.guidelines (brand_kit_id, guideline_code, category, title, rule_description)
VALUES
    ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'GUIDE-01', 'tone',
     'No Absolute Guarantees',
     'Do not promise 100% uptime or guaranteed zero errors in marketing materials.'),
    ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'GUIDE-02', 'accessibility',
     'Plain Language Requirement',
     'Avoid overly complex technical jargon in general public announcements.')
ON CONFLICT DO NOTHING;

INSERT INTO public.approved_facts (brand_kit_id, fact_code, statement, source_document, review_date)
VALUES
    ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'FACT-12',
     'CiteCheck AI assists teams in catching compliance issues prior to publication.',
     'Q3 Brand Policy Doc v2', '2026-12-31'),
    ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'FACT-15',
     'Acme Cloud platform achieves 99.9% measured availability.',
     '2025 Infrastructure Audit', '2025-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO public.approved_terms (brand_kit_id, preferred_term, forbidden_terms, usage_note)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Governance Platform',
    ARRAY['Checking tool', 'AI Guardrail', 'Auto-fixer'],
    'Always refer to the product as a Governance Platform.'
) ON CONFLICT DO NOTHING;
