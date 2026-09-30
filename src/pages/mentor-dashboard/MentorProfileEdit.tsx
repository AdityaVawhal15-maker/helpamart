import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { CATEGORIES } from '@/data/taxonomy'

export default function MentorProfileEdit() {
  const { user, mentor, refresh } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    fullName: mentor?.name ?? '',
    roleTitle: mentor?.role ?? '',
    company: mentor?.company ?? '',
    location: mentor?.location ?? '',
    intro: mentor?.intro ?? '',
    about: mentor?.about ?? '',
    linkedinUrl: mentor?.linkedinUrl ?? '',
    websiteUrl: mentor?.websiteUrl ?? '',
    photoUrl: mentor?.photoUrl ?? '',
    yearsExperience: mentor?.yearsExperience ?? 0,
    categories: mentor?.categories ?? [] as string[],
    languages: mentor?.languages ?? ['English'],
  })

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!mentor) { navigate('/become-a-mentor'); return }
  }, [user, mentor])

  function set(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleCategory(cat: string) {
    set('categories', form.categories.includes(cat)
      ? form.categories.filter(c => c !== cat)
      : [...form.categories, cat])
  }

  async function save() {
    setSaving(true)
    try {
      await api('/api/mentor/me', { method: 'PUT', body: JSON.stringify(form) })
      await refresh()
      toast('Profile updated!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!user || !mentor) return null

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-display-md font-display text-navy mb-8">Edit Profile</h1>

          <div className="bg-white rounded-2xl border border-grey-soft p-6 space-y-6">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-ivory-dark">
                {form.photoUrl
                  ? <img src={form.photoUrl} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full flex items-center justify-center text-grey text-3xl font-display">{form.fullName?.[0] || '?'}</div>
                }
              </div>
              <div>
                <label className="field-label">Photo URL</label>
                <input value={form.photoUrl} onChange={e => set('photoUrl', e.target.value)} className="field-input text-sm" placeholder="https://…" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="field-label">Full Name</label><input value={form.fullName} onChange={e => set('fullName', e.target.value)} className="field-input" /></div>
              <div><label className="field-label">Role/Title</label><input value={form.roleTitle} onChange={e => set('roleTitle', e.target.value)} className="field-input" /></div>
              <div><label className="field-label">Company</label><input value={form.company} onChange={e => set('company', e.target.value)} className="field-input" /></div>
              <div><label className="field-label">Location</label><input value={form.location} onChange={e => set('location', e.target.value)} className="field-input" /></div>
              <div><label className="field-label">Years Experience</label><input type="number" min={0} value={form.yearsExperience} onChange={e => set('yearsExperience', Number(e.target.value))} className="field-input" /></div>
            </div>

            <div>
              <label className="field-label">Short Introduction</label>
              <textarea value={form.intro} onChange={e => set('intro', e.target.value)} className="field-input field-textarea" rows={2} />
            </div>
            <div>
              <label className="field-label">About</label>
              <textarea value={form.about} onChange={e => set('about', e.target.value)} className="field-input field-textarea" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="field-label">LinkedIn</label><input value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} className="field-input" type="url" /></div>
              <div><label className="field-label">Website</label><input value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} className="field-input" type="url" /></div>
            </div>

            <div>
              <label className="field-label">Categories</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleCategory(c)}
                    className={`pill text-xs ${form.categories.includes(c) ? 'pill-active' : ''}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-navy-mid transition-all"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
