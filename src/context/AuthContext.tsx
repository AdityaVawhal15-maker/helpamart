import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { supabase, signOutSupabase } from '@/lib/supabase'
import type { Mentor, User } from '@/types'

type AuthState = {
  user: User | null
  mentor: Mentor | null
  calendar: { configured: boolean; status: string; email: string | null } | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  syncSupabaseSession: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [calendar, setCalendar] = useState<AuthState['calendar']>(null)
  const [loading, setLoading] = useState(true)

  async function syncWithBackend(accessToken?: string): Promise<boolean> {
    try {
      if (accessToken) {
        const synced = await api<{
          user: User | null
          mentor: Mentor | null
          calendar?: AuthState['calendar']
        }>('/api/auth/supabase-sync', {
          method: 'POST',
          body: JSON.stringify({ access_token: accessToken }),
        })
        if (synced.user) {
          setUser(synced.user)
          setMentor(synced.mentor || null)
          setCalendar(synced.calendar || null)
          return true
        }
      }

      // Fallback to /api/me check
      const data = await api<{
        user: User | null
        mentor: Mentor | null
        calendar?: AuthState['calendar']
      }>('/api/me')

      if (data.user) {
        setUser(data.user)
        setMentor(data.mentor || null)
        setCalendar(data.calendar || null)
        return true
      }
      return false
    } catch (err) {
      console.warn('[AUTH] Session sync warning:', err)
      return false
    }
  }

  async function refresh() {
    try {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (token) {
        await syncWithBackend(token)
        return
      }

      const data = await api<{
        user: User | null
        mentor: Mentor | null
        calendar?: AuthState['calendar']
      }>('/api/me')
      setUser(data.user)
      setMentor(data.mentor)
      setCalendar(data.calendar || null)
    } catch {
      setUser(null)
      setMentor(null)
      setCalendar(null)
    }
  }

  async function syncSupabaseSession() {
    const sessionRes = await supabase.auth.getSession()
    const token = sessionRes.data.session?.access_token
    await syncWithBackend(token)
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token

        if (token) {
          await syncWithBackend(token)
        } else {
          // Check if server session exists
          await syncWithBackend()
        }
      } catch (e) {
        console.error('[AUTH] Init error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    // Listen to Supabase auth events (OAuth redirect, OTP verify, token refresh, sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.access_token) {
          await syncWithBackend(session.access_token)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setMentor(null)
        setCalendar(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      mentor,
      calendar,
      loading,
      refresh,
      syncSupabaseSession,
      logout: async () => {
        try {
          await signOutSupabase()
        } catch {
          // ignore
        }
        try {
          await api('/api/auth/logout', { method: 'POST' })
        } catch {
          // ignore
        }
        setUser(null)
        setMentor(null)
        setCalendar(null)
      },
    }),
    [user, mentor, calendar, loading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
