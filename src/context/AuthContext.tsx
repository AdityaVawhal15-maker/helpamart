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

function safeParseArray(val: unknown): any[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

    // 5. Mentor profile lookup - ALWAYS prefer Supabase DB over cache
    let resolvedMentor: Mentor | null = null

    // Try Supabase DB mentors table (source of truth for all mentors)
    try {
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('user_id', sbUser.id)
        .maybeSingle()
      if (!error && data) {
        console.log('[AUTH] loadUserAndProfile - mentor from DB status:', data.status)
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
          languages: safeParseArray(data.languages).length > 0 ? safeParseArray(data.languages) : ['English'],
          yearsExperience: data.years_experience ?? null,
          linkedinUrl: data.linkedin_url || null,
          websiteUrl: data.website_url || null,
          education: safeParseArray(data.education),
          companies: safeParseArray(data.companies),
          achievements: safeParseArray(data.achievements),
          status: data.status || 'draft',
          timezone: data.timezone || resolvedUser.timezone,
          bufferMinutes: data.buffer_minutes ?? 15,
          advanceDays: data.advance_days ?? 30,
          minNoticeHours: data.min_notice_hours ?? 24,
          maxBookingsPerDay: data.max_bookings_per_day ?? 4,
          categories: safeParseArray(data.categories),
          skills: safeParseArray(data.skills),
          services: safeParseArray(data.services),
          availability: safeParseArray(data.availability),
          startingPriceCents: data.starting_price_cents ?? null,
          availabilityPreview: data.availability_preview ?? null,
        }
      }
    } catch {}

    // Fallback: Check Supabase user metadata for mentor profile (if DB query failed)
    if (!resolvedMentor && sbUser.user_metadata?.mentor_profile) {
      console.log('[AUTH] loadUserAndProfile - using mentor from auth metadata')
      resolvedMentor = sbUser.user_metadata.mentor_profile as Mentor
    }

    // Final fallback: Use localStorage cache only if both Supabase sources failed
    if (!resolvedMentor && cachedMentor) {
      console.log('[AUTH] loadUserAndProfile - using cached mentor from localStorage (warning: may be stale)')
      resolvedMentor = cachedMentor
    }

    if (resolvedMentor) {
      try {
        localStorage.setItem(`${MENTOR_KEY_PREFIX}${sbUser.id}`, JSON.stringify(resolvedMentor))
        if (resolvedMentor.status === 'published') {
          syncPublicMentor(resolvedMentor)
        }
      } catch {}
    }

    console.log('[AUTH] loadUserAndProfile complete - final mentor.status:', resolvedMentor?.status)
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
      console.log('[AUTH] refresh() starting - will force reload from Supabase')
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        await loadUserAndProfile(session.user, true)
        console.log('[AUTH] refresh() complete - mentor status is now:', mentor?.status)
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

    console.log('[AUTH] saveMentorProfile called with updates:', mentorUpdates)

    // Build a stable slug from the user's name + short user ID suffix to avoid
    // collisions if two users share the same name or on retry after a partial save.
    const baseSlug = (mentorUpdates.name || user.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const safeSlug = (baseSlug || 'mentor') + '-' + user.id.slice(0, 8)

    const existing = mentor || {
      // NOTE: Do NOT generate a random id here. If there's no mentor record yet,
      // we omit the id from the upsert payload and let Postgres assign it via
      // gen_random_uuid(). On subsequent saves, 'mentor' state will contain the
      // real DB id and we include it to target the exact row.
      id: null as unknown as string,
      slug: safeSlug,
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
      availability: [],
      startingPriceCents: null,
      availabilityPreview: null,
    }

    const merged: Mentor = { ...existing, ...mentorUpdates }

    // Compute derived fields from services + availability
    if (Array.isArray(merged.services) && merged.services.length > 0) {
      const prices = merged.services
        .map(s => typeof s.priceCents === 'number' ? s.priceCents : null)
        .filter((p): p is number => p !== null)
      if (prices.length > 0) {
        merged.startingPriceCents = Math.min(...prices)
      }
    }

    // Compute availability_preview from the actual enabled availability rules.
    // This drives the "● Available" badge on mentor cards.
    const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const enabledRules = Array.isArray(merged.availability)
      ? merged.availability.filter((r: any) => r.enabled)
      : []

    if (enabledRules.length > 0) {
      // Format: "Mon–Fri 9am–5pm" or first enabled day+time
      const days = enabledRules.map((r: any) => DAY_ABBR[r.weekday])
      const firstRule = enabledRules[0]
      const formatHour = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        const ampm = h >= 12 ? 'pm' : 'am'
        const hour = h % 12 || 12
        return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`
      }
      merged.availabilityPreview = `${days.join(', ')} · ${formatHour(firstRule.startTime)}–${formatHour(firstRule.endTime)}`
    } else if (!merged.availabilityPreview && Array.isArray(merged.services) && merged.services[0]?.title) {
      // Fallback to first service name if no availability rules set yet
      merged.availabilityPreview = merged.services[0].title
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

    // ── Save to Supabase DB (source of truth for cross-user discovery) ──────────
    //
    // Strategy: explicit SELECT → UPDATE-or-INSERT.
    // We NEVER use upsert() because even with onConflict:'user_id', Postgres still
    // fires the slug UNIQUE constraint if the DO UPDATE SET clause tries to write a
    // slug that already exists in another row.
    //
    // Rules:
    //  - Fetch the real DB row for this user_id first (bypasses all stale client state).
    //  - If found:  UPDATE the row in-place, KEEPING its existing slug unchanged.
    //               Changing a slug breaks bookmarks and causes constraint violations.
    //  - If not found: INSERT a new row with a unique slug derived from the user's
    //               name + their UUID prefix (practically guaranteed unique per user).
    //               Fall back with a timestamp suffix if an unlikely collision occurs.
    try {
      // Step 1: Authoritative DB lookup — always use user_id, never stale client id.
      const { data: dbRow, error: fetchError } = await supabase
        .from('mentors')
        .select('id, slug')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        console.error('[AUTH] Failed to fetch mentor by user_id:', fetchError)
        throw new Error(`Profile could not be saved to the database: ${fetchError.message}`)
      }

      // Step 2: Build the common column payload (everything except id, user_id, slug).
      const ts = new Date().toISOString()
      const columnPayload: Record<string, unknown> = {
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
        availability: Array.isArray(merged.availability) ? merged.availability : [],
        starting_price_cents: merged.startingPriceCents ?? null,
        availability_preview: merged.availabilityPreview ?? null,
        updated_at: ts,
      }
      if (merged.status === 'published') {
        columnPayload.published_at = ts
      }

      let savedId: string | null = null
      let savedSlug: string | null = null

      if (dbRow) {
        // ── UPDATE existing row ──────────────────────────────────────────────
        // NEVER update slug — it's a permanent permalink identifier.
        // Changing it would break existing bookmarks and cause constraint violations.
        console.log('[AUTH] Canonical mentor DB row found, updating id:', dbRow.id, 'slug:', dbRow.slug)

        const { data: updData, error: updError } = await supabase
          .from('mentors')
          .update(columnPayload)
          .eq('id', dbRow.id)
          .select('id, slug, status')
          .single()

        if (updError) {
          console.error('[AUTH] mentor UPDATE failed:', updError)
          throw new Error(`Profile could not be saved to the database: ${updError.message}`)
        }
        savedId = updData.id
        savedSlug = updData.slug
        console.log('[AUTH] mentor UPDATE succeeded - id:', savedId, 'slug:', savedSlug)
      } else {
        // ── INSERT new row ───────────────────────────────────────────────────
        // For a genuinely new mentor, generate a clean slug from name.
        // If clean slug is already taken by another mentor, append stable user-id suffix.
        const baseName = (merged.name || user.name || 'mentor')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'mentor'

        // Check if clean baseName slug is available
        const { data: slugCheck } = await supabase
          .from('mentors')
          .select('id, user_id')
          .eq('slug', baseName)
          .maybeSingle()

        let candidateSlug = baseName
        if (slugCheck && slugCheck.user_id !== user.id) {
          candidateSlug = `${baseName}-${user.id.slice(0, 8)}`
          const { data: secondCheck } = await supabase
            .from('mentors')
            .select('id')
            .eq('slug', candidateSlug)
            .maybeSingle()
          if (secondCheck) {
            candidateSlug = `${baseName}-${user.id.slice(0, 6)}-${Date.now().toString(36)}`
          }
        }

        console.log('[AUTH] inserting new canonical mentor with slug:', candidateSlug)

        const { data: insData, error: insError } = await supabase
          .from('mentors')
          .insert({ user_id: user.id, slug: candidateSlug, ...columnPayload })
          .select('id, slug, status')
          .single()

        if (insError) {
          // If a race condition occurred (e.g. concurrent save or slug collision)
          console.warn('[AUTH] mentor INSERT hit error, attempting recovery:', insError)
          // 1. Check if row for user_id was created concurrently
          const { data: concurrentRow } = await supabase
            .from('mentors')
            .select('id, slug')
            .eq('user_id', user.id)
            .maybeSingle()

          if (concurrentRow) {
            const { data: updData, error: updErr } = await supabase
              .from('mentors')
              .update(columnPayload)
              .eq('id', concurrentRow.id)
              .select('id, slug, status')
              .single()
            if (updErr) throw new Error(`Profile could not be saved to the database: ${updErr.message}`)
            savedId = updData.id
            savedSlug = updData.slug
          } else {
            // 2. Slug collision recovery: retry with unique timestamp suffix
            const fallbackSlug = `${baseName}-${user.id.slice(0, 6)}-${Date.now().toString(36)}`
            const { data: retryData, error: retryErr } = await supabase
              .from('mentors')
              .insert({ user_id: user.id, slug: fallbackSlug, ...columnPayload })
              .select('id, slug, status')
              .single()
            if (retryErr) throw new Error(`Profile could not be saved to the database: ${retryErr.message}`)
            savedId = retryData.id
            savedSlug = retryData.slug
          }
        } else {
          savedId = insData.id
          savedSlug = insData.slug
          console.log('[AUTH] mentor INSERT succeeded - id:', savedId, 'slug:', savedSlug)
        }
      }

      // Step 3: Sync the authoritative id and slug back into the in-memory object,
      // localStorage, and auth metadata so all future lookups are 100% consistent.
      if (savedId) merged.id = savedId
      if (savedSlug) merged.slug = savedSlug

      try {
        localStorage.setItem(`${MENTOR_KEY_PREFIX}${user.id}`, JSON.stringify(merged))
        await supabase.auth.updateUser({
          data: {
            mentor_profile: merged,
          },
        })
      } catch (cacheErr) {
        console.warn('[AUTH] Error syncing canonical mentor to cache/metadata:', cacheErr)
      }
    } catch (e: any) {
      if (e?.message?.startsWith('Profile could not be saved')) {
        throw e
      }
      // Non-critical path (e.g. table not yet in schema cache during local dev).
      console.warn('[AUTH] saveMentorProfile DB write warning:', e)
    }

    if (merged.status === 'published') {
      syncPublicMentor(merged)
    }

    console.log('[AUTH] saveMentorProfile complete - setting mentor to:', merged)
    console.log('[AUTH] merged.status =', merged.status, 'slug =', merged.slug)
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
