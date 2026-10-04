import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

export default function DashboardProfile() {
  const { user, loading, refresh, updateUserProfile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.name) setName(user.name)
  }, [user?.name])

  useEffect(() => {
    if (!loading && !user) navigate('/login?next=/dashboard/profile')
  }, [loading, user, navigate])

  async function save() {
    if (!name.trim()) {
      toast('Please enter your name.', 'error')
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ name: name.trim() })
      try {
        await api('/api/users/me', { method: 'PUT', body: JSON.stringify({ name: name.trim() }) })
      } catch {}
      await refresh()
      toast('Profile updated.', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-display-md font-display text-navy mb-8">Profile Settings</h1>

          <div className="bg-white rounded-2xl border border-grey-soft p-6 space-y-5">
            <div>
              <label className="field-label">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="field-input" placeholder="Your full name" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input value={user.email || ''} readOnly className="field-input opacity-60 cursor-not-allowed" />
              <p className="text-xs text-grey mt-1">Email cannot be changed here.</p>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
