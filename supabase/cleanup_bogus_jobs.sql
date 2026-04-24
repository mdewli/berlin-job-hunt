-- ============================================================
-- cleanup_bogus_jobs.sql
-- Run this in the Supabase SQL editor to remove junk rows.
-- ============================================================

-- 1. Delete all Unknown-title postings (cookie walls, product pages, etc.)
DELETE FROM public.job_postings
WHERE is_active = true
  AND title = 'Unknown';

-- Check how many were removed:
-- SELECT count(*) FROM public.job_postings WHERE title = 'Unknown';

-- 2. Delete Contentful product/marketing page URLs that slipped through
--    (URLs matching /products/, /solutions/, /blog/, /resources/, etc.)
DELETE FROM public.job_postings
WHERE company_id = (
    SELECT id FROM public.companies WHERE normalized_name = 'contentful' LIMIT 1
)
AND (
    apply_url NOT LIKE '%/careers/job/%'
    AND apply_url NOT LIKE '%/jobs/%'
    AND apply_url NOT LIKE '%greenhouse.io%'
);

-- 3. Delete ResearchGate aggregated jobs (non-ResearchGate apply URLs)
--    ResearchGate /job/NUMBER_TITLE links go to pharma/biotech companies, not RG itself
DELETE FROM public.job_postings
WHERE company_id = (
    SELECT id FROM public.companies WHERE normalized_name = 'researchgate' LIMIT 1
)
AND apply_url LIKE '%researchgate.net/job/%';

-- 4. Delete non-Germany jobs from global companies (Spanish, Belgian, Philippine roles etc.)
--    These have is_in_berlin = false AND their apply_url language/location is non-German.
--    Safe heuristic: title or URL contains a clear non-German signal.
DELETE FROM public.job_postings
WHERE is_in_berlin = false
  AND is_active = true
  AND (
    -- Spanish roles
    (languages::text LIKE '%"spanish"%' AND languages::text NOT LIKE '%"german"%' AND languages::text NOT LIKE '%"english"%')
    OR
    -- Dutch/Belgian/Philippine roles with no German
    (languages::text LIKE '%"dutch"%' AND languages::text NOT LIKE '%"german"%')
    OR
    -- Explicit non-German city in URL
    apply_url LIKE '%-philippine%'
    OR apply_url LIKE '%-philippines%'
    OR apply_url LIKE '%-belgium%'
    OR apply_url LIKE '%-nederland%'
    OR apply_url LIKE '%-spanish-speaker%'
    OR apply_url LIKE '%-france%'
  );

-- 5. Deactivate (soft-delete) all jobs that are is_in_berlin = false
--    and have no german language requirement — keeping them but hiding from main feed.
--    (Optional — uncomment if you want to be aggressive)
-- UPDATE public.job_postings
-- SET is_active = false, updated_at = now()
-- WHERE is_in_berlin = false
--   AND is_active = true
--   AND languages::text NOT LIKE '%"german"%';

-- ── Summary after cleanup ────────────────────────────────────────────────────
SELECT
    c.name                  AS company,
    count(*)                AS active_jobs,
    sum(CASE WHEN jp.is_in_berlin THEN 1 ELSE 0 END) AS berlin_compatible
FROM public.job_postings jp
JOIN public.companies c ON c.id = jp.company_id
WHERE jp.is_active = true
GROUP BY c.name
ORDER BY active_jobs DESC;
