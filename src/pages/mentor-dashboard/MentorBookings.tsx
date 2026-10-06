import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Clock, Video } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getMentorBookings, type MentorBooking } from '@/lib/mentor'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange/10 text-orange',
  confirmed: 'bg-gold/10 text-gold',
  completed: 'bg-navy/10 text-navy',
  cancelled: 'bg-maroon/10 text-maroon',
}

export default function MentorBookings() {
  const { user, mentor, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<MentorBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login?next=/mentor-dashboard/bookings')
      return
    }
    if (!mentor) {
      navigate('/become-a-mentor')
      return
    }

    setLoading(true)
    setError(null)
    getMentorBookings(mentor.id)
      .then((data) => {
        setBookings(data)
      })
      .catch((err) => {
        console.error('Failed to load mentor bookings:', err)
        setError('Failed to load bookings. Please try again.')
        setBookings([])
      })
      .finally(() => setLoading(false))
  }, [user, mentor, authLoading, navigate])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-display-md font-display text-navy mb-8">My Sessions</h1>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
          ) : error ? (
            <div className="text-center py-20">
              <Calendar className="h-10 w-10 text-maroon mx-auto mb-4" />
              <p className="text-display-md font-display text-navy mb-2">Something went wrong.</p>
              <p className="text-grey">{error}</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="h-10 w-10 text-grey-mid mx-auto mb-4" />
              <p className="text-display-md font-display text-navy mb-2">No sessions yet.</p>
              <p className="text-grey">When people book sessions with you, they'll appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(b => {
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
                            <p className="text-sm text-grey mt-0.5">with {b.menteeName}</p>
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
                    {b.meetLink && (
                      <div className="mt-4 pt-4 border-t border-grey-soft">
                        <a
                          href={b.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid transition-colors"
                        >
                          <Video className="h-3.5 w-3.5" /> Join Google Meet
                        </a>
                      </div>
                    )}
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
