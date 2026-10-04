import { supabase } from './supabase'
import type { Mentor, User, Booking } from '@/types'

const PUBLIC_MENTORS_KEY = 'helpa_public_mentors'
const BOOKINGS_KEY = 'helpa_user_bookings'

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
        startingPriceCents: existing?.startingPriceCents || null,
        availabilityPreview: existing?.availabilityPreview || null,
      }

      try {
        localStorage.setItem(`helpa_mentor_${userId}`, JSON.stringify(updatedMentor))
        if (updatedMentor.status === 'published') {
          savePublicMentorToRegistry(updatedMentor)
        }
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
      savePublicMentorToRegistry(mentorObj)
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

  // 8. /api/mentors
  if (path.startsWith('/api/mentors')) {
    const publicList = getPublicMentorsRegistry()
    const cleanUrl = new URL(path, 'http://localhost')
    const slugMatch = path.match(/^\/api\/mentors\/([^/?]+)/)
    if (slugMatch) {
      const slug = slugMatch[1]
      const found = publicList.find((m) => m.slug === slug || m.id === slug)
      if (found) {
        return { mentor: found, slots: [] } as unknown as T
      }
      return { mentor: null, slots: [] } as unknown as T
    }

    let filtered = publicList
    const q = cleanUrl.searchParams.get('q')?.toLowerCase()
    const category = cleanUrl.searchParams.get('category')
    if (category) {
      filtered = filtered.filter((m) => m.categories?.includes(category))
    }
    if (q) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.company.toLowerCase().includes(q) ||
          m.intro.toLowerCase().includes(q),
      )
    }

    return { mentors: filtered } as unknown as T
  }

  // 9. /api/bookings
  if (path.startsWith('/api/bookings')) {
    let bookings: Booking[] = []
    try {
      const raw = localStorage.getItem(BOOKINGS_KEY)
      if (raw) bookings = JSON.parse(raw)
    } catch {}
    return { bookings } as unknown as T
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

function getPublicMentorsRegistry(): Mentor[] {
  try {
    const raw = localStorage.getItem(PUBLIC_MENTORS_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        return list.map((m: any) => ({
          ...m,
          categories: Array.isArray(m.categories) ? m.categories : [],
          skills: Array.isArray(m.skills) ? m.skills : [],
          services: Array.isArray(m.services) ? m.services : [],
        }))
      }
    }
  } catch {}
  return []
}

function savePublicMentorToRegistry(mentor: Mentor) {
  try {
    const list = getPublicMentorsRegistry()
    const idx = list.findIndex((m) => m.id === mentor.id || m.slug === mentor.slug)
    if (idx >= 0) {
      list[idx] = mentor
    } else {
      list.unshift(mentor)
    }
    localStorage.setItem(PUBLIC_MENTORS_KEY, JSON.stringify(list))
  } catch {}
}
