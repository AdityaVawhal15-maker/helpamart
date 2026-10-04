import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, signOutSupabase } from '@/lib/supabase'
import type { Mentor, User } from '@/types'

export type AuthContextValue = {
  user: User | null
  mentor: Mentor | null
  calendar: { configured: boolean; status: string; email: string | null } | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  syncSupabaseSession: () => Promise<void>
  updateUserProfile: (data: Partial<User>) => Promise<User>
  saveMentorProfile: (data: Partial<Mentor>) => Promise<Mentor>
}

const AuthCtx = createContext<AuthContextValue | null>(null)

/**
 * Storage keys
 */
const PROFILE_KEY_PREFIX = 'helpa_profile_'
const MENTOR_KEY_PREFIX = 'helpa_mentor_'
const PENDING_SIGNUP_NAME_KEY = 'helpa_pending_signup_name'

/**
 * Construct an application User from Supabase auth user,
 * DB profile, and metadata.
 */
function buildUserFromAuth(sbUser: SupabaseUser, storedProfile?: Partial<User> | null): User {
  const meta = sbUser.user_metadata || {}

  let pendingName: string | null = null
  if (typeof window !== 'undefined') {
    try {
      pendingName = localStorage.getItem(PENDING_SIGNUP_NAME_KEY)
      if (pendingName) {
        localStorage.removeItem(PENDING_SIGNUP_NAME_KEY)
      }
    } catch {}
  }

  const name =
    storedProfile?.name?.trim() ||
    meta.full_name?.trim() ||
    meta.name?.trim() ||
    pendingName?.trim() ||
    (sbUser.email ? sbUser.email.split('@')[0] : 'User')

  const photoUrl =
    storedProfile?.photoUrl ||
    meta.avatar_url ||
    meta.picture ||
    null

  return {
    id: sbUser.id,
    email: sbUser.email || null,
    phone: sbUser.phone || null,
    name,
    photoUrl,
    bio: storedProfile?.bio || meta.bio || null,
    location: storedProfile?.location || meta.location || null,
    timezone:
      storedProfile?.timezone ||
      meta.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC',
    languages:
      storedProfile?.languages ||
      (Array.isArray(meta.languages) ? meta.languages : ['English']),
    interests:
      storedProfile?.interests ||
      (Array.isArray(meta.interests) ? meta.interests : []),
    title: storedProfile?.title || meta.title || '',
    company: storedProfile?.company || meta.company || '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [calendar, setCalendar] = useState<AuthContextValue['calendar']>(null)
  const [loading, setLoading] = useState(true)

  // Track the currently resolved user ID to prevent race conditions & duplicate loads
  const currentUserIdRef = useRef<string | null>(null)
  const inFlightSyncRef = useRef<Promise<void> | null>(null)

  /**
   * Load user profile and associated mentor from Supabase DB, metadata, and local cache.
   */
  async function loadUserAndProfile(sbUser: SupabaseUser, force = false): Promise<void> {
    if (!force && currentUserIdRef.current === sbUser.id && user) {
      return
    }

    currentUserIdRef.current = sbUser.id

    // 1. Check local device cache
    let cachedProfile: Partial<User> | null = null
    let cachedMentor: Mentor | null = null
    try {
      const pRaw = localStorage.getItem(`${PROFILE_KEY_PREFIX}${sbUser.id}`)
      if (pRaw) cachedProfile = JSON.parse(pRaw)
      const mRaw = localStorage.getItem(`${MENTOR_KEY_PREFIX}${sbUser.id}`)
      if (mRaw) cachedMentor = JSON.parse(mRaw)
    } catch {}

    // 2. Try fetching public.profiles table from Supabase DB
    let dbProfile: any = null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle()
      if (!error && data) {
        dbProfile = data
      }
    } catch {}

    // 3. Assemble unified user object
    const resolvedUser: User = buildUserFromAuth(sbUser, {
      ...cachedProfile,
      name: dbProfile?.full_name || cachedProfile?.name,
      photoUrl: dbProfile?.avatar_url || cachedProfile?.photoUrl,
    })

    // Upsert into public.profiles if table exists
    try {
      await supabase.from('profiles').upsert(
        {
          id: resolvedUser.id,
          full_name: resolvedUser.name,
          email: resolvedUser.email,
          avatar_url: resolvedUser.photoUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
    } catch {
      // Table may not exist yet in schema cache, ignore
    }

    // 4. Save to local device cache
    try {
      localStorage.setItem(`${PROFILE_KEY_PREFIX}${sbUser.id}`, JSON.stringify(resolvedUser))
    } catch {}

    // 5. Mentor profile lookup
    let resolvedMentor: Mentor | null = cachedMentor

    // Try Supabase DB mentors table
    try {
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('user_id', sbUser.id)
        .maybeSingle()
      if (!error && data) {
        resolvedMentor = {
          id: data.id,
          slug: data.slug,
          name: data.name || resolvedUser.name,
          role: data.role || '',
          company: data.company || '',
          location: data.location || '',
          intro: data.intro || '',
          about: data.about || '',
          photoUrl: data.photo_url || resolvedUser.photoUrl,
          languages: data.languages || ['English'],
          yearsExperience: data.years_experience ?? null,
          linkedinUrl: data.linkedin_url || null,
          websiteUrl: data.website_url || null,
          education: data.education || [],
          companies: data.companies || [],
          achievements: data.achievements || [],
          status: data.status || 'draft',
          timezone: data.timezone || resolvedUser.timezone,
          bufferMinutes: data.buffer_minutes ?? 15,
          advanceDays: data.advance_days ?? 30,
          minNoticeHours: data.min_notice_hours ?? 24,
          maxBookingsPerDay: data.max_bookings_per_day ?? 4,
          categories: data.categories || [],
          skills: data.skills || [],
          services: [],
          startingPriceCents: null,
          availabilityPreview: null,
        }
      }
    } catch {}

    // Also check Supabase user metadata for mentor profile
    if (!resolvedMentor && sbUser.user_metadata?.mentor_profile) {
      resolvedMentor = sbUser.user_metadata.mentor_profile as Mentor
    }

    if (resolvedMentor) {
      try {
        localStorage.setItem(`${MENTOR_KEY_PREFIX}${sbUser.id}`, JSON.stringify(resolvedMentor))
        if (resolvedMentor.status === 'published') {
          syncPublicMentor(resolvedMentor)
        }
      } catch {}
    }

    setUser(resolvedUser)
    setMentor(resolvedMentor)
  }

  /**
   * Helper to ensure published mentor is visible to other users in discovery.
   * NOTE: This updates the local device cache only. Cross-user discovery now
   * reads from Supabase directly — see saveMentorProfile for the authoritative write.
   */
  function syncPublicMentor(_publishedMentor: Mentor) {
    // No-op: localStorage-based public registry removed.
    // Discovery (FindMentor.tsx) now queries supabase.from('mentors') directly.
  }

  /**
   * Synchronize active Supabase session safely without race conditions.
   */
  async function syncSession(sbUser: SupabaseUser | null): Promise<void> {
    if (inFlightSyncRef.current) {
      await inFlightSyncRef.current
    }

    if (!sbUser) {
      currentUserIdRef.current = null
      setUser(null)
      setMentor(null)
      setCalendar(null)
      return
    }

    const task = (async () => {
      try {
        await loadUserAndProfile(sbUser)
      } catch (err) {
        console.error('[AUTH] Failed to sync session profile:', err)
      }
    })()

    inFlightSyncRef.current = task
    await task
    inFlightSyncRef.current = null
  }

  /**
   * Lifecycle listener setup for Supabase auth state changes.
   */
  useEffect(() => {
    let isMounted = true

    // 1. Establish single reliable listener immediately
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          await syncSession(session.user)
        } else if (event === 'INITIAL_SESSION') {
          setUser(null)
          setMentor(null)
          currentUserIdRef.current = null
        }
      } else if (event === 'USER_UPDATED') {
        if (session?.user) {
          await loadUserAndProfile(session.user, true)
        }
      } else if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null
        setUser(null)
        setMentor(null)
        setCalendar(null)
      }

      if (isMounted) setLoading(false)
    })

    // 2. Fallback check for session retrieval
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return
        if (session?.user) {
          await syncSession(session.user)
        }
      })
      .catch((e) => {
        console.warn('[AUTH] getSession fallback error:', e)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Explicit refresh helper.
   */
  async function refresh() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        await loadUserAndProfile(session.user, true)
      } else {
        setUser(null)
        setMentor(null)
        setCalendar(null)
      }
    } catch (e) {
      console.warn('[AUTH] refresh error:', e)
    }
  }

  /**
   * Explicit sync session helper used immediately after OTP verify.
   */
  async function syncSupabaseSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      await syncSession(session.user)
    }
  }

  /**
   * Update current user profile.
   */
  async function updateUserProfile(updates: Partial<User>): Promise<User> {
    if (!user) throw new Error('Not authenticated')

    const updated: User = { ...user, ...updates }

    // 1. Update in local storage
    try {
      localStorage.setItem(`${PROFILE_KEY_PREFIX}${user.id}`, JSON.stringify(updated))
    } catch {}

    // 2. Update Supabase user metadata
    try {
      await supabase.auth.updateUser({
        data: {
          name: updated.name,
          full_name: updated.name,
          avatar_url: updated.photoUrl,
          picture: updated.photoUrl,
          bio: updated.bio,
          location: updated.location,
          timezone: updated.timezone,
          languages: updated.languages,
          interests: updated.interests,
        },
      })
    } catch (e) {
      console.warn('[AUTH] Failed to update user_metadata:', e)
    }

    // 3. Upsert into public.profiles DB table if available
    try {
      await supabase.from('profiles').upsert({
        id: updated.id,
        full_name: updated.name,
        email: updated.email,
        avatar_url: updated.photoUrl,
        updated_at: new Date().toISOString(),
      })
    } catch {}

    setUser(updated)
    return updated
  }

  /**
   * Save or update mentor profile.
   */
  async function saveMentorProfile(mentorUpdates: Partial<Mentor>): Promise<Mentor> {
    if (!user) throw new Error('Not authenticated')

    const existing = mentor || {
      id: crypto.randomUUID(),
      slug: (mentorUpdates.name || user.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `mentor-${user.id.slice(0, 8)}`,
      name: user.name,
      role: '',
      company: '',
      location: user.location || '',
      intro: '',
      about: '',
      photoUrl: user.photoUrl,
      languages: ['English'],
      yearsExperience: null,
      linkedinUrl: null,
      websiteUrl: null,
      education: [],
      companies: [],
      achievements: [],
      status: 'draft' as const,
      timezone: user.timezone,
      bufferMinutes: 15,
      advanceDays: 30,
      minNoticeHours: 24,
      maxBookingsPerDay: 4,
      categories: [],
      skills: [],
      services: [],
      startingPriceCents: null,
      availabilityPreview: null,
    }

    const merged: Mentor = { ...existing, ...mentorUpdates }

    // Compute derived fields from the services array so the card displays correct pricing
    if (Array.isArray(merged.services) && merged.services.length > 0) {
      const prices = merged.services
        .map(s => typeof s.priceCents === 'number' ? s.priceCents : null)
        .filter((p): p is number => p !== null)
      if (prices.length > 0) {
        merged.startingPriceCents = Math.min(...prices)
      }
      // Set availability_preview from the first active service duration as a simple label
      if (!merged.availabilityPreview && merged.services[0]?.title) {
        merged.availabilityPreview = merged.services[0].title
      }
    }

    // Save to local device storage
    try {
      localStorage.setItem(`${MENTOR_KEY_PREFIX}${user.id}`, JSON.stringify(merged))
    } catch {}

    // Save to Supabase metadata
    try {
      await supabase.auth.updateUser({
        data: {
          mentor_profile: merged,
        },
      })
    } catch (e) {
      console.warn('[AUTH] Failed to persist mentor in user_metadata:', e)
    }

    // Save to Supabase DB mentors table — this is the shared production source of truth
    // that FindMentor.tsx queries for cross-user discovery.
    try {
      const upsertPayload: Record<string, unknown> = {
        id: merged.id,
        user_id: user.id,
        slug: merged.slug,
        name: merged.name,
        role: merged.role,
        company: merged.company,
        location: merged.location,
        intro: merged.intro,
        about: merged.about,
        photo_url: merged.photoUrl,
        languages: merged.languages,
        years_experience: merged.yearsExperience,
        linkedin_url: merged.linkedinUrl,
        website_url: merged.websiteUrl,
        education: merged.education,
        companies: merged.companies,
        achievements: merged.achievements,
        status: merged.status,
        timezone: merged.timezone,
        categories: merged.categories,
        skills: merged.skills,
        services: merged.services,
        starting_price_cents: merged.startingPriceCents ?? null,
        availability_preview: merged.availabilityPreview ?? null,
        updated_at: new Date().toISOString(),
      }

      // Set published_at timestamp when first publishing so discovery ordering works
      if (merged.status === 'published') {
        upsertPayload.published_at = new Date().toISOString()
      }

      const { error: upsertError } = await supabase.from('mentors').upsert(upsertPayload, {
        onConflict: 'id',
      })

      if (upsertError) {
        // Surface real DB failures — silent failure here means publish appears to succeed
        // but the mentor never appears in discovery for other users.
        console.error('[AUTH] Supabase mentors upsert failed:', upsertError)
        throw new Error(`Profile could not be saved to the database: ${upsertError.message}`)
      }
    } catch (e: any) {
      if (e?.message?.startsWith('Profile could not be saved')) {
        throw e
      }
      // Log but don't block for non-critical errors (e.g. table missing in local dev)
      console.warn('[AUTH] saveMentorProfile Supabase upsert warning:', e)
    }

    if (merged.status === 'published') {
      syncPublicMentor(merged)
    }

    setMentor(merged)
    return merged
  }

  /**
   * Log out cleanly from Supabase and application state.
   */
  async function logout() {
    setLoading(true)
    try {
      await signOutSupabase()
    } catch (err) {
      console.warn('[AUTH] Supabase signOut warning:', err)
    } finally {
      currentUserIdRef.current = null
      setUser(null)
      setMentor(null)
      setCalendar(null)
      setLoading(false)
    }
  }

  const value = useMemo(
    () => ({
      user,
      mentor,
      calendar,
      loading,
      refresh,
      logout,
      syncSupabaseSession,
      updateUserProfile,
      saveMentorProfile,
    }),
    [user, mentor, calendar, loading],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
