-- =============================================================================
-- Berlin Job Hub — Fix permissions + deduplication
-- Run this in the Supabase SQL editor (once).
-- =============================================================================


-- =============================================================================
-- 1. GRANT SELECT to the anon role
--    Without these, the PostgREST / supabase-js client gets
--    "permission denied for table ..." even when RLS policies allow the rows.
-- =============================================================================

GRANT USAGE  ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.companies    TO anon, authenticated;
GRANT SELECT ON TABLE public.job_postings TO anon, authenticated;

-- saved_jobs: authenticated users need full CRUD
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_jobs TO authenticated;


-- =============================================================================
-- 2. Add UNIQUE constraint on job_postings.apply_url
--    The crawler's ON CONFLICT (apply_url) DO UPDATE needs this index.
--    First, remove duplicate rows keeping only the oldest one per URL.
-- =============================================================================

-- 2a. Delete duplicates — keep the row with the smallest ctid (insertion order)
DELETE FROM public.job_postings
WHERE ctid NOT IN (
    SELECT min(ctid)
    FROM public.job_postings
    GROUP BY apply_url
);

-- 2b. Now safe to add the constraint
ALTER TABLE public.job_postings
    ADD CONSTRAINT job_postings_apply_url_key UNIQUE (apply_url);


-- =============================================================================
-- Done. Verify with:
--   SELECT COUNT(*) FROM public.job_postings;
--   \dp public.job_postings    -- shows grants
-- =============================================================================
