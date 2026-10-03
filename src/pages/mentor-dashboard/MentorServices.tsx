import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import type { MentorService } from '@/types'

type Draft = Omit<MentorService, 'id'>

export default function MentorServices() {
  const { user, mentor, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [services, setServices] = useState<Array<MentorService | Draft & { id?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/mentor-dashboard/services'); return }
    if (!mentor) { navigate('/become-a-mentor'); return }
    api<{ services: MentorService[] }>('/api/mentor/services')
      .then(d => setServices(d.services))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, mentor])

  function add() {
    setServices(prev => [...prev, { title: '', description: '', durationMinutes: 45, priceCents: 0, currency: 'USD', format: 'online' }])
  }

  function update(i: number, key: string, value: unknown) {
    setServices(prev => prev.map((s, j) => j === i ? { ...s, [key]: value } : s))
  }

  function remove(i: number) {
    setServices(prev => prev.filter((_, j) => j !== i))
  }

  async function save() {
    setSaving(true)
    try {
      await api('/api/mentor/services', {
        method: 'PUT',
        body: JSON.stringify({ services }),
      })
      toast('Services saved!', 'success')
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
          <h1 className="text-display-md font-display text-navy mb-2">Services</h1>
          <p className="text-grey text-sm mb-8">Define the session types you offer.</p>

          {loading ? (
            <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
          ) : (
            <div className="space-y-4">
              {services.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-grey-soft p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <label className="field-label">Title *</label>
                      <input value={s.title} onChange={e => update(i, 'title', e.target.value)} className="field-input" placeholder="e.g. 1:1 Mentorship" />
                    </div>
                    <button onClick={() => remove(i)} className="text-grey hover:text-maroon transition-colors mt-6 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="field-label">Description</label>
                    <textarea value={s.description || ''} onChange={e => update(i, 'description', e.target.value)} className="field-input field-textarea" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="field-label">Duration (min)</label>
                      <input type="number" min={15} max={180} step={15} value={s.durationMinutes} onChange={e => update(i, 'durationMinutes', Number(e.target.value))} className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">Price ($)</label>
                      <input type="number" min={0} value={(s.priceCents / 100).toFixed(0)} onChange={e => update(i, 'priceCents', Math.round(Number(e.target.value) * 100))} className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">Currency</label>
                      <select value={s.currency} onChange={e => update(i, 'currency', e.target.value)} className="field-input">
                        {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Format</label>
                      <select value={s.format} onChange={e => update(i, 'format', e.target.value)} className="field-input">
                        {['online', 'in-person', 'both'].map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={add}
                className="flex items-center gap-2 w-full py-4 border-2 border-dashed border-grey-soft rounded-2xl text-sm text-grey hover:border-gold hover:text-gold transition-colors justify-center"
              >
                <Plus className="h-4 w-4" /> Add Service
              </button>

              <button
                onClick={save}
                disabled={saving}
                className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-navy-mid transition-all"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Services'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
