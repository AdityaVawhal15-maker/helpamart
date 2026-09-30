import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Star, Briefcase, Clock, Settings, Eye, Upload, Plus, Trash2,
  CheckCircle, ArrowRight, ArrowLeft, Loader2, Copy, Globe
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

// ─── Types ───────────────────────────────────────
type AvailRule = { weekday: number; startTime: string; endTime: string; enabled: boolean }
type Service = { title: string; description: string; durationMinutes: number; priceCents: number; currency: string; format: string }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FORMATS = ['online', 'in-person', 'both']

const STEPS = [
  { n: '01', label: 'Introduce', icon: <User className="h-4 w-4" /> },
  { n: '02', label: 'Expertise', icon: <Star className="h-4 w-4" /> },
  { n: '03', label: 'Experience', icon: <Briefcase className="h-4 w-4" /> },
  { n: '04', label: 'Availability', icon: <Clock className="h-4 w-4" /> },
  { n: '05', label: 'Services', icon: <Settings className="h-4 w-4" /> },
  { n: '06', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
  { n: '07', label: 'Publish', icon: <CheckCircle className="h-4 w-4" /> },
]

const DEFAULT_AVAIL: AvailRule[] = [
  { weekday: 1, startTime: '09:00', endTime: '17:00', enabled: true },
  { weekday: 2, startTime: '09:00', endTime: '17:00', enabled: true },
  { weekday: 3, startTime: '09:00', endTime: '17:00', enabled: true },
  { weekday: 4, startTime: '09:00', endTime: '17:00', enabled: true },
  { weekday: 5, startTime: '09:00', endTime: '17:00', enabled: true },
  { weekday: 6, startTime: '10:00', endTime: '14:00', enabled: false },
  { weekday: 0, startTime: '10:00', endTime: '14:00', enabled: false },
]

const DEFAULT_SERVICES: Service[] = [
  { title: '1:1 Mentorship', description: 'A focused session to work through your challenges.', durationMinutes: 45, priceCents: 0, currency: 'USD', format: 'online' },
]

const CATEGORIES = [
  'Career', 'Technology', 'AI & Machine Learning', 'Design', 'Business', 'Startups',
  'Education', 'Study Abroad', 'Finance', 'Leadership', 'Personal Growth', 'Interview Preparation', 'College', 'Skills', 'Life',
]

const SKILLS = [
  'Software Engineering', 'AI & ML', 'Product Management', 'Career Guidance', 'Design',
  'Startups', 'Finance', 'Study Abroad', 'Interview Preparation', 'Leadership', 'Research', 'Writing',
]

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Mandarin']

const SERVICE_TEMPLATES = [
  { title: '1:1 Mentorship', durationMinutes: 45 },
  { title: 'Career Guidance', durationMinutes: 30 },
  { title: 'Mock Interview', durationMinutes: 60 },
  { title: 'Portfolio Review', durationMinutes: 45 },
  { title: 'Resume Review', durationMinutes: 30 },
  { title: 'Technical Discussion', durationMinutes: 45 },
  { title: 'Startup Advice', durationMinutes: 45 },
]

export default function BecomeMentor() {
  const { user, mentor, refresh } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Form state
  const [photoUrl, setPhotoUrl] = useState(mentor?.photoUrl ?? '')
  const [fullName, setFullName] = useState(mentor?.name ?? user?.name ?? '')
  const [roleTitle, setRoleTitle] = useState(mentor?.role ?? '')
  const [company, setCompany] = useState(mentor?.company ?? '')
  const [location, setLocation] = useState(mentor?.location ?? '')
  const [intro, setIntro] = useState(mentor?.intro ?? '')
  const [languages, setLanguages] = useState<string[]>(mentor?.languages ?? ['English'])
  const [categories, setCategories] = useState<string[]>(mentor?.categories ?? [])
  const [skills, setSkills] = useState<string[]>(mentor?.skills ?? [])
  const [yearsExp, setYearsExp] = useState(mentor?.yearsExperience ?? 0)
  const [companies, setCompanies] = useState<string[]>(mentor?.companies ?? [])
  const [education, setEducation] = useState<string[]>(mentor?.education ?? [])
  const [achievements, setAchievements] = useState<string[]>(mentor?.achievements ?? [])
  const [about, setAbout] = useState(mentor?.about ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(mentor?.linkedinUrl ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(mentor?.websiteUrl ?? '')
  const [timezone, setTimezone] = useState(mentor?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [availability, setAvailability] = useState<AvailRule[]>(DEFAULT_AVAIL)
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ slug: string } | null>(null)

  if (!user) {
    navigate('/login?next=/become-a-mentor')
    return null
  }

  async function saveAndAdvance() {
    setSaving(true)
    try {
      await api('/api/mentor/me', {
        method: 'PUT',
        body: JSON.stringify({
          fullName, roleTitle, company, location, intro, about,
          photoUrl: photoUrl || null,
          languages, yearsExperience: yearsExp,
          linkedinUrl: linkedinUrl || null, websiteUrl: websiteUrl || null,
          companies, education, achievements, timezone,
          categories, skills,
          availability,
          services,
        }),
      })
      await refresh()
      setStep(s => Math.min(s + 1, STEPS.length - 1))
    } catch (err: unknown) {
      toast((err as Error).message || 'Could not save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      const res = await api<{ mentor: { slug: string } }>('/api/mentor/publish', { method: 'POST' })
      await refresh()
      setPublishResult({ slug: res.mentor.slug })
    } catch (err: unknown) {
      toast((err as Error).message || 'Could not publish. Ensure all required fields are filled.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  if (publishResult) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-gold" />
          </div>
          <h1 className="text-display-lg font-display text-navy mb-3">Your profile is live.</h1>
          <p className="text-grey mb-8">People can now discover you on HELPA and book sessions with you.</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/mentor/${publishResult.slug}`)}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all group"
            >
              View My Profile <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/mentor-dashboard')}
              className="w-full py-3 border border-grey-soft text-navy rounded-xl font-medium text-sm hover:border-gold/40 transition-colors"
            >
              Go to Mentor Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <div className="bg-ivory-light border-b border-grey-soft">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-display-md font-display text-navy mb-1">
            Your experience could <em style={{ fontStyle: 'italic', color: 'var(--color-gold)' }}>change someone's direction.</em>
          </h1>
          <p className="text-grey text-sm">Build your HELPA mentor profile in a few steps.</p>

          {/* Stepper */}
          <div className="flex items-center gap-0 mt-6 overflow-x-auto no-scrollbar pb-2">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center shrink-0">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    i === step
                      ? 'bg-navy text-white'
                      : i < step
                      ? 'text-gold cursor-pointer hover:bg-gold/10'
                      : 'text-grey cursor-default'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold shrink-0 border ${
                    i === step ? 'bg-white/20 border-white/30 text-white' :
                    i < step ? 'bg-gold border-gold text-white' :
                    'border-grey-soft text-grey'
                  }`}>{i < step ? '✓' : s.n}</span>
                  <span className="text-xs font-medium hidden sm:block">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px mx-1 ${i < step ? 'bg-gold' : 'bg-grey-soft'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className={`grid gap-10 ${step === 5 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && <StepIntroduce photoUrl={photoUrl} setPhotoUrl={setPhotoUrl} fullName={fullName} setFullName={setFullName} roleTitle={roleTitle} setRoleTitle={setRoleTitle} company={company} setCompany={setCompany} location={location} setLocation={setLocation} intro={intro} setIntro={setIntro} languages={languages} setLanguages={setLanguages} />}
              <StepExpertise categories={categories} setCategories={setCategories} skills={skills} setSkills={setSkills} />
              {step === 2 && <StepExperience yearsExp={yearsExp} setYearsExp={setYearsExp} companies={companies} setCompanies={setCompanies} education={education} setEducation={setEducation} achievements={achievements} setAchievements={setAchievements} about={about} setAbout={setAbout} linkedinUrl={linkedinUrl} setLinkedinUrl={setLinkedinUrl} websiteUrl={websiteUrl} setWebsiteUrl={setWebsiteUrl} />}
              {step === 3 && <StepAvailability timezone={timezone} setTimezone={setTimezone} availability={availability} setAvailability={setAvailability} />}
              {step === 4 && <StepServices services={services} setServices={setServices} />}
              {step === 5 && (
                <div>
                  <h2 className="text-xl font-display text-navy mb-2">Looking good.</h2>
                  <p className="text-grey text-sm mb-4">This is how your profile will appear to people discovering you on HELPA.</p>
                  <div className="lg:hidden mb-4">
                    <button onClick={() => setShowPreview(v => !v)} className="pill">
                      {showPreview ? 'Edit' : 'Preview'}
                    </button>
                  </div>
                </div>
              )}
              {step === 6 && (
                <StepPublish
                  fullName={fullName}
                  photoUrl={photoUrl}
                  intro={intro}
                  categories={categories}
                  services={services}
                  availability={availability}
                  publishing={publishing}
                  onPublish={handlePublish}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Live preview (step 5 only) */}
          {step === 5 && (
            <div className="hidden lg:block">
              <div className="sticky top-6">
                <p className="text-xs font-bold tracking-widest text-grey uppercase mb-4">Live Preview</p>
                <ProfilePreviewCard
                  fullName={fullName}
                  photoUrl={photoUrl}
                  roleTitle={roleTitle}
                  company={company}
                  intro={intro}
                  categories={categories}
                  skills={skills}
                  services={services}
                  languages={languages}
                  yearsExp={yearsExp}
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-10 pt-6 border-t border-grey-soft max-w-2xl">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 border border-grey-soft rounded-xl text-navy text-sm font-medium disabled:opacity-30 hover:border-navy/30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={step === STEPS.length - 2 ? saveAndAdvance : saveAndAdvance}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all disabled:opacity-60"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Save & Continue <ArrowRight className="h-4 w-4" /></>}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepIntroduce({ photoUrl, setPhotoUrl, fullName, setFullName, roleTitle, setRoleTitle, company, setCompany, location, setLocation, intro, setIntro, languages, setLanguages }: {
  photoUrl: string; setPhotoUrl: (v: string) => void
  fullName: string; setFullName: (v: string) => void
  roleTitle: string; setRoleTitle: (v: string) => void
  company: string; setCompany: (v: string) => void
  location: string; setLocation: (v: string) => void
  intro: string; setIntro: (v: string) => void
  languages: string[]; setLanguages: (v: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const res = await api<{ url: string }>('/api/uploads/photo', { method: 'POST', body: fd })
      setPhotoUrl(res.url)
      toast('Photo uploaded!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <StepHeader n="01" title="Introduce yourself" sub="Your photo and bio are the first thing mentees see." />

      {/* Photo */}
      <div>
        <label className="field-label">Profile Photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-ivory-dark overflow-hidden shrink-0">
            {photoUrl
              ? <img src={photoUrl} className="w-full h-full object-cover" alt="Profile" />
              : <div className="w-full h-full flex items-center justify-center text-grey-mid text-3xl font-display">{fullName?.[0] || '?'}</div>
            }
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-grey-soft rounded-xl text-sm text-navy font-medium hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <p className="text-xs text-grey mt-1.5">JPG, PNG or WebP · Max 4MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full Name *" value={fullName} onChange={setFullName} placeholder="Your name" />
        <FormField label="Current Role / Title *" value={roleTitle} onChange={setRoleTitle} placeholder="e.g. Senior Engineer at Google" />
        <FormField label="Company" value={company} onChange={setCompany} placeholder="Company name" />
        <FormField label="Location" value={location} onChange={setLocation} placeholder="e.g. Mumbai, India" />
      </div>

      <div>
        <label className="field-label">Short Introduction * <span className="text-grey font-normal">(shown on your card)</span></label>
        <textarea
          value={intro}
          onChange={e => setIntro(e.target.value)}
          placeholder="One powerful sentence about how you help people."
          className="field-input field-textarea"
          rows={3}
        />
        <p className="text-xs text-grey mt-1">{intro.length}/200 characters</p>
      </div>

      <div>
        <label className="field-label">Languages you mentor in</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguages(languages.includes(lang) ? languages.filter(l => l !== lang) : [...languages, lang])}
              className={`pill text-xs ${languages.includes(lang) ? 'pill-active' : ''}`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepExpertise({ categories, setCategories, skills, setSkills }: {
  categories: string[]; setCategories: (v: string[]) => void
  skills: string[]; setSkills: (v: string[]) => void
}) {
  const toggle = (arr: string[], item: string, set: (v: string[]) => void) => {
    set(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item])
  }
  return (
    <div className="space-y-8">
      <StepHeader n="02" title="Your expertise" sub="What areas can you genuinely help with?" />
      <div>
        <label className="field-label">Categories *</label>
        <p className="text-xs text-grey mb-3">Select all that apply.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => toggle(categories, c, setCategories)}
              className={`pill text-xs ${categories.includes(c) ? 'pill-active' : ''}`}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Specific Skills</label>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map(s => (
            <button key={s} type="button" onClick={() => toggle(skills, s, setSkills)}
              className={`pill text-xs ${skills.includes(s) ? 'pill-active' : ''}`}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepExperience({ yearsExp, setYearsExp, companies, setCompanies, education, setEducation, achievements, setAchievements, about, setAbout, linkedinUrl, setLinkedinUrl, websiteUrl, setWebsiteUrl }: {
  yearsExp: number; setYearsExp: (v: number) => void
  companies: string[]; setCompanies: (v: string[]) => void
  education: string[]; setEducation: (v: string[]) => void
  achievements: string[]; setAchievements: (v: string[]) => void
  about: string; setAbout: (v: string) => void
  linkedinUrl: string; setLinkedinUrl: (v: string) => void
  websiteUrl: string; setWebsiteUrl: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <StepHeader n="03" title="Your experience" sub="Help mentees understand your background." />
      <div>
        <label className="field-label">Years of Experience</label>
        <input type="number" min={0} max={50} value={yearsExp} onChange={e => setYearsExp(Number(e.target.value))} className="field-input w-32" />
      </div>
      <ListField label="Companies / Organizations" values={companies} setValues={setCompanies} placeholder="e.g. Google, Startup X" />
      <ListField label="Education" values={education} setValues={setEducation} placeholder="e.g. B.Tech, IIT Delhi" />
      <ListField label="Achievements" values={achievements} setValues={setAchievements} placeholder="e.g. Forbes 30 Under 30" />
      <div>
        <label className="field-label">About <span className="text-grey font-normal">(longer bio)</span></label>
        <textarea value={about} onChange={e => setAbout(e.target.value)} placeholder="Tell mentees your story, what you've learned, and why you mentor." className="field-input field-textarea" rows={5} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="LinkedIn URL" value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/…" type="url" />
        <FormField label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://yoursite.com" type="url" />
      </div>
    </div>
  )
}

function StepAvailability({ timezone, setTimezone, availability, setAvailability }: {
  timezone: string; setTimezone: (v: string) => void
  availability: AvailRule[]; setAvailability: (v: AvailRule[]) => void
}) {
  function updateDay(weekday: number, key: keyof AvailRule, value: unknown) {
    setAvailability(availability.map(r => r.weekday === weekday ? { ...r, [key]: value } : r))
  }
  function copyToAll(weekday: number) {
    const src = availability.find(r => r.weekday === weekday)
    if (!src) return
    setAvailability(availability.map(r => r.enabled ? { ...r, startTime: src.startTime, endTime: src.endTime } : r))
  }

  return (
    <div className="space-y-6">
      <StepHeader n="04" title="Your availability" sub="When are you available for sessions?" />

      <div>
        <label className="field-label flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-gold" />Timezone</label>
        <select value={timezone} onChange={e => setTimezone(e.target.value)} className="field-input">
          {Intl.supportedValuesOf('timeZone').map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {availability.map(rule => (
          <div key={rule.weekday} className={`avail-day-card ${rule.enabled ? 'avail-day-card-active' : ''}`}>
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <div
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${rule.enabled ? 'bg-navy' : 'bg-grey-soft'}`}
                  onClick={() => updateDay(rule.weekday, 'enabled', !rule.enabled)}
                  role="switch"
                  aria-checked={rule.enabled}
                  tabIndex={0}
                  onKeyDown={e => e.key === ' ' && updateDay(rule.weekday, 'enabled', !rule.enabled)}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className={`font-medium text-sm w-24 ${rule.enabled ? 'text-navy' : 'text-grey'}`}>
                  {DAYS[rule.weekday]}
                </span>
              </label>

              {rule.enabled && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="time" value={rule.startTime} onChange={e => updateDay(rule.weekday, 'startTime', e.target.value)} className="field-input w-auto text-sm py-1.5 px-2" />
                  <span className="text-grey text-sm">–</span>
                  <input type="time" value={rule.endTime} onChange={e => updateDay(rule.weekday, 'endTime', e.target.value)} className="field-input w-auto text-sm py-1.5 px-2" />
                  <button
                    type="button"
                    onClick={() => copyToAll(rule.weekday)}
                    title="Copy times to all enabled days"
                    className="text-grey hover:text-gold transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepServices({ services, setServices }: { services: Service[]; setServices: (v: Service[]) => void }) {
  function add() {
    setServices([...services, { title: '', description: '', durationMinutes: 45, priceCents: 0, currency: 'USD', format: 'online' }])
  }
  function remove(i: number) {
    setServices(services.filter((_, j) => j !== i))
  }
  function update(i: number, key: keyof Service, value: unknown) {
    setServices(services.map((s, j) => j === i ? { ...s, [key]: value } : s))
  }
  function addTemplate(t: { title: string; durationMinutes: number }) {
    setServices([...services, { title: t.title, description: '', durationMinutes: t.durationMinutes, priceCents: 0, currency: 'USD', format: 'online' }])
  }

  return (
    <div className="space-y-6">
      <StepHeader n="05" title="Your services" sub="What types of sessions do you offer?" />

      {/* Templates */}
      <div>
        <p className="field-label mb-2">Quick add from templates</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_TEMPLATES.map(t => (
            <button key={t.title} type="button" onClick={() => addTemplate(t)}
              className="pill text-xs flex items-center gap-1">
              <Plus className="h-3 w-3" />{t.title}
            </button>
          ))}
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-4">
        {services.map((s, i) => (
          <div key={i} className="bg-white border border-grey-soft rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start gap-2">
              <FormField label="Title *" value={s.title} onChange={v => update(i, 'title', v)} placeholder="e.g. 1:1 Mentorship Session" className="flex-1" />
              <button onClick={() => remove(i)} className="text-grey hover:text-maroon transition-colors mt-6 shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea value={s.description} onChange={e => update(i, 'description', e.target.value)} className="field-input field-textarea" rows={2} placeholder="What will you cover in this session?" />
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
                  {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Format</label>
                <select value={s.format} onChange={e => update(i, 'format', e.target.value)} className="field-input">
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={add}
        className="flex items-center gap-2 px-5 py-3 border-2 border-dashed border-grey-soft rounded-xl text-sm text-grey hover:border-gold hover:text-gold transition-colors w-full justify-center">
        <Plus className="h-4 w-4" /> Add another service
      </button>
    </div>
  )
}

function StepPublish({ fullName, photoUrl, intro, categories, services, availability, publishing, onPublish }: {
  fullName: string; photoUrl: string; intro: string; categories: string[]
  services: Service[]; availability: AvailRule[]; publishing: boolean; onPublish: () => void
}) {
  const checks = [
    { label: 'Name & photo', done: Boolean(fullName && photoUrl) },
    { label: 'Introduction', done: Boolean(intro) },
    { label: 'Categories', done: categories.length > 0 },
    { label: 'Availability', done: availability.some(r => r.enabled) },
    { label: 'Services', done: services.some(s => s.title) },
  ]
  const ready = checks.every(c => c.done)

  return (
    <div className="space-y-8">
      <StepHeader n="07" title="Ready to publish?" sub="Your profile goes live when you click publish." />

      <div className="bg-white border border-grey-soft rounded-2xl p-6 space-y-3">
        <p className="text-sm font-semibold text-navy mb-4">Profile checklist</p>
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${c.done ? 'bg-gold/15 text-gold' : 'bg-grey-soft text-grey'}`}>
              {c.done ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="w-2 h-2 rounded-full bg-grey-mid" />}
            </div>
            <span className={`text-sm ${c.done ? 'text-navy' : 'text-grey'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      {!ready && (
        <div className="bg-maroon/5 border border-maroon/15 rounded-xl p-4">
          <p className="text-sm text-maroon">Please complete all required fields before publishing.</p>
        </div>
      )}

      {ready && (
        <div className="bg-gold/8 border border-gold/20 rounded-xl p-4">
          <p className="text-sm text-navy/80">Your profile is ready to go live on HELPA.</p>
        </div>
      )}

      <button
        onClick={onPublish}
        disabled={!ready || publishing}
        className="w-full py-4 bg-gold text-white rounded-xl font-semibold hover:bg-gold-mid transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-[0_6px_24px_rgba(183,122,34,0.3)]"
      >
        {publishing ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <>Publish My HELPA Profile <ArrowRight className="h-4 w-4" /></>}
      </button>
    </div>
  )
}

// ─── Reusable helpers ─────────────────────────────────────────────────────────

function StepHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-2">
      <span className="text-xs font-bold tracking-widest text-gold uppercase">Step {n}</span>
      <h2 className="text-xl font-display text-navy mt-1">{title}</h2>
      <p className="text-sm text-grey mt-1">{sub}</p>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text', className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="field-input" />
    </div>
  )
}

function ListField({ label, values, setValues, placeholder }: {
  label: string; values: string[]; setValues: (v: string[]) => void; placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  function add() {
    if (!draft.trim()) return
    setValues([...values, draft.trim()])
    setDraft('')
  }
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex gap-2 mb-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={placeholder} className="field-input flex-1 text-sm" />
        <button type="button" onClick={add} className="px-4 py-2 bg-ivory-dark rounded-xl text-sm font-medium text-navy hover:bg-grey-soft transition-colors shrink-0">Add</button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-ivory-dark rounded-full text-sm text-navy">
              {v}
              <button onClick={() => setValues(values.filter((_, j) => j !== i))} className="text-grey hover:text-maroon transition-colors">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ProfilePreviewCard({ fullName, photoUrl, roleTitle, company, intro, categories, skills, services, languages, yearsExp }: {
  fullName: string; photoUrl: string; roleTitle: string; company: string; intro: string
  categories: string[]; skills: string[]; services: { title: string; durationMinutes: number; priceCents: number }[]
  languages: string[]; yearsExp: number
}) {
  const lowestPrice = services.reduce((min, s) => s.priceCents < min ? s.priceCents : min, Infinity)

  return (
    <div className="bg-white rounded-2xl border border-grey-soft overflow-hidden shadow-soft">
      {/* Header */}
      <div className="h-24 bg-gradient-to-br from-ivory-dark to-grey-soft relative">
        <div className="absolute bottom-0 left-6 translate-y-1/2">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-white shadow-soft">
            {photoUrl
              ? <img src={photoUrl} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full bg-ivory-dark flex items-center justify-center text-xl font-display text-grey">{fullName?.[0] || '?'}</div>
            }
          </div>
        </div>
      </div>

      <div className="pt-12 px-6 pb-6">
        <h3 className="font-semibold text-navy text-lg">{fullName || 'Your Name'}</h3>
        <p className="text-grey text-sm">{roleTitle || 'Your Role'}{company ? ` · ${company}` : ''}</p>
        {intro && <p className="text-sm text-navy/70 mt-3 leading-snug line-clamp-2">{intro}</p>}
        {yearsExp > 0 && <p className="text-xs text-grey mt-2">{yearsExp}+ years experience</p>}
        {languages.length > 0 && <p className="text-xs text-grey mt-1">{languages.join(' · ')}</p>}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {categories.slice(0, 3).map(c => (
              <span key={c} className="pill text-[0.6875rem] py-0.5 px-2">{c}</span>
            ))}
          </div>
        )}

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {skills.slice(0, 4).map(s => (
              <span key={s} className="bg-sand/60 text-navy/70 text-[0.6875rem] py-0.5 px-2 rounded-full font-medium">{s}</span>
            ))}
          </div>
        )}

        {services.length > 0 && (
          <div className="mt-4 pt-4 border-t border-grey-soft flex items-center justify-between">
            <span className="text-xs text-grey">
              {services.length} session type{services.length !== 1 ? 's' : ''}
            </span>
            {lowestPrice !== Infinity && (
              <span className="text-sm font-semibold text-gold">
                {lowestPrice === 0 ? 'Free' : `From $${(lowestPrice / 100).toFixed(0)}`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
