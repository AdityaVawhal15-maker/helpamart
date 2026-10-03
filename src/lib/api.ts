import { supabase } from './supabase'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {}
  try {
    const sessionRes = await supabase.auth.getSession()
    const token = sessionRes.data.session?.access_token
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` }
    }
  } catch {
    // Continue without token if session lookup fails
  }

  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...(init?.headers || {}),
    },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Request failed')
  }
  return data as T
}
