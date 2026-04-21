-- =============================================================================
-- Fix: upsert_company() function
-- Run this in the Supabase SQL editor to replace the broken version.
--
-- Changes vs. original:
--   1. Adds updated_at column to companies (was missing from initial schema).
--   2. Adds created_at column while we are here (good hygiene).
--   3. Drops the old function first (Postgres cannot change a return type
--      with CREATE OR REPLACE, so DROP + CREATE is required).
-- =============================================================================


-- =============================================================================
-- 1. Add missing timestamp columns to companies (safe: IF NOT EXISTS)
-- =============================================================================

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();


-- =============================================================================
-- 2. Drop old function and recreate with correct scalar RETURNING syntax
-- =============================================================================

DROP FUNCTION IF EXISTS public.upsert_company(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_company(
    p_name            TEXT,
    p_normalized_name TEXT,
    p_homepage_url    TEXT,
    p_company_size    TEXT DEFAULT NULL,
    p_hq_city         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.companies
        (name, normalized_name, homepage_url, company_size, hq_city)
    VALUES
        (p_name, p_normalized_name, p_homepage_url, p_company_size, p_hq_city)
    ON CONFLICT (homepage_url) DO UPDATE
        SET name            = EXCLUDED.name,
            normalized_name = EXCLUDED.normalized_name,
            company_size    = COALESCE(EXCLUDED.company_size,    companies.company_size),
            hq_city         = COALESCE(EXCLUDED.hq_city,         companies.hq_city),
            updated_at      = now()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;
