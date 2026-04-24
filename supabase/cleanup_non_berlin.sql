-- ============================================================
-- cleanup_non_berlin.sql
-- Run this once in the Supabase SQL editor to purge jobs that
-- are clearly not accessible to a Berlin-based worker.
-- ============================================================

-- Step 1: preview what will be deactivated (run this first)
-- SELECT id, title, remote_type, is_in_berlin,
--        c.name AS company, c.hq_city
-- FROM job_postings jp
-- JOIN companies c ON c.id = jp.company_id
-- WHERE jp.is_active = true
--   AND jp.is_in_berlin = false
--   AND jp.remote_type != 'Full-Remote'
-- ORDER BY c.name, jp.title;


-- Step 2: deactivate non-Berlin, non-remote jobs
-- (these were saved before the stricter location gate was added)
UPDATE public.job_postings
SET    is_active  = false,
       updated_at = now()
WHERE  is_active   = true
  AND  is_in_berlin = false
  AND  remote_type  != 'Full-Remote';

-- Step 3: also deactivate any Unknown-title leftovers
UPDATE public.job_postings
SET    is_active  = false,
       updated_at = now()
WHERE  is_active = true
  AND  title = 'Unknown';

-- Step 4: sanity check after cleanup
SELECT
  COUNT(*)                                                    AS total_active,
  COUNT(*) FILTER (WHERE is_in_berlin = true)                AS berlin_compatible,
  COUNT(*) FILTER (WHERE remote_type  = 'Full-Remote')       AS full_remote,
  COUNT(*) FILTER (WHERE remote_type  = 'Hybrid')            AS hybrid,
  COUNT(*) FILTER (WHERE remote_type  = 'On-site')           AS on_site,
  COUNT(*) FILTER (WHERE is_in_berlin = false
                     AND remote_type != 'Full-Remote')       AS non_berlin_remaining
FROM public.job_postings
WHERE is_active = true;
