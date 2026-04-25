import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function useAuth() {
  const [user,      setUser]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [savedIds,  setSavedIds]  = useState(new Set())
  const [savedJobs, setSavedJobs] = useState([])

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
          const items = Array.isArray(data) ? data : (data.results ?? [])
          setSavedIds(new Set(items.map(item => item.job?.id ?? item.job_id)))
          setSavedJobs(items.map(item => item.job).filter(Boolean))
        })
        .catch(() => {})
    })
  }, [user])

  // ── Auth actions ─────────────────────────────────────────────────────────

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

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const toggleSaved = async (jobId) => {
    const token = await getAccessToken()
    if (!token) return null

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
    signInWithGoogle,
    signOut,
    getAccessToken,
    toggleSaved,
  }
}
