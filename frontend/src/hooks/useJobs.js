import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

/**
 * Fetches the paginated job list directly from Supabase PostgREST.
 *
 * @param {object} params
 * @param {string}  params.query       - Full-text search string
 * @param {object}  params.filters     - { berlin, english_only, remote_type, company_size }
 * @param {number}  params.page        - Current page number
 *
 * @returns {{ jobs, count, totalPages, loading, error }}
 */
export function useJobs({ query, filters, page }) {
  const [jobs,       setJobs]       = useState([])
  const [count,      setCount]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // Debounce the search query to avoid a request on every keystroke
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

    // Always inner-join companies — every posting must have one
    let q = supabase
      .from('job_postings')
      .select(
        `id, title, apply_url, languages, tech_stack, remote_type,
         is_in_berlin, role_category, posted_at,
         company:companies!inner(id, name, company_size, hq_city)`,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .range(from, to)

    // Full-text search via search_vector tsvector column
    if (debouncedQ) {
      q = q.textSearch('search_vector', debouncedQ, {
        config: 'english',
        type: 'websearch',
      })
    }

    // Berlin / remote-compatible
    if (filters.berlin) {
      q = q.eq('is_in_berlin', true)
    }

    // English-only: no German requirement, or German <= A2
    if (filters.english_only) {
      q = q.or(
        'languages->>german.is.null,' +
        'languages->>german.eq.A1,' +
        'languages->>german.eq.A2'
      )
    }

    // Remote type
    if (filters.remote_type) {
      q = q.eq('remote_type', filters.remote_type)
    }

    // Company size (filter on joined companies table)
    if (filters.company_size) {
      q = q.eq('companies.company_size', filters.company_size)
    }

    q.then(({ data, error: err, count: total }) => {
      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      setJobs(data ?? [])
      setCount(total ?? 0)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [debouncedQ, filters, page])

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return { jobs, count, totalPages, loading, error }
}
