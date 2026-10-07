import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const bellRef = useRef<HTMLDivElement>(null)

  // Load initial notifications
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const userId = user.id
    let cancelled = false

    async function loadNotifications() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && !cancelled) {
          setNotifications(data || [])
        }
      } catch (err) {
        console.error('[NotificationBell] load error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNotifications()
    return () => { cancelled = true }
  }, [user?.id])

  // Periodic refresh as fallback (every 12 seconds)
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data) {
          setNotifications(data)
        }
      } catch (err) {
        // Silent fail on periodic refresh
      }
    }, 12000)

    return () => clearInterval(interval)
  }, [user?.id])

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id) return

    const userId = user.id

    console.log('[NotificationBell] subscribing to realtime for user:', userId)

    const channel = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newNotif = payload.new as Notification
          console.log('[NotificationBell] new notification received:', newNotif.title)
          // Avoid duplicates by checking if notification ID already exists
          setNotifications(prev => {
            const exists = prev.some(n => n.id === newNotif.id)
            return exists ? prev : [newNotif, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const updated = payload.new as Notification
          console.log('[NotificationBell] notification updated:', updated.id)
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? updated : n)
          )
        }
      )
      .subscribe((status) => {
        console.log('[NotificationBell] realtime status:', status)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id])

  // Outside click handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  if (!user) return null

  async function markAsRead(notificationId: string) {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
    } catch (err) {
      console.error('[NotificationBell] mark as read error:', err)
    }
  }

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setBellOpen(v => !v)}
        className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-ivory-dark transition-all duration-200 group cursor-pointer"
        aria-label="Notifications"
        aria-expanded={bellOpen}
      >
        <Bell className="h-4.5 w-4.5 text-navy/60 group-hover:text-gold transition-colors" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-maroon text-white text-[0.6rem] font-bold flex items-center justify-center rounded-full shadow-lg ring-2 ring-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {bellOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-lg border border-grey-soft overflow-hidden z-50 max-h-[600px] flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-grey-soft flex items-center justify-between">
              <h3 className="text-sm font-semibold font-nav text-navy">Notifications</h3>
              <button
                onClick={() => setBellOpen(false)}
                className="text-grey hover:text-navy transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="inline-block w-4 h-4 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-8 w-8 text-grey-mid mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-grey">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-grey-soft/50">
                  {notifications.map(notif => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={clsx(
                        'p-4 transition-colors duration-200 cursor-pointer hover:bg-ivory-light group',
                        !notif.read ? 'bg-gold/5' : 'bg-transparent'
                      )}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id)
                        if (notif.link?.startsWith('https://meet.google.com/')) {
                          window.open(notif.link, '_blank')
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Unread indicator */}
                        {!notif.read && (
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-gold shrink-0" />
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold font-nav text-navy truncate">
                            {notif.title}
                          </p>
                          <p className="text-xs text-grey mt-1 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                          {notif.link?.startsWith('https://meet.google.com/') && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-dark transition-colors group-hover:text-gold-dark">
                              <ExternalLink className="h-3 w-3" />
                              <span>Join Google Meet</span>
                            </div>
                          )}
                          <p className="text-[0.7rem] text-grey/50 mt-1.5">
                            {formatTime(notif.created_at)}
                          </p>
                        </div>

                        {/* Unread badge */}
                        {!notif.read && (
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gold shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}
