import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches a batch of active jobs and aggregates them into insight stats.
 *
 * Returns:
 *  - topSkills      : [{ skill, count }] top 20, sorted descending
 *  - roleCategories : [{ name, count }] sorted descending
 *  - remoteBreakdown: [{ type, count }] Full-Remote / Hybrid / On-site
 *  - totalJobs      : number
 *  - totalCompanies : number
 *  - loading        : boolean
 *  - error          : string | null
 */
export function useStats() {
  const [topSkills,       setTopSkills]       = useState([])
  const [roleCategories,  setRoleCategories]  = useState([])
  const [remoteBreakdown, setRemoteBreakdown] = useState([])
  const [totalJobs,       setTotalJobs]       = useState(0)
  const [totalCompanies,  setTotalCompanies]  = useState(0)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      // Fetch up to 2 000 active jobs — enough for meaningful aggregation
      const [jobsRes, companiesRes] = await Promise.all([
        supabase
          .from('job_postings')
          .select('tech_stack, role_category, remote_type', { count: 'exact' })
          .eq('is_active', true)
          .limit(2000),
        supabase
          .from('companies')
          .select('id', { count: 'exact', head: true }),
      ])

      if (cancelled) return

      if (jobsRes.error) {
        setError(jobsRes.error.message)
        setLoading(false)
        return
      }

      const jobs = jobsRes.data ?? []
      const jobTotal = jobsRes.count ?? jobs.length

      // ── Tech-stack frequency ─────────────────────────────────────────────
      const skillMap = {}
      for (const job of jobs) {
        const stack = Array.isArray(job.tech_stack) ? job.tech_stack : []
        for (const s of stack) {
          if (s && typeof s === 'string') {
            const key = s.trim()
            skillMap[key] = (skillMap[key] ?? 0) + 1
          }
        }
      }
      const skills = Object.entries(skillMap)
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      // ── Role category frequency ──────────────────────────────────────────
      const roleMap = {}
      for (const job of jobs) {
        const r = job.role_category ?? 'Other'
        roleMap[r] = (roleMap[r] ?? 0) + 1
      }
      const roles = Object.entries(roleMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      // ── Remote type breakdown ────────────────────────────────────────────
      const remoteMap = { 'Full-Remote': 0, Hybrid: 0, 'On-site': 0 }
      for (const job of jobs) {
        const t = job.remote_type
        if (t in remoteMap) remoteMap[t]++
        else remoteMap['On-site']++
      }
      const remote = Object.entries(remoteMap)
        .map(([type, count]) => ({ type, count }))

      if (!cancelled) {
        setTopSkills(skills)
        setRoleCategories(roles)
        setRemoteBreakdown(remote)
        setTotalJobs(jobTotal)
        setTotalCompanies(companiesRes.count ?? 0)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { topSkills, roleCategories, remoteBreakdown, totalJobs, totalCompanies, loading, error }
}
