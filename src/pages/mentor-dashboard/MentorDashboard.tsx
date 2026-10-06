import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Settings, User, Eye, BarChart3, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getMentorStats } from '@/lib/mentor'

const NAV = [
  { to: '/mentor-dashboard', label: 'Overview', icon: <BarChart3 className="h-4 w-4" />, end: true },
  { to: '/mentor-dashboard/bookings', label: 'Bookings', icon: <Calendar className="h-4 w-4" /> },
  { to: '/mentor-dashboard/availability', label: 'Availability', icon: <Clock className="h-4 w-4" /> },
  { to: '/mentor-dashboard/services', label: 'Services', icon: <Settings className="h-4 w-4" /> },
  { to: '/mentor-dashboard/profile', label: 'Edit Profile', icon: <User className="h-4 w-4" /> },
]

export default function MentorDashboard() {
  const { user, mentor, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, views: 0 })

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login?next=/mentor-dashboard')
      return
    }
    if (!mentor) {
      navigate('/become-a-mentor')
      return
    }

    getMentorStats(mentor.id)
      .then((data) => {
        setStats({
          upcoming: data.upcomingSessions,
          completed: data.completedSessions,
          views: data.profileViews,
        })
      })
      .catch((err) => {
        console.error('Failed to load mentor stats:', err)
        setStats({ upcoming: 0, completed: 0, views: 0 })
      })
  }, [user, mentor, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user || !mentor) return null

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-grey-soft p-5 sticky top-24">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-grey-soft">
              <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                {mentor.photoUrl
                  ? <img src={mentor.photoUrl} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full bg-navy text-white flex items-center justify-center font-bold text-sm">{mentor.name?.[0] || '?'}</div>
                }
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-navy text-sm truncate">{mentor.name}</p>
                <p className="text-xs text-grey truncate">Mentor</p>
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
                  {n.icon}{n.label}
                </NavLink>
              ))}
              {mentor.slug && (
                <Link
                  to={`/mentor/${mentor.slug}`}
                  target="_blank"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gold hover:bg-gold/10 transition-all mt-2"
                >
                  <Eye className="h-4 w-4" /> View Profile
                </Link>
              )}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h1 className="text-display-md font-display text-navy">Mentor Dashboard</h1>
                <p className="text-grey text-sm mt-0.5">Your mentoring activity and profile overview.</p>
              </div>
              {mentor.status !== 'published' && (
                <div className="bg-orange/10 border border-orange/20 rounded-xl px-4 py-2">
                  <p className="text-xs font-semibold text-orange">Profile not yet published</p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Upcoming Sessions', value: stats.upcoming, color: 'text-gold' },
                { label: 'Sessions Completed', value: stats.completed, color: 'text-navy' },
                { label: 'Profile Views', value: stats.views, color: 'text-maroon' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl border border-grey-soft p-5">
                  <p className={`text-3xl font-display ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-grey mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-grey-soft p-6">
              <h2 className="text-base font-display text-navy mb-5">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Edit Availability', to: '/mentor-dashboard/availability', color: 'bg-gold/10 text-gold' },
                  { label: 'Manage Services', to: '/mentor-dashboard/services', color: 'bg-navy/8 text-navy' },
                  { label: 'Edit Profile', to: '/mentor-dashboard/profile', color: 'bg-maroon/8 text-maroon' },
                ].map(a => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className={`${a.color} rounded-xl p-4 text-sm font-semibold hover:opacity-80 transition-opacity`}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
