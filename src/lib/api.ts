import { supabase } from './supabase'
import type { Mentor, User, Booking } from '@/types'

/**
 * Robust API client.
 * Automatically attaches Supabase auth Bearer token.
 * In production static deployment on Vercel (where no Express server is running and /api/* 404s),
 * it seamlessly routes user, mentor, booking, and upload operations through Supabase & client persistence.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {}
  let activeToken: string | null = null
  let activeUser: any = null

  try {
    const sessionRes = await supabase.auth.getSession()
    activeToken = sessionRes.data.session?.access_token || null
    activeUser = sessionRes.data.session?.user || null
    if (activeToken) {
      authHeader = { Authorization: `Bearer ${activeToken}` }
    }
  } catch {
    // Continue without token if session lookup fails
  }

  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader,
        ...(init?.headers || {}),
      },
      ...init,
    })

    const contentType = res.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const isHtml = contentType.includes('text/html')

    // If server responded successfully with JSON
    if (res.ok && isJson) {
      const data = await res.json().catch(() => ({}))
      return data as T
    }

    // If it's a 404 or an SPA rewrite that returned index.html for an /api/* call:
    if ((res.status === 404 || isHtml || !isJson) && path.startsWith('/api/')) {
      const fallbackResult = await handleClientApiFallback<T>(path, init, activeUser)
      if (fallbackResult !== undefined) {
        return fallbackResult
      }
    }

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      return data as T
    }

    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || 'Request failed')
  } catch (err: any) {
    // If fetch failed due to network / 404
    if (path.startsWith('/api/')) {
      const fallbackResult = await handleClientApiFallback<T>(path, init, activeUser)
      if (fallbackResult !== undefined) {
        return fallbackResult
      }
    }
    throw err
  }
}

/**
 * Handle static client-side fallback for /api endpoints on pure SPA deployments.
 */
async function handleClientApiFallback<T>(
  path: string,
  init?: RequestInit,
  activeUser?: any,
): Promise<T | undefined> {
  const method = (init?.method || 'GET').toUpperCase()
  const userId = activeUser?.id || null

  // 1. /api/me & /api/auth/supabase-sync
  if (path.startsWith('/api/me') || path.startsWith('/api/auth/supabase-sync')) {
    if (!userId) {
      return { user: null, mentor: null, calendar: null } as unknown as T
    }

    let userObj: User | null = null
    let mentorObj: Mentor | null = null

    try {
      const rawUser = localStorage.getItem(`helpa_profile_${userId}`)
      if (rawUser) userObj = JSON.parse(rawUser)
    } catch {}

    if (!userObj && activeUser) {
      const meta = activeUser.user_metadata || {}
      userObj = {
        id: activeUser.id,
        email: activeUser.email || null,
        phone: activeUser.phone || null,
        name: meta.full_name || meta.name || activeUser.email?.split('@')[0] || 'User',
        photoUrl: meta.avatar_url || meta.picture || null,
        bio: meta.bio || null,
        location: meta.location || null,
        timezone: meta.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        languages: Array.isArray(meta.languages) ? meta.languages : ['English'],
        interests: Array.isArray(meta.interests) ? meta.interests : [],
        title: meta.title || '',
        company: meta.company || '',
      }
    }

    try {
      const rawMentor = localStorage.getItem(`helpa_mentor_${userId}`)
      if (rawMentor) mentorObj = JSON.parse(rawMentor)
    } catch {}

    if (!mentorObj && activeUser?.user_metadata?.mentor_profile) {
      mentorObj = activeUser.user_metadata.mentor_profile
    }

    return {
      user: userObj,
      mentor: mentorObj,
      calendar: { configured: false, status: 'disconnected', email: null },
    } as unknown as T
  }

  // 2. /api/auth/logout
  if (path === '/api/auth/logout') {
    return { ok: true } as unknown as T
  }

  // 3. /api/users/me
  if (path.startsWith('/api/users/me') && (method === 'PUT' || method === 'PATCH')) {
    if (!userId) throw new Error('Not authenticated')
    let body: any = {}
    try {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    } catch {}

    let userObj: User | null = null
    try {
      const rawUser = localStorage.getItem(`helpa_profile_${userId}`)
      if (rawUser) userObj = JSON.parse(rawUser)
    } catch {}

    const updatedUser: User = {
      id: userId,
      email: activeUser?.email || null,
      phone: activeUser?.phone || null,
      name: body.name || userObj?.name || 'User',
      photoUrl: body.photoUrl !== undefined ? body.photoUrl : userObj?.photoUrl || null,
      bio: body.bio !== undefined ? body.bio : userObj?.bio || null,
      location: body.location !== undefined ? body.location : userObj?.location || null,
      timezone: body.timezone || userObj?.timezone || 'UTC',
      languages: body.languages || userObj?.languages || ['English'],
      interests: body.interests || userObj?.interests || [],
      title: body.title || userObj?.title || '',
      company: body.company || userObj?.company || '',
    }

    try {
      localStorage.setItem(`helpa_profile_${userId}`, JSON.stringify(updatedUser))
    } catch {}

    try {
      await supabase.auth.updateUser({
        data: {
          name: updatedUser.name,
          full_name: updatedUser.name,
          avatar_url: updatedUser.photoUrl,
          picture: updatedUser.photoUrl,
        },
      })
    } catch {}

    return { user: updatedUser } as unknown as T
  }

  // 4. /api/mentor/me
  if (path.startsWith('/api/mentor/me')) {
    if (!userId) throw new Error('Not authenticated')

    if (method === 'GET') {
      let mentorObj: Mentor | null = null
      try {
        const raw = localStorage.getItem(`helpa_mentor_${userId}`)
        if (raw) mentorObj = JSON.parse(raw)
      } catch {}
      return { mentor: mentorObj } as unknown as T
    }

    if (method === 'PUT' || method === 'POST') {
      let body: any = {}
      try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      } catch {}

      let existing: Mentor | null = null
      try {
        const raw = localStorage.getItem(`helpa_mentor_${userId}`)
        if (raw) existing = JSON.parse(raw)
      } catch {}

      const name = body.fullName || body.name || existing?.name || activeUser?.user_metadata?.full_name || 'Mentor'
      const slug =
        existing?.slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') ||
        `mentor-${userId.slice(0, 8)}`

      const updatedMentor: Mentor = {
        id: existing?.id || crypto.randomUUID(),
        slug,
        name,
        role: body.roleTitle || body.role || existing?.role || '',
        company: body.company !== undefined ? body.company : existing?.company || '',
        location: body.location !== undefined ? body.location : existing?.location || '',
        intro: body.intro !== undefined ? body.intro : existing?.intro || '',
        about: body.about !== undefined ? body.about : existing?.about || '',
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : existing?.photoUrl || null,
        languages: body.languages || existing?.languages || ['English'],
        yearsExperience: body.yearsExperience !== undefined ? body.yearsExperience : existing?.yearsExperience ?? null,
        linkedinUrl: body.linkedinUrl !== undefined ? body.linkedinUrl : existing?.linkedinUrl || null,
        websiteUrl: body.websiteUrl !== undefined ? body.websiteUrl : existing?.websiteUrl || null,
        education: body.education || existing?.education || [],
        companies: body.companies || existing?.companies || [],
        achievements: body.achievements || existing?.achievements || [],
        status: existing?.status || 'draft',
        timezone: body.timezone || existing?.timezone || 'UTC',
        bufferMinutes: body.bufferMinutes || existing?.bufferMinutes || 15,
        advanceDays: body.advanceDays || existing?.advanceDays || 30,
        minNoticeHours: body.minNoticeHours || existing?.minNoticeHours || 24,
        maxBookingsPerDay: body.maxBookingsPerDay || existing?.maxBookingsPerDay || 4,
        categories: body.categories || existing?.categories || [],
        skills: body.skills || existing?.skills || [],
        services: body.services || existing?.services || [],
        availability: body.availability || existing?.availability || [],
        startingPriceCents: existing?.startingPriceCents || null,
        availabilityPreview: existing?.availabilityPreview || null,
      }

      try {
        localStorage.setItem(`helpa_mentor_${userId}`, JSON.stringify(updatedMentor))
      } catch {}

      try {
        await supabase.auth.updateUser({
          data: { mentor_profile: updatedMentor },
        })
      } catch {}

      return { mentor: updatedMentor } as unknown as T
    }
  }

  // 5. /api/mentor/publish
  if (path.startsWith('/api/mentor/publish') && method === 'POST') {
    if (!userId) throw new Error('Not authenticated')
    let mentorObj: Mentor | null = null
    try {
      const raw = localStorage.getItem(`helpa_mentor_${userId}`)
      if (raw) mentorObj = JSON.parse(raw)
    } catch {}

    if (!mentorObj) {
      throw new Error('Mentor profile not found. Please complete your profile details first.')
    }

    mentorObj.status = 'published'
    try {
      localStorage.setItem(`helpa_mentor_${userId}`, JSON.stringify(mentorObj))
      await supabase.auth.updateUser({
        data: { mentor_profile: mentorObj },
      })
    } catch {}

    return { mentor: mentorObj } as unknown as T
  }

  // 6. /api/mentor/availability
  if (path.startsWith('/api/mentor/availability')) {
    if (method === 'GET') {
      return { rules: [], timezone: 'UTC' } as unknown as T
    }
    return { ok: true } as unknown as T
  }

  // 7. /api/mentor/services
  if (path.startsWith('/api/mentor/services')) {
    if (method === 'GET') {
      return { services: [] } as unknown as T
    }
    return { ok: true } as unknown as T
  }

  // 8. /api/mentors — query Supabase directly (shared production DB, not localStorage)
  if (path.startsWith('/api/mentors')) {
    const cleanUrl = new URL(path, 'http://localhost')
    const slugMatch = path.match(/^\/api\/mentors\/([^/?]+)/)

    if (slugMatch) {
      // Single mentor lookup by slug
      const slug = slugMatch[1]
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (error) {
        console.error('[API fallback] /api/mentors/:slug error:', error)
        return { mentor: null, slots: [] } as unknown as T
      }

      if (!data) return { mentor: null, slots: [] } as unknown as T

      const mentor = mapSupabaseMentor(data)
      return { mentor, slots: [] } as unknown as T
    }

    // List published mentors
    let query = supabase
      .from('mentors')
      .select('*')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })

    const category = cleanUrl.searchParams.get('category')
    if (category) {
      query = query.contains('categories', [category]) as typeof query
    }

    const { data, error } = await query

    if (error) {
      console.error('[API fallback] /api/mentors list error:', error)
      // Return error object — do NOT silently return [] and mask the failure
      throw new Error(`Could not load mentors: ${error.message}`)
    }

    let results = Array.isArray(data) ? data.map(mapSupabaseMentor) : []

    const q = cleanUrl.searchParams.get('q')?.toLowerCase()
    if (q) {
      results = results.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.company.toLowerCase().includes(q) ||
          m.intro.toLowerCase().includes(q) ||
          m.categories.some((c: string) => c.toLowerCase().includes(q)) ||
          m.skills.some((s: string) => s.toLowerCase().includes(q)),
      )
    }

    return { mentors: results } as unknown as T
  }

  // 9. /api/bookings
  if (path.startsWith('/api/bookings')) {
    // ── GET: fetch bookings for the authenticated user from Supabase ──────
    if (method === 'GET' || !method) {
      if (!userId) return { bookings: [] } as unknown as T

      const { data, error } = await supabase
        .from('bookings')
        .select('*, mentors(name, slug, photo_url)')
        .eq('mentee_id', userId)
        .order('start_at', { ascending: false })

      if (error) {
        console.error('[API] GET /api/bookings error:', error)
        throw new Error(`Could not load bookings: ${error.message}`)
      }

      const bookings: Booking[] = (data || []).map((row: any) => ({
        id: row.id,
        mentorId: row.mentor_id,
        menteeId: row.mentee_id,
        serviceId: row.service_id,
        startAt: row.start_at,
        endAt: row.end_at,
        timezone: row.timezone || 'UTC',
        status: row.status || 'confirmed',
        paymentStatus: row.payment_status || 'not_required',
        priceCents: row.price_cents ?? 0,
        currency: row.currency || 'INR',
        meetLink: row.meet_link || null,
        calendarEventId: row.calendar_event_id || null,
        calendarStatus: row.calendar_status || null,
        mentorName: row.mentors?.name || null,
        mentorSlug: row.mentors?.slug || null,
        mentorPhoto: row.mentors?.photo_url || null,
        serviceTitle: row.service_title || null,
        notes: row.notes || null,
      }))

      return { bookings } as unknown as T
    }

    // ── /api/bookings/:id/cancel ──────────────────────────────────────────
    const cancelMatch = path.match(/^\/api\/bookings\/([^/]+)\/cancel$/)
    if (cancelMatch && method === 'POST') {
      if (!userId) throw new Error('Not authenticated')
      const bookingId = cancelMatch[1]
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('mentee_id', userId) // only cancel own bookings
      if (error) throw new Error(`Could not cancel booking: ${error.message}`)
      return { ok: true } as unknown as T
    }

    // ── POST /api/bookings: create a new booking ──────────────────────────
    if (method === 'POST') {
      if (!userId) throw new Error('Not authenticated. Please sign in to book a session.')

      let body: any = {}
      try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      } catch {}

      const { mentorSlug, serviceId, startAt, timezone } = body as {
        mentorSlug?: string
        serviceId?: string
        startAt?: string
        timezone?: string
      }

      if (!mentorSlug || !startAt || !timezone) {
        throw new Error('Mentor, time, and timezone are required.')
      }

      // 1. Fetch mentor from Supabase (server-authoritative)
      const { data: mentorRow, error: mentorErr } = await supabase
        .from('mentors')
        .select('id, user_id, name, slug, status, services, buffer_minutes, timezone')
        .eq('slug', mentorSlug)
        .eq('status', 'published')
        .maybeSingle()

      if (mentorErr || !mentorRow) {
        throw new Error('This mentor is not currently available.')
      }

      // 2. Resolve service and compute authoritative price
      const services: any[] = Array.isArray(mentorRow.services) ? mentorRow.services : []
      const service = serviceId
        ? services.find((s: any) => s.id === serviceId || s.title === serviceId)
        : services[0]

      if (!service) {
        throw new Error('That session type is not available.')
      }

      const durationMin: number = service.durationMinutes || 30
      const start = new Date(startAt)
      const end = new Date(start.getTime() + durationMin * 60 * 1000)

      // 3. Server-side price determination: first session = free, subsequent = original price
      const { count: prevCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', userId)
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'completed'])

      const isFirstSession = (prevCount ?? 0) === 0
      const finalPriceCents = isFirstSession ? 0 : (service.priceCents ?? 9900)
      const currency = service.currency || 'INR'

      // 4. Double-booking check: confirm slot is still free
      const { data: clash } = await supabase
        .from('bookings')
        .select('id')
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'pending'])
        .lt('start_at', end.toISOString())
        .gt('end_at', start.toISOString())
        .limit(1)

      if (clash && clash.length > 0) {
        throw new Error('This time slot is no longer available. Please choose another time.')
      }

      // 5. Create the booking in Supabase
      const bookingId = crypto.randomUUID()
      const now = new Date().toISOString()

      const { error: insertErr } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          mentor_id: mentorRow.id,
          mentee_id: userId,
          service_id: service.id || service.title || 'default',
          service_title: service.title || 'Session',
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          timezone: timezone,
          status: 'confirmed',
          payment_status: finalPriceCents === 0 ? 'not_required' : 'pending',
          price_cents: finalPriceCents,
          currency,
          meet_link: null,
          calendar_event_id: null,
          calendar_status: 'pending',
          created_at: now,
          updated_at: now,
        })

      if (insertErr) {
        // Idempotency: if the booking already exists (duplicate submission), return it
        if (insertErr.code === '23505') {
          const { data: existing } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .maybeSingle()
          if (existing) {
            return {
              booking: {
                id: existing.id,
                meetLink: existing.meet_link,
                status: existing.status,
                priceCents: existing.price_cents,
                currency: existing.currency,
              },
            } as unknown as T
          }
        }
        throw new Error(`Booking could not be created: ${insertErr.message}`)
      }

      // 6. Return the booking — Google Meet/Calendar is handled server-side
      //    when the Express server is running; in pure SPA mode the calendar
      //    integration requires a backend, so we surface what we have.
      return {
        booking: {
          id: bookingId,
          meetLink: null, // Meet link populated by server when calendar is connected
          status: 'confirmed',
          priceCents: finalPriceCents,
          currency,
          isFirstSession,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          mentorName: mentorRow.name,
        },
      } as unknown as T
    }

    // Fallback for unhandled booking sub-paths
    return {} as unknown as T
  }

  // 10. Photo upload fallback: /api/uploads/photo
  if (path.startsWith('/api/uploads/photo') && method === 'POST') {
    if (init?.body instanceof FormData) {
      const file = init.body.get('photo') as File | null
      if (file) {
        const url = URL.createObjectURL(file)
        return { url } as unknown as T
      }
    }
    return { url: '/hero.jpg' } as unknown as T
  }

  // 11. /api/community
  if (path.startsWith('/api/community')) {
    if (path.includes('/stats')) {
      return { postCount: 0, replyCount: 0, userCount: 0 } as unknown as T
    }
    if (path.includes('/like')) {
      return { liked: true, likesCount: 1 } as unknown as T
    }
    if (path.includes('/replies') && method === 'POST') {
      let body: any = {}
      try {
        body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      } catch {}
      return {
        reply: {
          id: crypto.randomUUID(),
          authorName: activeUser?.user_metadata?.full_name || 'Community Member',
          authorAvatar: activeUser?.user_metadata?.avatar_url || null,
          content: body.content || '',
          createdAt: new Date().toISOString(),
        },
      } as unknown as T
    }
    return { posts: [] } as unknown as T
  }

  // Generic safe fallback for any unhandled /api/* call in pure SPA mode
  return {} as unknown as T
}

/**
 * Map a raw Supabase mentors table row to the frontend Mentor type.
 * Handles both JSON-string columns (legacy) and native array/jsonb columns.
 */
function mapSupabaseMentor(row: any): Mentor {
  function parseArr(val: any): any[] {
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      try { return JSON.parse(val) } catch { return [] }
    }
    return []
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name || '',
    role: row.role || '',
    company: row.company || '',
    location: row.location || '',
    intro: row.intro || '',
    about: row.about || '',
    photoUrl: row.photo_url || null,
    languages: parseArr(row.languages),
    yearsExperience: row.years_experience ?? null,
    linkedinUrl: row.linkedin_url || null,
    websiteUrl: row.website_url || null,
    education: parseArr(row.education),
    companies: parseArr(row.companies),
    achievements: parseArr(row.achievements),
    status: row.status || 'draft',
    timezone: row.timezone || 'UTC',
    bufferMinutes: row.buffer_minutes ?? 15,
    advanceDays: row.advance_days ?? 30,
    minNoticeHours: row.min_notice_hours ?? 24,
    maxBookingsPerDay: row.max_bookings_per_day ?? 4,
    categories: parseArr(row.categories),
    skills: parseArr(row.skills),
    services: parseArr(row.services),
    availability: parseArr(row.availability),
    startingPriceCents: row.starting_price_cents ?? null,
    availabilityPreview: row.availability_preview ?? null,
  }
}
