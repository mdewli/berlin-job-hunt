import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function useAuth() {
  const [user,       setUser]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [savedIds,   setSavedIds]   = useState(new Set())
  const [savedJobs,  setSavedJobs]  = useState([])  // full job objects

  // Session hydration + auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch saved job IDs whenever the logged-in user changes
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set())
      setSavedJobs([])
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return

      fetch(`${API_BASE}/api/v1/saved-jobs/`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => (r.ok ? r.json() : []))
        .then(data => {
          // Response: [{id, job: {id, title, company, ...}, created_at}, ...]
          const items = Array.isArray(data) ? data : (data.results ?? [])
          setSavedIds(new Set(items.map(item => item.job?.id ?? item.job_id)))
          setSavedJobs(items.map(item => item.job).filter(Boolean))
        })
        .catch(() => {})
    })
  }, [user])

  // Auth actions
  const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  /**
   * Returns the current JWT access token (auto-refreshed by Supabase).
   */
  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  /**
   * Save or unsave a job via the Django API.
   * Returns the new saved state (true/false), or null if not authenticated.
   * Throws on API errors.
   */
  const toggleSaved = async (jobId) => {
    const token = await getAccessToken()
    if (!token) return null // signal to caller: open the auth modal

    const isSaved = savedIds.has(jobId)
    const method  = isSaved ? 'DELETE' : 'POST'

    const res = await fetch(`${API_BASE}/api/v1/saved-jobs/`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    })

    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail ?? `Request failed (${res.status})`)
    }

    const newState = !isSaved
    setSavedIds(prev => {
      const next = new Set(prev)
      newState ? next.add(jobId) : next.delete(jobId)
      return next
    })
    // savedJobs is re-fetched on next load; for instant UI remove on unsave
    if (!newState) {
      setSavedJobs(prev => prev.filter(j => j.id !== jobId))
    }
    return newState
  }

  return {
    user,
    loading,
    savedIds,
    savedJobs,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    getAccessToken,
    toggleSaved,
  }
}
