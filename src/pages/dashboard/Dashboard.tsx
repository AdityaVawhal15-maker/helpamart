import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, User, Settings, LogOut, BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import type { Booking } from '@/types'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: <BookOpen className="h-4 w-4" />, end: true },
  { to: '/dashboard/bookings', label: 'My Bookings', icon: <Calendar className="h-4 w-4" /> },
  { to: '/dashboard/profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState<Booking[]>([])

  useEffect(() => {
    if (!user) { navigate('/login?next=/dashboard'); return }
    api<{ bookings: Booking[] }>('/api/bookings?status=confirmed').then(d => setUpcoming(d.bookings.slice(0, 3))).catch(() => {})
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-grey-soft p-5 sticky top-24">
            {/* Avatar */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-grey-soft">
              <div className="w-11 h-11 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" alt="" /> : (user.name?.[0] || '?')}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-navy text-sm truncate">{user.name}</p>
                <p className="text-xs text-grey truncate">{user.email}</p>
              </div>
            </div>
            <nav className="space-y-1">
              {NAV.map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-navy text-white' : 'text-navy/70 hover:bg-ivory-dark hover:text-navy'
                    }`
                  }
                >
                  {n.icon}
                  {n.label}
                </NavLink>
              ))}
              <button
                onClick={async () => { await logout(); navigate('/') }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-maroon hover:bg-maroon/5 transition-all w-full text-left mt-2"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-display-md font-display text-navy mb-1">
              Welcome back, <em className="italic-serif" style={{ fontStyle: 'italic' }}>{user.name?.split(' ')[0] || 'there'}</em>.
            </h1>
            <p className="text-grey text-sm mb-8">Here's what's happening with your HELPA journey.</p>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Upcoming Sessions', value: upcoming.length, link: '/dashboard/bookings' },
                { label: 'Sessions Completed', value: 0, link: '/dashboard/bookings' },
                { label: 'Mentors Explored', value: 0, link: '/find-mentor' },
              ].map(stat => (
                <Link key={stat.label} to={stat.link} className="bg-white rounded-2xl border border-grey-soft p-5 hover:border-gold/30 transition-all group">
                  <p className="text-3xl font-display text-navy">{stat.value}</p>
                  <p className="text-xs text-grey mt-1">{stat.label}</p>
                </Link>
              ))}
            </div>

            {/* Upcoming sessions */}
            <div className="bg-white rounded-2xl border border-grey-soft p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-display text-navy">Upcoming Sessions</h2>
                <Link to="/dashboard/bookings" className="text-xs text-gold hover:underline">View all</Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="h-8 w-8 text-grey-mid mx-auto mb-3" />
                  <p className="text-sm text-grey mb-4">No upcoming sessions yet.</p>
                  <Link to="/find-mentor" className="inline-flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all">
                    Find a Mentor
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(b => <BookingRow key={b.id} booking={b} />)}
                </div>
              )}
            </div>

            {/* CTA to become a mentor */}
            <div className="mt-6 bg-navy rounded-2xl p-6 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">Share your experience.</p>
                <p className="text-white/60 text-sm mt-0.5">Become a mentor and help others grow.</p>
              </div>
              <Link to="/become-a-mentor" className="bg-gold text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gold-mid transition-all shrink-0">
                Get Started
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function BookingRow({ booking }: { booking: Booking }) {
  const start = new Date(booking.startAt)
  return (
    <div className="flex items-center gap-4 p-4 bg-ivory-light rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-gold/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-xs font-bold text-gold uppercase">{start.toLocaleString('en', { month: 'short' })}</span>
        <span className="text-lg font-bold text-navy leading-none">{start.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy text-sm truncate">{booking.serviceTitle || 'Session'}</p>
        <p className="text-xs text-grey mt-0.5">
          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {booking.mentorName}
        </p>
      </div>
      {booking.meetLink && (
        <a href={booking.meetLink} target="_blank" rel="noopener noreferrer"
          className="text-xs font-semibold text-gold hover:underline shrink-0">
          Join →
        </a>
      )}
    </div>
  )
}
