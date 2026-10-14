import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Settings, User, Eye, BarChart3, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getMentorStats, getMentorProfileVisitors, type ProfileVisitor } from '@/lib/mentor'

const NAV = [
  { to: '/mentor-dashboard', label: 'Overview', icon: <BarChart3 className="h-4 w-4" />, end: true },
  { to: '/mentor-dashboard/bookings', label: 'Bookings', icon: <Calendar className="h-4 w-4" /> },
  { to: '/mentor-dashboard/availability', label: 'Availability', icon: <Clock className="h-4 w-4" /> },
  { to: '/mentor-dashboard/services', label: 'Services', icon: <Settings className="h-4 w-4" /> },
  { to: '/mentor-dashboard/profile', label: 'Edit Profile', icon: <User className="h-4 w-4" /> },
]

export default function MentorDashboard() {
  const { user, mentor, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, views: 0 })
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([])
  const [loadingVisitors, setLoadingVisitors] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login?next=/mentor-dashboard')
      return
    }

    let active = true

    if (!mentor) {
      async function verifyMentorInDb() {
        if (!user) return
        try {
          const { data: dbMentor } = await supabase
            .from('mentors')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()
          if (!active) return
          if (!dbMentor) {
            navigate('/become-a-mentor')
          } else {
            await refresh()
          }
        } catch {
          if (active) navigate('/become-a-mentor')
        }
      }
      verifyMentorInDb()
      return () => {
        active = false
      }
    }

    // Initial stats load
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

    // Load profile visitors
    setLoadingVisitors(true)
    getMentorProfileVisitors(mentor.id, 10)
      .then(setVisitors)
      .catch(err => {
        console.error('Failed to load profile visitors:', err)
        setVisitors([])
      })
      .finally(() => setLoadingVisitors(false))

    // Setup Realtime subscriptions for live updates
    const bookingsSubscription = supabase
      .channel(`bookings:mentor_id=eq.${mentor.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings',
          filter: `mentor_id=eq.${mentor.id}`
        },
        () => {
          // Refresh stats when bookings change
          getMentorStats(mentor.id)
            .then((data) => {
              setStats({
                upcoming: data.upcomingSessions,
                completed: data.completedSessions,
                views: data.profileViews,
              })
            })
            .catch(err => console.error('Error refreshing stats:', err))
        }
      )
      .subscribe()

    // Subscribe to profile views changes (new views)
    const viewsSubscription = supabase
      .channel(`profile_views:mentor_id=eq.${mentor.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_views',
          filter: `mentor_id=eq.${mentor.id}`
        },
        () => {
          // Refresh stats and visitors when new view is recorded
          getMentorStats(mentor.id)
            .then((data) => {
              setStats(s => ({ ...s, views: data.profileViews }))
            })
            .catch(err => console.error('Error refreshing views:', err))
          
          getMentorProfileVisitors(mentor.id, 10)
            .then(setVisitors)
            .catch(err => console.error('Error refreshing visitors:', err))
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount or mentor change
    return () => {
      supabase.removeChannel(bookingsSubscription)
      supabase.removeChannel(viewsSubscription)
    }
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

            {/* Profile Visitors */}
            <div className="bg-white rounded-2xl border border-grey-soft p-6 mt-8">
              <h2 className="text-base font-display text-navy mb-5">Recent Profile Visitors</h2>
              {loadingVisitors ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                </div>
              ) : visitors.length === 0 ? (
                <div className="text-center py-8">
                  <Eye className="h-8 w-8 text-grey/30 mx-auto mb-2" />
                  <p className="text-sm text-grey">No visitors yet. Share your profile to get views!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visitors.map((visitor) => (
                    <div key={visitor.id} className="flex items-center gap-3 p-3 hover:bg-ivory-light rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-ivory-dark flex items-center justify-center">
                        {visitor.visitorAvatarUrl ? (
                          <img src={visitor.visitorAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-grey" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy truncate">{visitor.visitorName}</p>
                        <p className="text-xs text-grey">
                          {new Date(visitor.viewedAt).toLocaleDateString()} at{' '}
                          {new Date(visitor.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
