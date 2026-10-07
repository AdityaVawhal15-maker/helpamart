import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { PhotoCropUpload } from '@/components/ui/PhotoCropUpload'
import { CATEGORIES } from '@/data/taxonomy'
import { getMentorProfile, updateMentorProfile } from '@/lib/mentor'

export default function MentorProfileEdit() {
  const { user, mentor, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

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
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/mentor-dashboard/profile'); return }
    if (!mentor) { navigate('/become-a-mentor'); return }

    setProfileLoading(true)
    getMentorProfile(mentor.id)
      .then((profile) => {
        if (profile) {
          setForm({
            fullName: profile.name ?? '',
            roleTitle: profile.role ?? '',
            company: profile.company ?? '',
            location: profile.location ?? '',
            intro: profile.intro ?? '',
            about: profile.about ?? '',
            linkedinUrl: profile.linkedinUrl ?? '',
            websiteUrl: profile.websiteUrl ?? '',
            photoUrl: profile.photoUrl ?? '',
            yearsExperience: profile.yearsExperience ?? 0,
            categories: profile.categories ?? [],
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load profile:', err)
        toast('Failed to load profile', 'error')
      })
      .finally(() => setProfileLoading(false))
  }, [user, mentor, authLoading, navigate, toast])

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
      if (!mentor) throw new Error('Not authenticated')
      await updateMentorProfile(mentor.id, {
        name: form.fullName,
        role: form.roleTitle,
        company: form.company,
        location: form.location,
        intro: form.intro,
        about: form.about,
        linkedinUrl: form.linkedinUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        photoUrl: form.photoUrl || undefined,
        yearsExperience: form.yearsExperience,
        categories: form.categories,
      })
      toast('Profile updated!', 'success')
    } catch (e: unknown) {
      console.error('Failed to update profile:', e)
      toast((e as Error).message || 'Could not save profile.', 'error')
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

          {profileLoading ? (
            <div className="bg-white rounded-2xl border border-grey-soft p-6">
              <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-grey-soft p-6 space-y-6">
            {/* Photo - Using PhotoCropUpload component */}
            <div>
              <label className="field-label">Profile Photo</label>
              <PhotoCropUpload
                currentPhotoUrl={form.photoUrl}
                photoInitials={form.fullName?.[0]?.toUpperCase() || '?'}
                onPhotoUploadSuccess={(url) => {
                  set('photoUrl', url)
                  toast('Photo updated.', 'success')
                }}
                disabled={saving}
              />
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
          )}
        </motion.div>
      </div>
    </div>
  )
}
