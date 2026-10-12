/**
 * Direct Supabase Mentor Dashboard API
 * ====================================
 *
 * All mentor dashboard operations use direct Supabase queries.
 * NO Vercel API dependency.
 * Security via RLS policies and authenticated sessions.
 *
 * Tables:
 * - public.mentors (mentor profile, services, availability)
 * - public.bookings (session bookings)
 * - public.profiles (mentee info)
 */

import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────
// GET Mentor ID from User ID
// ─────────────────────────────────────────────────────────────────

export async function getMentorIdByUserId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data?.id || null
  } catch (err) {
    console.error('[Mentor] getMentorIdByUserId error:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Mentor Dashboard Statistics
// ─────────────────────────────────────────────────────────────────

export async function getMentorStats(mentorId: string): Promise<{
  upcomingSessions: number
  completedSessions: number
  profileViews: number
}> {
  try {
    const now = new Date().toISOString()

    // Upcoming sessions (confirmed only, not pending - future sessions)
    const { count: upcomingCount, error: upcomingError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('mentor_id', mentorId)
      .eq('status', 'confirmed')
      .gt('start_at', now)

    if (upcomingError) throw upcomingError

    // Completed sessions (only those with completed status and completed_at set)
    const { count: completedCount, error: completedError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('mentor_id', mentorId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)

    if (completedError) throw completedError

    // Profile views (unique count from profile_views table)
    const { data: mentorData, error: mentorError } = await supabase
      .from('mentors')
      .select('profile_view_count')
      .eq('id', mentorId)
      .maybeSingle()

    if (mentorError) throw mentorError

    return {
      upcomingSessions: upcomingCount || 0,
      completedSessions: completedCount || 0,
      profileViews: mentorData?.profile_view_count || 0,
    }
  } catch (err) {
    console.error('[Mentor] getMentorStats error:', err)
    return { upcomingSessions: 0, completedSessions: 0, profileViews: 0 }
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Mentor Bookings
// ─────────────────────────────────────────────────────────────────

export interface MentorBooking {
  id: string
  mentorId: string
  menteeId: string
  serviceTitle: string
  menteeName: string
  startAt: string
  endAt: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  meetLink: string | null
}

export async function getMentorBookings(mentorId: string): Promise<MentorBooking[]> {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        mentor_id,
        mentee_id,
        service_id,
        start_at,
        end_at,
        status,
        meet_link,
        mentee:profiles(id, full_name)
      `)
      .eq('mentor_id', mentorId)
      .order('start_at', { ascending: false })

    if (error) throw error

    return (bookings || []).map((b: any) => ({
      id: b.id,
      mentorId: b.mentor_id,
      menteeId: b.mentee_id,
      serviceTitle: b.service_id || 'Session',
      menteeName: (b.mentee && b.mentee[0]?.full_name) || 'Member',
      startAt: b.start_at,
      endAt: b.end_at,
      status: b.status,
      meetLink: b.meet_link,
    }))
  } catch (err) {
    console.error('[Mentor] getMentorBookings error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Mentor Full Profile (for dashboard)
// ─────────────────────────────────────────────────────────────────

export interface MentorProfile {
  id: string
  userId: string
  name: string
  role: string
  company: string
  location: string
  intro: string
  about: string
  photoUrl: string | null
  slug: string
  status: 'draft' | 'published' | 'paused'
  timezone: string
  services: any[]
  availability: any[]
  categories: string[]
  yearsExperience: number | null
  linkedinUrl: string | null
  websiteUrl: string | null
}

export async function getMentorProfile(mentorId: string): Promise<MentorProfile | null> {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('*')
      .eq('id', mentorId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      role: data.role,
      company: data.company,
      location: data.location,
      intro: data.intro,
      about: data.about,
      photoUrl: data.photo_url,
      slug: data.slug,
      status: data.status,
      timezone: data.timezone,
      services: Array.isArray(data.services) ? data.services : [],
      availability: Array.isArray(data.availability) ? data.availability : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      yearsExperience: data.years_experience,
      linkedinUrl: data.linkedin_url,
      websiteUrl: data.website_url,
    }
  } catch (err) {
    console.error('[Mentor] getMentorProfile error:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// RECORD Profile View (with deduplication: 1 view per visitor per hour)
// ─────────────────────────────────────────────────────────────────

export async function recordProfileView(mentorId: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const visitorId = session?.user?.id || null

    // Check if visitor already viewed this mentor in the last hour
    if (visitorId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentView, error: checkError } = await supabase
        .from('profile_views')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('visitor_id', visitorId)
        .gt('viewed_at', oneHourAgo)
        .maybeSingle()

      if (checkError) throw checkError

      // Already viewed in last hour, don't record duplicate
      if (recentView) {
        return false
      }
    }

    // Get visitor info if authenticated
    let visitorName: string | null = null
    let visitorAvatarUrl: string | null = null

    if (visitorId) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', visitorId)
          .maybeSingle()

        if (!profileError && profile) {
          visitorName = profile.full_name
          visitorAvatarUrl = profile.avatar_url
        }
      } catch {}
    }

    // Record the profile view
    const { error: insertError } = await supabase
      .from('profile_views')
      .insert({
        mentor_id: mentorId,
        visitor_id: visitorId,
        visitor_name: visitorName,
        visitor_avatar_url: visitorAvatarUrl,
        viewed_at: new Date().toISOString(),
      })

    if (insertError) throw insertError

    // Increment mentor's profile_view_count
    const { data: mentor, error: mentorFetchError } = await supabase
      .from('mentors')
      .select('profile_view_count')
      .eq('id', mentorId)
      .maybeSingle()

    if (mentorFetchError) throw mentorFetchError

    const newCount = (mentor?.profile_view_count || 0) + 1

    const { error: updateError } = await supabase
      .from('mentors')
      .update({ profile_view_count: newCount })
      .eq('id', mentorId)

    if (updateError) throw updateError

    return true
  } catch (err) {
    console.error('[Mentor] recordProfileView error:', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Profile Views/Visitors for a Mentor
// ─────────────────────────────────────────────────────────────────

export interface ProfileVisitor {
  id: string
  visitorId: string | null
  visitorName: string | null
  visitorAvatarUrl: string | null
  viewedAt: string
}

export async function getMentorProfileVisitors(
  mentorId: string,
  limit: number = 20
): Promise<ProfileVisitor[]> {
  try {
    const { data, error } = await supabase
      .from('profile_views')
      .select('id, visitor_id, visitor_name, visitor_avatar_url, viewed_at')
      .eq('mentor_id', mentorId)
      .order('viewed_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((view: any) => ({
      id: view.id,
      visitorId: view.visitor_id,
      visitorName: view.visitor_name || 'Anonymous Visitor',
      visitorAvatarUrl: view.visitor_avatar_url,
      viewedAt: view.viewed_at,
    }))
  } catch (err) {
    console.error('[Mentor] getMentorProfileVisitors error:', err)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────
// MARK Booking as Completed
// ─────────────────────────────────────────────────────────────────

export async function markBookingCompleted(bookingId: string): Promise<boolean> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Verify the booking belongs to the authenticated mentor
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('mentor_id, status, completed_at')
      .eq('id', bookingId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!booking) throw new Error('Booking not found')

    // Verify mentor ownership through join
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('user_id')
      .eq('id', booking.mentor_id)
      .maybeSingle()

    if (mentorError) throw mentorError
    if (!mentor || mentor.user_id !== session.user.id) {
      throw new Error('Unauthorized: cannot complete another mentor booking')
    }

    // Don't mark as completed twice
    if (booking.status === 'completed' && booking.completed_at) {
      return false
    }

    // Mark as completed
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) throw updateError

    return true
  } catch (err) {
    console.error('[Mentor] markBookingCompleted error:', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE Mentor Profile
// ─────────────────────────────────────────────────────────────────

export async function updateMentorProfile(
  mentorId: string,
  updates: Partial<{
    name: string
    role: string
    company: string
    location: string
    intro: string
    about: string
    photoUrl: string
    timezone: string
    categories: string[]
    yearsExperience: number
    linkedinUrl: string
    websiteUrl: string
  }>
): Promise<MentorProfile | null> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Verify ownership: mentor.user_id must match authenticated user
    const { data: existingMentor, error: fetchError } = await supabase
      .from('mentors')
      .select('user_id')
      .eq('id', mentorId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existingMentor) throw new Error('Mentor not found')
    if (existingMentor.user_id !== session.user.id) {
      throw new Error('Unauthorized: cannot update another mentor profile')
    }

    // Update mentor record (RLS will also enforce this)
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.role !== undefined) updateData.role = updates.role
    if (updates.company !== undefined) updateData.company = updates.company
    if (updates.location !== undefined) updateData.location = updates.location
    if (updates.intro !== undefined) updateData.intro = updates.intro
    if (updates.about !== undefined) updateData.about = updates.about
    if (updates.photoUrl !== undefined) updateData.photo_url = updates.photoUrl
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.categories !== undefined) updateData.categories = updates.categories
    if (updates.yearsExperience !== undefined) updateData.years_experience = updates.yearsExperience
    if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl
    if (updates.websiteUrl !== undefined) updateData.website_url = updates.websiteUrl
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('mentors')
      .update(updateData)
      .eq('id', mentorId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      role: data.role,
      company: data.company,
      location: data.location,
      intro: data.intro,
      about: data.about,
      photoUrl: data.photo_url,
      slug: data.slug,
      status: data.status,
      timezone: data.timezone,
      services: Array.isArray(data.services) ? data.services : [],
      availability: Array.isArray(data.availability) ? data.availability : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      yearsExperience: data.years_experience,
      linkedinUrl: data.linkedin_url,
      websiteUrl: data.website_url,
    }
  } catch (err) {
    console.error('[Mentor] updateMentorProfile error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET/UPDATE Mentor Services
// ─────────────────────────────────────────────────────────────────

export interface MentorService {
  title: string
  description: string
  durationMinutes: number
  priceCents: number
  currency: string
  format: string
}

export async function getMentorServices(mentorId: string): Promise<MentorService[]> {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('services')
      .eq('id', mentorId)
      .maybeSingle()

    if (error) throw error
    if (!data) return []

    return Array.isArray(data.services) ? data.services : []
  } catch (err) {
    console.error('[Mentor] getMentorServices error:', err)
    return []
  }
}

export async function updateMentorServices(
  mentorId: string,
  services: MentorService[]
): Promise<MentorService[]> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Verify ownership
    const { data: existingMentor, error: fetchError } = await supabase
      .from('mentors')
      .select('user_id')
      .eq('id', mentorId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existingMentor) throw new Error('Mentor not found')
    if (existingMentor.user_id !== session.user.id) {
      throw new Error('Unauthorized: cannot update another mentor services')
    }

    const { data, error } = await supabase
      .from('mentors')
      .update({
        services,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mentorId)
      .select('services')
      .maybeSingle()

    if (error) throw error
    if (!data) return []

    return Array.isArray(data.services) ? data.services : []
  } catch (err) {
    console.error('[Mentor] updateMentorServices error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET/UPDATE Mentor Availability
// ─────────────────────────────────────────────────────────────────

export interface AvailabilityRule {
  weekday: number // 0-6
  startTime: string // HH:mm
  endTime: string // HH:mm
  enabled: boolean
}

export async function getMentorAvailability(mentorId: string): Promise<{
  rules: AvailabilityRule[]
  timezone: string
}> {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('availability, timezone')
      .eq('id', mentorId)
      .maybeSingle()

    if (error) throw error
    if (!data) return { rules: [], timezone: 'UTC' }

    return {
      rules: Array.isArray(data.availability) ? data.availability : [],
      timezone: data.timezone || 'UTC',
    }
  } catch (err) {
    console.error('[Mentor] getMentorAvailability error:', err)
    return { rules: [], timezone: 'UTC' }
  }
}

export async function updateMentorAvailability(
  mentorId: string,
  rules: AvailabilityRule[],
  timezone: string
): Promise<{ rules: AvailabilityRule[]; timezone: string }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Verify ownership
    const { data: existingMentor, error: fetchError } = await supabase
      .from('mentors')
      .select('user_id')
      .eq('id', mentorId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existingMentor) throw new Error('Mentor not found')
    if (existingMentor.user_id !== session.user.id) {
      throw new Error('Unauthorized: cannot update another mentor availability')
    }

    const { data, error } = await supabase
      .from('mentors')
      .update({
        availability: rules,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mentorId)
      .select('availability, timezone')
      .maybeSingle()

    if (error) throw error
    if (!data) return { rules: [], timezone: 'UTC' }

    return {
      rules: Array.isArray(data.availability) ? data.availability : [],
      timezone: data.timezone || 'UTC',
    }
  } catch (err) {
    console.error('[Mentor] updateMentorAvailability error:', err)
    throw err
  }
}
