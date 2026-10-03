import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Globe, Copy, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

type Rule = { weekday: number; startTime: string; endTime: string; enabled: boolean }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function MentorAvailability() {
  const { user, mentor, loading: authLoading, refresh } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [timezone, setTimezone] = useState(mentor?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [availability, setAvailability] = useState<Rule[]>([
    { weekday: 0, startTime: '10:00', endTime: '14:00', enabled: false },
    { weekday: 1, startTime: '09:00', endTime: '17:00', enabled: true },
    { weekday: 2, startTime: '09:00', endTime: '17:00', enabled: true },
    { weekday: 3, startTime: '09:00', endTime: '17:00', enabled: true },
    { weekday: 4, startTime: '09:00', endTime: '17:00', enabled: true },
    { weekday: 5, startTime: '09:00', endTime: '17:00', enabled: true },
    { weekday: 6, startTime: '10:00', endTime: '14:00', enabled: false },
  ])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/mentor-dashboard/availability'); return }
    if (!mentor) { navigate('/become-a-mentor'); return }
    api<{ rules: Rule[]; timezone: string }>('/api/mentor/availability')
      .then(d => {
        if (d.rules.length) setAvailability(d.rules)
        setTimezone(d.timezone ?? mentor.timezone)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, mentor])

  function update(weekday: number, key: keyof Rule, value: unknown) {
    setAvailability(prev => prev.map(r => r.weekday === weekday ? { ...r, [key]: value } : r))
  }

  function copyToAll(weekday: number) {
    const src = availability.find(r => r.weekday === weekday)
    if (!src) return
    setAvailability(prev => prev.map(r => r.enabled ? { ...r, startTime: src.startTime, endTime: src.endTime } : r))
    toast('Times copied to all active days.', 'success')
  }

  async function save() {
    setSaving(true)
    try {
      await api('/api/mentor/availability', {
        method: 'PUT',
        body: JSON.stringify({ timezone, rules: availability }),
      })
      await refresh()
      toast('Availability saved!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-display-md font-display text-navy mb-2">Availability</h1>
          <p className="text-grey text-sm mb-8">Set when you're available for sessions.</p>

          <div className="bg-white rounded-2xl border border-grey-soft p-6 space-y-6">
            <div>
              <label className="field-label flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-gold" /> Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="field-input">
                {Intl.supportedValuesOf('timeZone').map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="space-y-3">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-3">
                {availability.map(rule => (
                  <div key={rule.weekday} className={`avail-day-card ${rule.enabled ? 'avail-day-card-active' : ''}`}>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${rule.enabled ? 'bg-navy' : 'bg-grey-soft'}`}
                        onClick={() => update(rule.weekday, 'enabled', !rule.enabled)}
                        role="switch"
                        aria-checked={rule.enabled}
                        tabIndex={0}
                        onKeyDown={e => e.key === ' ' && update(rule.weekday, 'enabled', !rule.enabled)}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className={`text-sm font-medium w-24 shrink-0 ${rule.enabled ? 'text-navy' : 'text-grey'}`}>{DAYS[rule.weekday]}</span>
                      {rule.enabled && (
                        <>
                          <input type="time" value={rule.startTime} onChange={e => update(rule.weekday, 'startTime', e.target.value)} className="field-input w-auto text-sm py-1.5 px-2" />
                          <span className="text-grey text-sm">–</span>
                          <input type="time" value={rule.endTime} onChange={e => update(rule.weekday, 'endTime', e.target.value)} className="field-input w-auto text-sm py-1.5 px-2" />
                          <button onClick={() => copyToAll(rule.weekday)} title="Copy to all active days" className="text-grey hover:text-gold transition-colors ml-auto">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-navy-mid transition-all"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Availability'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
