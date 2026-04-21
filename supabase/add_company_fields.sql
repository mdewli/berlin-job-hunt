-- =============================================================================
-- Berlin Job Hub — Add company crawl fields
-- Run this ONCE in the Supabase SQL editor.
--
-- Adds four columns to the companies table that drive the automated
-- job-board discovery pipeline:
--
--   job_board_url   — URL of the company's job listings page (the page
--                     that lists all open roles, NOT a single posting).
--   ats_type        — Hint for the crawler: 'greenhouse', 'lever',
--                     'workday', 'smartrecruiters', 'custom', …
--   last_crawled_at — Timestamp of the most recent successful crawl.
--                     NULL = never crawled.
--   is_active       — Set to false to pause crawling without deleting.
-- =============================================================================

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS job_board_url   TEXT,
    ADD COLUMN IF NOT EXISTS ats_type        TEXT,
    ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true;

-- Index so the discover pipeline can efficiently fetch only crawlable companies
CREATE INDEX IF NOT EXISTS idx_companies_active_board
    ON public.companies (is_active, job_board_url)
    WHERE is_active = true AND job_board_url IS NOT NULL;

-- =============================================================================
-- Done. Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'companies' ORDER BY ordinal_position;
-- =============================================================================
