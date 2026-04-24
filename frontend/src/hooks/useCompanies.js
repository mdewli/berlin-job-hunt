import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 30

/**
 * Fetches the paginated company directory directly from Supabase.
 * Joins with job_postings to compute live job counts per company.
 *
 * @param {object} params
 * @param {string}  params.query    — Name search string
 * @param {string}  params.size     — Company size filter (Micro|Startup|Mid-size|Enterprise)
 * @param {boolean} params.hasJobs  — When true, only return companies with ≥1 active job
 * @param {number}  params.page     — Current page number (1-indexed)
 */
export function useCompanies({ query = '', size = '', hasJobs = false, page = 1 }) {
  const [companies,  setCompanies]  = useState([])
  const [count,      setCount]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // Pull companies with the count of their active job postings
    // We use a PostgREST aggregate: count of related rows through the FK
    let q = supabase
      .from('companies')
      .select(
        `id, name, homepage_url, company_size, hq_city,
         job_count:job_postings(count)`,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, to)

    if (debouncedQ) {
      q = q.ilike('name', `%${debouncedQ}%`)
    }

    if (size) {
      q = q.eq('company_size', size)
    }

    q.then(({ data, error: err, count: total }) => {
      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      // PostgREST returns job_count as [{ count: N }] — flatten it
      const enriched = (data ?? []).map(c => ({
        ...c,
        job_count: Array.isArray(c.job_count) ? (c.job_count[0]?.count ?? 0) : (c.job_count ?? 0),
      }))

      // Client-side hasJobs filter (PostgREST count-filter on nested tables is verbose)
      const filtered = hasJobs ? enriched.filter(c => c.job_count > 0) : enriched

      setCompanies(filtered)
      setCount(total ?? 0)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [debouncedQ, size, hasJobs, page])

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return { companies, count, totalPages, loading, error }
}
