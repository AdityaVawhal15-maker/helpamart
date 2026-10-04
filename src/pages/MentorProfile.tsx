import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MapPin, Globe, Briefcase, Clock, Calendar, ChevronLeft, ChevronRight,
  Star, Linkedin, ExternalLink, CheckCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ProfileSkeleton, CalendarSkeleton } from '@/components/ui/LoadingSkeleton'
import type { Mentor, MentorService } from '@/types'

type SlotData = { timezone: string; slots: { start: string; end: string }[]; durationMinutes: number }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function MentorProfile() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [slotData, setSlotData] = useState<SlotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<MentorService | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [slotLoading, setSlotLoading] = useState(false)
  const bookingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)

    async function loadMentor() {
      try {
        const { data, error } = await supabase
          .from('mentors')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()

        if (error) {
          console.error('[MentorProfile] Supabase error:', error)
          navigate('/find-mentor', { replace: true })
          return
        }

        if (!data) {
          navigate('/find-mentor', { replace: true })
          return
        }

        function parseArr(val: any): any[] {
          if (Array.isArray(val)) return val
          if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
          return []
        }

        const services = parseArr(data.services)
        const prices = services
          .map((s: any) => (typeof s.priceCents === 'number' ? s.priceCents : null))
          .filter((p: any): p is number => p !== null)

        const mentor: Mentor = {
          id: data.id,
          slug: data.slug,
          name: data.name || '',
          role: data.role || '',
          company: data.company || '',
          location: data.location || '',
          intro: data.intro || '',
          about: data.about || '',
          photoUrl: data.photo_url || null,
          languages: parseArr(data.languages),
          yearsExperience: data.years_experience ?? null,
          linkedinUrl: data.linkedin_url || null,
          websiteUrl: data.website_url || null,
          education: parseArr(data.education),
          companies: parseArr(data.companies),
          achievements: parseArr(data.achievements),
          status: data.status || 'published',
          timezone: data.timezone || 'UTC',
          bufferMinutes: data.buffer_minutes ?? 15,
          advanceDays: data.advance_days ?? 30,
          minNoticeHours: data.min_notice_hours ?? 24,
          maxBookingsPerDay: data.max_bookings_per_day ?? 4,
          categories: parseArr(data.categories),
          skills: parseArr(data.skills),
          services,
          startingPriceCents: data.starting_price_cents ?? (prices.length > 0 ? Math.min(...prices) : null),
          availabilityPreview: data.availability_preview ?? null,
        }

        setMentor(mentor)
        if (mentor.services.length > 0) setSelectedService(mentor.services[0])
      } catch (err) {
        console.error('[MentorProfile] Unexpected error:', err)
        navigate('/find-mentor', { replace: true })
      } finally {
        setLoading(false)
      }
    }

    loadMentor()
  }, [slug])

  // Availability slots are computed server-side by the Express API when running locally.
  // In production (Vercel SPA), we derive a simplified slot view from the stored services.
  useEffect(() => {
    if (!mentor || !selectedService) return
    setSlotLoading(true)
    // Generate a simple 14-day availability preview from the mentor's stored availability JSONB.
    // The full slot computation runs in the Express server; here we produce a reasonable preview.
    const timezone = mentor.timezone || 'UTC'
    const durationMin = selectedService.durationMinutes || 30
    const slots: { start: string; end: string }[] = []

    // Use availability rules stored in the services/availability field if available
    // For a production SPA deployment without the Express server, we derive placeholder
    // availability from the mentor's configured schedule (stored as JSONB in Supabase).
    // Since the Express server handles real slot generation, we return empty slots here
    // so the booking calendar shows "No availability set yet" rather than fake data.
    // When the Express server is running, the /api/mentors/:slug/availability endpoint
    // provides real generated slots — that path is used in the BookingFlow page.
    setSlotData({ timezone, slots, durationMinutes: durationMin })
    setSlotLoading(false)
  }, [mentor, selectedService])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <ProfileSkeleton />
      </div>
    )
  }

  if (!mentor) return null

  // Build calendar data
  const availableDates = new Set(slotData?.slots.map(s => s.start.slice(0, 10)) ?? [])
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const calYear = calMonth.getFullYear()
  const calMon = calMonth.getMonth()
  const firstDay = new Date(calYear, calMon, 1).getDay()
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate()

  const slotsForDate = selectedDate
    ? (slotData?.slots.filter(s => s.start.startsWith(selectedDate)) ?? [])
    : []

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function handleBook() {
    if (!user) { navigate(`/login?next=/mentor/${slug}`); return }
    if (!selectedService || !selectedSlot) return
    navigate(`/mentor/${slug}/book`, {
      state: { service: selectedService, startAt: selectedSlot, timezone: slotData?.timezone }
    })
  }

  return (
    <div className="bg-ivory min-h-screen">
      {/* ── Profile Hero ── */}
      <div className="bg-ivory-light border-b border-grey-soft">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Link to="/find-mentor" className="inline-flex items-center gap-1.5 text-sm text-grey hover:text-gold transition-colors mb-8 group">
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to mentors
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-8 items-start"
          >
            {/* Photo */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden bg-grey-soft shrink-0 shadow-soft">
              {mentor.photoUrl ? (
                <img src={mentor.photoUrl} alt={mentor.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-display text-grey">
                  {mentor.name.slice(0, 1)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-3 mb-1">
                <h1 className="text-display-md font-display text-navy">{mentor.name}</h1>
                {mentor.status === 'published' && (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-gold bg-gold/10 rounded-full px-2.5 py-1">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>

              <p className="text-navy/70 text-base font-medium">
                {mentor.role}
                {mentor.company && <span className="text-grey"> · {mentor.company}</span>}
              </p>

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-grey">
                {mentor.location && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gold" />{mentor.location}</span>
                )}
                {mentor.yearsExperience != null && (
                  <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-gold" />{mentor.yearsExperience}+ years experience</span>
                )}
                {mentor.timezone && (
                  <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-gold" />{mentor.timezone}</span>
                )}
              </div>

              {/* Expertise tags */}
              {mentor.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {mentor.categories.map(c => (
                    <span key={c} className="pill text-xs py-1 px-3">{c}</span>
                  ))}
                </div>
              )}

              {/* Links */}
              <div className="flex gap-3 mt-4">
                {mentor.linkedinUrl && (
                  <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                )}
                {mentor.websiteUrl && (
                  <a href={mentor.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors">
                    <ExternalLink className="h-4 w-4" /> Website
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Short intro */}
          {mentor.intro && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-navy/80 text-base leading-relaxed mt-6 max-w-2xl"
            >
              {mentor.intro}
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-12">

          {/* About */}
          {mentor.about && (
            <section>
              <h2 className="text-lg font-display text-navy mb-4 pb-3 border-b border-grey-soft">About</h2>
              <p className="text-navy/70 leading-relaxed whitespace-pre-line">{mentor.about}</p>
            </section>
          )}

          {/* How I can help — Services */}
          {mentor.services.length > 0 && (
            <section>
              <h2 className="text-lg font-display text-navy mb-4 pb-3 border-b border-grey-soft">How I can help</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mentor.services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedService(s); setSelectedSlot(null); bookingRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
                    className={`text-left p-5 rounded-2xl border-2 transition-all ${
                      selectedService?.id === s.id
                        ? 'border-gold bg-gold/5'
                        : 'border-grey-soft hover:border-gold/40 bg-white hover:bg-ivory-light'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-navy">{s.title}</h3>
                      {selectedService?.id === s.id && (
                        <CheckCircle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                      )}
                    </div>
                    {s.description && (
                      <p className="text-sm text-grey mt-1.5 leading-snug line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-grey">
                        <Clock className="h-3.5 w-3.5" />{s.durationMinutes} min
                      </span>
                      <span className="font-semibold text-gold">
                        {s.priceCents === 0 ? 'Free' : `$${(s.priceCents / 100).toFixed(0)}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {(mentor.companies.length > 0 || mentor.education.length > 0) && (
            <section>
              <h2 className="text-lg font-display text-navy mb-4 pb-3 border-b border-grey-soft">Experience</h2>
              <div className="space-y-3">
                {mentor.companies.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-ivory-dark flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-gold" />
                    </div>
                    <span className="text-navy">{c}</span>
                  </div>
                ))}
                {mentor.education.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-ivory-dark flex items-center justify-center shrink-0">
                      <Star className="h-4 w-4 text-gold" />
                    </div>
                    <span className="text-navy">{e}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column — Booking */}
        <div className="lg:col-span-1">
          <div ref={bookingRef} className="sticky top-24 bg-white border border-grey-soft rounded-2xl p-6 shadow-soft">
            <h2 className="text-base font-display text-navy mb-1">Choose a time</h2>
            {slotData?.timezone && (
              <p className="text-xs text-grey mb-5 flex items-center gap-1">
                <Globe className="h-3 w-3" /> {slotData.timezone}
              </p>
            )}

            {/* Service selector (small) */}
            {mentor.services.length > 1 && (
              <div className="mb-5">
                <label className="field-label">Session type</label>
                <select
                  value={selectedService?.id ?? ''}
                  onChange={e => {
                    const s = mentor.services.find(sv => sv.id === e.target.value)
                    setSelectedService(s ?? null)
                    setSelectedSlot(null)
                  }}
                  className="field-input text-sm"
                >
                  {mentor.services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.durationMinutes} min {s.priceCents === 0 ? '(Free)' : `($${(s.priceCents / 100).toFixed(0)})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Calendar */}
            {slotLoading ? (
              <CalendarSkeleton />
            ) : !slotData || slotData.slots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 text-grey-mid mx-auto mb-2" />
                <p className="text-sm text-grey">No availability set yet.</p>
              </div>
            ) : (
              <>
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-navy">
                    {MONTHS[calMon]} {calYear}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-ivory-dark transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-ivory-dark transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-[0.625rem] font-semibold text-grey py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1
                    const dateStr = `${calYear}-${String(calMon + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    const isAvail = availableDates.has(dateStr)
                    const isPast = new Date(dateStr) < today
                    const isSelected = selectedDate === dateStr
                    const isToday = new Date().toISOString().slice(0, 10) === dateStr

                    return (
                      <button
                        key={dayNum}
                        disabled={!isAvail || isPast}
                        onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null) }}
                        className={`calendar-day mx-auto text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed
                          ${isSelected ? 'calendar-day-selected' : ''}
                          ${isAvail && !isPast && !isSelected ? 'calendar-day-available' : ''}
                          ${isToday && !isSelected ? 'calendar-day-today' : ''}
                          ${!isAvail || isPast ? 'text-grey/40' : ''}
                        `}
                        aria-label={`${dateStr}${isAvail ? ' — available' : ''}`}
                      >
                        {dayNum}
                      </button>
                    )
                  })}
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-navy mb-3">
                      Available times · {selectedDate}
                    </p>
                    {slotsForDate.length === 0 ? (
                      <p className="text-xs text-grey">No slots available on this day.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {slotsForDate.map(slot => (
                          <button
                            key={slot.start}
                            onClick={() => setSelectedSlot(slot.start)}
                            className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                              selectedSlot === slot.start
                                ? 'bg-navy border-navy text-white'
                                : 'border-grey-soft text-navy hover:border-gold hover:text-gold bg-white'
                            }`}
                          >
                            {formatTime(slot.start)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Book CTA */}
                <button
                  onClick={handleBook}
                  disabled={!selectedSlot || !selectedService}
                  className="mt-5 w-full py-3.5 rounded-xl bg-navy text-white font-semibold text-sm hover:bg-navy-mid transition-all hover:shadow-[0_6px_20px_rgba(7,26,53,0.2)] disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  {selectedSlot
                    ? `Book · ${formatTime(selectedSlot)}`
                    : 'Select a time to book'}
                </button>

                {selectedService && (
                  <p className="text-center text-xs text-grey mt-3">
                    {selectedService.durationMinutes} min session ·{' '}
                    {selectedService.priceCents === 0 ? 'Free' : `$${(selectedService.priceCents / 100).toFixed(0)}`}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
