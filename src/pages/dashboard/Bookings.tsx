import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Clock, Video, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import type { Booking } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange/10 text-orange',
  confirmed: 'bg-gold/10 text-gold',
  completed: 'bg-navy/10 text-navy',
  cancelled: 'bg-maroon/10 text-maroon',
}

export default function Bookings() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login?next=/dashboard/bookings')
      return
    }
    async function fetchBookings() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, mentors(name, slug, photo_url)')
          .eq('mentee_id', user.id)
          .order('start_at', { ascending: false })

        if (error) {
          console.error('[Bookings] fetch error:', error)
          return
        }
        const mapped: Booking[] = (data || []).map((row: any) => ({
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
          mentorName: row.mentors?.name || row.mentor_name || null,
          mentorSlug: row.mentors?.slug || row.mentor_slug || null,
          mentorPhoto: row.mentors?.photo_url || null,
          serviceTitle: row.service_title || null,
        }))
        setBookings(mapped)
      } catch (e) {
        console.error('[Bookings] unexpected error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [user, authLoading, navigate])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  async function cancel(id: string) {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('mentee_id', user!.id)
      if (error) throw new Error(error.message)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
      toast('Booking cancelled.', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not cancel.', 'error')
    }
  }

  const now = new Date()
  const upcoming = bookings.filter(b => new Date(b.startAt) >= now && b.status !== 'cancelled')
  const past = bookings.filter(b => new Date(b.startAt) < now || b.status === 'cancelled')
  const shown = activeTab === 'upcoming' ? upcoming : past

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-display-md font-display text-navy mb-6">My Bookings</h1>

          <div className="flex gap-1 p-1 bg-ivory-dark rounded-xl mb-8 max-w-xs">
            {(['upcoming', 'past'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  activeTab === tab ? 'bg-white text-navy shadow-soft' : 'text-grey hover:text-navy'
                }`}
              >
                {tab} {tab === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
          ) : shown.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="h-10 w-10 text-grey-mid mx-auto mb-4" />
              <p className="text-display-md font-display text-navy mb-2">
                {activeTab === 'upcoming' ? 'No upcoming sessions.' : 'No past sessions.'}
              </p>
              {activeTab === 'upcoming' && (
                <a href="/find-mentor" className="mt-4 inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold hover:bg-navy-mid transition-all">
                  Find a Mentor
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map(b => {
                const start = new Date(b.startAt)
                const end = b.endAt ? new Date(b.endAt) : null
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-grey-soft p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gold/8 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[0.625rem] font-bold text-gold uppercase">{start.toLocaleString('en', { month: 'short' })}</span>
                        <span className="text-xl font-bold text-navy">{start.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-navy">{b.serviceTitle || 'Session'}</p>
                            <p className="text-sm text-grey mt-0.5">with {b.mentorName}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[b.status] || 'bg-grey-soft text-grey'}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-grey">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gold" />
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {end ? ` – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-grey-soft">
                      {b.meetLink && (
                        <a
                          href={b.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid transition-colors"
                        >
                          <Video className="h-3.5 w-3.5" /> Join Google Meet
                        </a>
                      )}
                      {b.status === 'confirmed' && new Date(b.startAt) > now && (
                        <button
                          onClick={() => cancel(b.id)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-grey-soft rounded-xl text-xs font-medium text-grey hover:text-maroon hover:border-maroon/30 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
