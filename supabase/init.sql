-- =============================================================================
-- Berlin Job Hub — Supabase / Postgres Init Script
-- Run once against your Supabase project via the SQL editor,
-- OR mount as /docker-entrypoint-initdb.d/init.sql for local dev.
-- =============================================================================

-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 1. COMPANIES  (The Registry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_name  TEXT        NOT NULL,
    homepage_url     TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    company_size     TEXT        CHECK (company_size IN ('Micro', 'Startup', 'Mid-size', 'Enterprise')),
    hq_city          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ── Uniqueness constraints (deduplication anchors) ──────────────────────
    CONSTRAINT companies_normalized_name_key UNIQUE (normalized_name),
    CONSTRAINT companies_homepage_url_key    UNIQUE (homepage_url)
);

-- Index for fast lookups by city (filter sidebar)
CREATE INDEX IF NOT EXISTS idx_companies_hq_city ON public.companies (hq_city);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 2. JOB_POSTINGS  (The Feed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.job_postings (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID        NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,

    title          TEXT        NOT NULL,
    description    TEXT,
    apply_url      TEXT        NOT NULL,

    -- CEFR language levels: {"german": "B2", "english": "C1"}
    languages      JSONB       NOT NULL DEFAULT '{}',

    -- e.g. ["Python", "SQL", "dbt"]
    tech_stack     JSONB       NOT NULL DEFAULT '[]',

    remote_type    TEXT        CHECK (remote_type IN ('Full-Remote', 'Hybrid', 'On-site')),

    -- True when job is in Berlin OR is Germany-wide Remote
    is_in_berlin   BOOLEAN     NOT NULL DEFAULT FALSE,

    role_category  TEXT,        -- "Data Science", "Backend", "Frontend", …

    -- Full-Text Search vector (populated by trigger below)
    search_vector  TSVECTOR,

    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    posted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    scraped_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- GIN index for Full-Text Search
CREATE INDEX IF NOT EXISTS idx_job_postings_search_vector
    ON public.job_postings USING GIN (search_vector);

-- Partial index: active Berlin/remote jobs (the primary feed query)
CREATE INDEX IF NOT EXISTS idx_job_postings_active_berlin
    ON public.job_postings (is_active, is_in_berlin, posted_at DESC)
    WHERE is_active = TRUE;

-- Partial index: filter by remote_type
CREATE INDEX IF NOT EXISTS idx_job_postings_remote_type
    ON public.job_postings (remote_type)
    WHERE is_active = TRUE;

-- GIN index for tech_stack JSONB queries (e.g. stack @> '["Python"]')
CREATE INDEX IF NOT EXISTS idx_job_postings_tech_stack
    ON public.job_postings USING GIN (tech_stack);

-- GIN index for languages JSONB queries
CREATE INDEX IF NOT EXISTS idx_job_postings_languages
    ON public.job_postings USING GIN (languages);

-- ── FTS trigger: rebuild search_vector on insert/update ──────────────────────
CREATE OR REPLACE FUNCTION public.update_job_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')),       'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT string_agg(value, ' ')
             FROM jsonb_array_elements_text(NEW.tech_stack)), ''
        )), 'C');
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_postings_search_vector ON public.job_postings;
CREATE TRIGGER trg_job_postings_search_vector
    BEFORE INSERT OR UPDATE ON public.job_postings
    FOR EACH ROW EXECUTE FUNCTION public.update_job_search_vector();


-- =============================================================================
-- 3. SAVED_JOBS  (User Feature)
-- Links Supabase auth.users → job_postings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.saved_jobs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL,   -- Supabase auth.users.id (no FK across schemas)
    job_id     UUID        NOT NULL REFERENCES public.job_postings (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT saved_jobs_user_job_key UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id
    ON public.saved_jobs (user_id, created_at DESC);


-- =============================================================================
-- 4. ROW-LEVEL SECURITY (Supabase)
-- =============================================================================

-- Companies & job postings: public read, no public write
ALTER TABLE public.companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs  ENABLE ROW LEVEL SECURITY;

-- Anyone can read companies
CREATE POLICY "companies_public_read"
    ON public.companies FOR SELECT USING (true);

-- Anyone can read active job postings
CREATE POLICY "job_postings_public_read"
    ON public.job_postings FOR SELECT USING (is_active = TRUE);

-- Users can only see their own saved jobs
CREATE POLICY "saved_jobs_owner_select"
    ON public.saved_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "saved_jobs_owner_insert"
    ON public.saved_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_jobs_owner_delete"
    ON public.saved_jobs FOR DELETE
    USING (auth.uid() = user_id);


-- =============================================================================
-- 5. HELPER: upsert_company()
-- Called by the crawler. Normalizes URL + name, then upserts.
-- Returns the canonical company UUID.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_company(
    p_name            TEXT,
    p_normalized_name TEXT,
    p_homepage_url    TEXT,
    p_company_size    TEXT DEFAULT NULL,
    p_hq_city         TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.companies
        (name, normalized_name, homepage_url, company_size, hq_city)
    VALUES
        (p_name, p_normalized_name, p_homepage_url, p_company_size, p_hq_city)
    ON CONFLICT (homepage_url) DO UPDATE
        SET name             = EXCLUDED.name,
            normalized_name  = EXCLUDED.normalized_name,
            company_size     = COALESCE(EXCLUDED.company_size, companies.company_size),
            hq_city          = COALESCE(EXCLUDED.hq_city,      companies.hq_city),
            updated_at       = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


-- =============================================================================
-- Done.
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- =============================================================================
