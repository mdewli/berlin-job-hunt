-- =============================================================================
-- RLS Setup Notes for Berlin Job Hub
-- =============================================================================
-- Run init.sql FIRST, then this file (or combine in the Supabase SQL editor).
--
-- HOW RLS BYPASS WORKS IN THIS PROJECT
-- ─────────────────────────────────────
-- Django + Crawler   →  psycopg2 direct connection (port 5432) with the
--                        'postgres' superuser.  Postgres superusers bypass
--                        RLS automatically. No extra config needed.
--
-- React frontend     →  Supabase JS client with the 'anon' key.
--                        Goes through PostgREST, RLS is ENFORCED. (Correct!)
--
-- The RLS policies in init.sql already handle this split:
--   companies        →  public read
--   job_postings     →  public read (active only)
--   saved_jobs       →  owner-only read/write (auth.uid() = user_id)
--
-- OPTIONAL: dedicated server-side role (better than using postgres superuser)
-- =============================================================================

-- Create a dedicated application role that bypasses RLS.
-- Use this as POSTGRES_USER in .env instead of 'postgres' for better hygiene.
--
-- Run in Supabase SQL editor:

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'berlinjob_app'
    ) THEN
        CREATE ROLE berlinjob_app WITH LOGIN PASSWORD 'replace-with-strong-password';
    END IF;
END
$$;

-- Grant full access to our tables
GRANT USAGE ON SCHEMA public TO berlinjob_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO berlinjob_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO berlinjob_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO berlinjob_app;

-- The key line: this role skips RLS checks entirely
ALTER ROLE berlinjob_app BYPASSRLS;

-- Future tables will also be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO berlinjob_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO berlinjob_app;

-- =============================================================================
-- After running this, update your .env:
--   POSTGRES_USER=berlinjob_app
--   POSTGRES_PASSWORD=replace-with-strong-password
-- =============================================================================
