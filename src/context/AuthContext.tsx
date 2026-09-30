import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import type { Mentor, User } from '@/types'

type AuthState = {
  user: User | null
  mentor: Mentor | null
  calendar: { configured: boolean; status: string; email: string | null } | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [calendar, setCalendar] = useState<AuthState['calendar']>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const data = await api<{
      user: User | null
      mentor: Mentor | null
      calendar?: AuthState['calendar']
    }>('/api/me')
    setUser(data.user)
    setMentor(data.mentor)
    setCalendar(data.calendar || null)
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  const value = useMemo(
    () => ({
      user,
      mentor,
      calendar,
      loading,
      refresh,
      logout: async () => {
        await api('/api/auth/logout', { method: 'POST' })
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
