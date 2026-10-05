import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Star, Briefcase, Clock, Settings, Eye, Upload, Plus, Trash2,
  CheckCircle, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Copy, Globe,
  Sparkles, MapPin, ExternalLink, Linkedin, Check
} from 'lucide-react'
import { api } from '@/lib/api'
import { uploadProfilePhoto } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

const ease = [0.16, 1, 0.3, 1] as const

// ─── Types ───────────────────────────────────────
type AvailRule = { weekday: number; startTime: string; endTime: string; enabled: boolean }
type Service = {
  title: string
  description: string
  durationMinutes: number
  priceCents: number
  currency: string
  format: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FORMATS = [
  { value: 'online', label: 'Online (Video Call)' },
  { value: 'in-person', label: 'In-person' },
  { value: 'both', label: 'Online & In-person' },
]

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
  {
    title: '1:1 Mentorship',
    description: 'A focused session to work through your challenges, career crossroads, and next steps.',
    durationMinutes: 45,
    priceCents: 9900, // ₹99 in INR
    currency: 'INR',
    format: 'online',
  },
]

const BASE_CATEGORIES = [
  'Career', 'Technology', 'AI & Machine Learning', 'Design', 'Business', 'Startups',
  'Education', 'Study Abroad', 'Finance', 'Leadership', 'Personal Growth', 'Interview Preparation',
  'College', 'Skills', 'Life', 'Research', 'Product Management', 'Entrepreneurship',
  'Content & Writing', 'Data Science', 'Cybersecurity', 'Cloud & DevOps', 'Marketing', 'Public Speaking',
]

const BASE_SKILLS = [
  'Software Engineering', 'AI & ML', 'Data Science', 'Web Development', 'Mobile Development',
  'Product Management', 'Career Guidance', 'Design', 'Startups', 'Finance',
  'Study Abroad', 'Interview Preparation', 'Leadership', 'Research', 'Writing',
  'Public Speaking', 'Cloud & DevOps', 'Cybersecurity', 'Python', 'JavaScript',
  'React', 'Machine Learning', 'System Design', 'Resume Teardown', 'Negotiation',
]

const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Mandarin',
  'Marathi', 'Gujarati', 'Punjabi', 'Marwadi', 'Kannada', 'Tamil', 'Telugu',
]

const SERVICE_TEMPLATES = [
  {
    title: '1:1 Mentorship',
    durationMinutes: 45,
    defaultPrice: 99,
    description: 'A focused session to work through your challenges, clarify your direction, and plan next steps.',
  },
  {
    title: 'Career Guidance',
    durationMinutes: 30,
    defaultPrice: 99,
    description: 'Honest perspective on career transitions, industry realities, and promotion pathways.',
  },
  {
    title: 'Mock Interview',
    durationMinutes: 60,
    defaultPrice: 299,
    description: 'Realistic mock interview with real-time feedback on your answers, structure, and delivery.',
  },
  {
    title: 'Portfolio Review',
    durationMinutes: 45,
    defaultPrice: 199,
    description: 'Detailed case study and portfolio teardown from a working professional.',
  },
  {
    title: 'Resume Review',
    durationMinutes: 30,
    defaultPrice: 99,
    description: 'Actionable feedback to make your resume stand out to recruiters and hiring managers.',
  },
  {
    title: 'Technical Discussion',
    durationMinutes: 45,
    defaultPrice: 199,
    description: 'Deep dive into architecture, coding roadblocks, system design, or tech stack decisions.',
  },
  {
    title: 'Startup Advice',
    durationMinutes: 45,
    defaultPrice: 299,
    description: 'Practical feedback on MVP scoping, early traction, and turning ideas into real products.',
  },
  {
    title: 'Project Guidance',
    durationMinutes: 45,
    defaultPrice: 149,
    description: 'Hands-on feedback on your ongoing project, architecture, code quality, and deployment.',
  },
  {
    title: 'AI / ML Guidance',
    durationMinutes: 45,
    defaultPrice: 249,
    description: 'Advice on learning pathways, model evaluation, and building real-world AI applications.',
  },
]

export function formatPrice(priceCents: number, currency: string = 'INR') {
  if (priceCents === 0) return 'Free'
  const amount = Math.round(priceCents / 100)
  if (currency === 'INR') return `₹${amount}`
  if (currency === 'USD') return `$${amount}`
  if (currency === 'EUR') return `€${amount}`
  if (currency === 'GBP') return `£${amount}`
  return `${currency} ${amount}`
}

export default function BecomeMentor() {
  const { user, mentor, loading: authLoading, refresh, saveMentorProfile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

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

  // Sync state when mentor data becomes available (e.g. returning mentor)
  useEffect(() => {
    if (mentor) {
      if (mentor.photoUrl) setPhotoUrl(mentor.photoUrl)
      if (mentor.name) setFullName(mentor.name)
      if (mentor.role) setRoleTitle(mentor.role)
      if (mentor.company) setCompany(mentor.company)
      if (mentor.location) setLocation(mentor.location)
      if (mentor.intro) setIntro(mentor.intro)
      if (mentor.about) setAbout(mentor.about)
      if (mentor.languages?.length) setLanguages(mentor.languages)
      if (mentor.categories?.length) setCategories(mentor.categories)
      if (mentor.skills?.length) setSkills(mentor.skills)
      if (mentor.yearsExperience != null) setYearsExp(mentor.yearsExperience)
      if (mentor.companies?.length) setCompanies(mentor.companies)
      if (mentor.education?.length) setEducation(mentor.education)
      if (mentor.achievements?.length) setAchievements(mentor.achievements)
      if (mentor.linkedinUrl) setLinkedinUrl(mentor.linkedinUrl)
      if (mentor.websiteUrl) setWebsiteUrl(mentor.websiteUrl)
      if (mentor.timezone) setTimezone(mentor.timezone)
      if (Array.isArray(mentor.availability) && mentor.availability.length > 0) {
        setAvailability(mentor.availability)
      }
      if (mentor.services?.length) {
        setServices(
          mentor.services.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description || '',
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
            currency: s.currency,
            format: s.format,
          }))
        )
      }
    } else if (user?.name && !fullName) {
      setFullName(user.name)
    }
  }, [mentor, user])

  // ─── Critical Scroll Bug Fix ──────────────────────────────────────────────
  // Whenever the active step changes, ALWAYS scroll immediately and smoothly to the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?next=/become-a-mentor')
    }
  }, [authLoading, user, navigate])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  async function saveAndAdvance() {
    // Step validation
    if (step === 0) {
      if (!fullName.trim() || !roleTitle.trim() || !intro.trim()) {
        toast('Please fill in your name, current role, and a short introduction.', 'error')
        return
      }
    } else if (step === 1) {
      if (categories.length === 0) {
        toast('Please select at least one category of expertise.', 'error')
        return
      }
    } else if (step === 3) {
      if (!availability.some(r => r.enabled)) {
        toast('Please enable at least one day for your session availability.', 'error')
        return
      }
    } else if (step === 4) {
      if (services.length === 0 || !services.some(s => s.title.trim())) {
        toast('Please add at least one service with a title.', 'error')
        return
      }
    }

    setSaving(true)
    try {
      await saveMentorProfile({
        name: fullName,
        role: roleTitle,
        company,
        location,
        intro,
        about,
        photoUrl: photoUrl || null,
        languages,
        yearsExperience: yearsExp,
        linkedinUrl: linkedinUrl || null,
        websiteUrl: websiteUrl || null,
        companies,
        education,
        achievements,
        timezone,
        categories,
        skills,
        availability,
        services: services.map((s) => ({
          title: s.title,
          description: s.description || '',
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          currency: s.currency,
          format: s.format,
        })),
      })
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
      } catch {}
      await refresh()
      setStep(s => Math.min(s + 1, STEPS.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      toast((err as Error).message || 'Could not save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      const saved = await saveMentorProfile({ status: 'published' })
      let slug = saved.slug
      try {
        const res = await api<{ mentor: { slug: string } }>('/api/mentor/publish', { method: 'POST' })
        if (res?.mentor?.slug) slug = res.mentor.slug
      } catch {}
      await refresh()
      setPublishResult({ slug })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      toast((err as Error).message || 'Could not publish. Ensure all required fields are filled.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  // ─── 26. Celebrate Success State ──────────────────────────────────────────
  if (publishResult) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center bg-white rounded-3xl p-8 sm:p-10 border border-grey-soft shadow-card"
        >
          <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-gold" />
          </div>
          <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-2">Welcome to HELPAMART</p>
          <h1 className="text-display-lg font-display text-navy mb-3">You're officially a HELPAMART mentor.</h1>
          <p className="text-grey text-sm mb-8 leading-relaxed">
            Your experience is now ready to help someone take their next step. People can discover your profile and book sessions with you based on your availability.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/mentor/${publishResult.slug}`)}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all group cursor-pointer"
            >
              <span>View My Mentor Profile</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/mentor-dashboard')}
              className="w-full py-3 border border-grey-soft text-navy rounded-xl font-medium text-sm hover:border-gold/40 hover:bg-ivory-light transition-colors cursor-pointer"
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
      {/* ─── Header & Progress Navigation ─────────────────────────────────── */}
      <div className="bg-ivory-light border-b border-grey-soft sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-gold uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                Become a Mentor
              </p>
              <h1 className="text-xl sm:text-2xl font-display text-navy mt-0.5">
                Your experience could <em style={{ fontStyle: 'italic', color: 'var(--color-gold)' }}>change someone's direction.</em>
              </h1>
            </div>

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-navy/5 text-navy self-start sm:self-center border border-navy/10">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-0 mt-5 overflow-x-auto no-scrollbar pb-1">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                    i === step
                      ? 'bg-navy text-white shadow-xs'
                      : i < step
                      ? 'text-gold cursor-pointer hover:bg-gold/10'
                      : 'text-grey/60 cursor-default'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold shrink-0 border ${
                      i === step
                        ? 'bg-white/20 border-white/30 text-white'
                        : i < step
                        ? 'bg-gold border-gold text-white'
                        : 'border-grey-soft text-grey/60 bg-white'
                    }`}
                  >
                    {i < step ? '✓' : s.n}
                  </span>
                  <span className="text-xs font-medium hidden md:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 sm:w-8 h-px mx-1 ${i < step ? 'bg-gold' : 'bg-grey-soft'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main Step Content ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease }}
            >
              {/* STEP 01: INTRODUCE ONLY */}
              {step === 0 && (
                <StepIntroduce
                  photoUrl={photoUrl}
                  setPhotoUrl={setPhotoUrl}
                  fullName={fullName}
                  setFullName={setFullName}
                  roleTitle={roleTitle}
                  setRoleTitle={setRoleTitle}
                  company={company}
                  setCompany={setCompany}
                  location={location}
                  setLocation={setLocation}
                  intro={intro}
                  setIntro={setIntro}
                  languages={languages}
                  setLanguages={setLanguages}
                />
              )}

              {/* STEP 02: EXPERTISE ONLY */}
              {step === 1 && (
                <StepExpertise
                  categories={categories}
                  setCategories={setCategories}
                  skills={skills}
                  setSkills={setSkills}
                />
              )}

              {/* STEP 03: EXPERIENCE ONLY */}
              {step === 2 && (
                <StepExperience
                  yearsExp={yearsExp}
                  setYearsExp={setYearsExp}
                  companies={companies}
                  setCompanies={setCompanies}
                  education={education}
                  setEducation={setEducation}
                  achievements={achievements}
                  setAchievements={setAchievements}
                  about={about}
                  setAbout={setAbout}
                  linkedinUrl={linkedinUrl}
                  setLinkedinUrl={setLinkedinUrl}
                  websiteUrl={websiteUrl}
                  setWebsiteUrl={setWebsiteUrl}
                />
              )}

              {/* STEP 04: AVAILABILITY ONLY */}
              {step === 3 && (
                <StepAvailability
                  timezone={timezone}
                  setTimezone={setTimezone}
                  availability={availability}
                  setAvailability={setAvailability}
                />
              )}

              {/* STEP 05: SERVICES ONLY */}
              {step === 4 && (
                <StepServices
                  services={services}
                  setServices={setServices}
                />
              )}

              {/* STEP 06: PREVIEW ONLY */}
              {step === 5 && (
                <StepPreview
                  fullName={fullName}
                  photoUrl={photoUrl}
                  roleTitle={roleTitle}
                  company={company}
                  location={location}
                  intro={intro}
                  about={about}
                  categories={categories}
                  skills={skills}
                  yearsExp={yearsExp}
                  companies={companies}
                  education={education}
                  achievements={achievements}
                  languages={languages}
                  services={services}
                  availability={availability}
                  timezone={timezone}
                  linkedinUrl={linkedinUrl}
                  websiteUrl={websiteUrl}
                />
              )}

              {/* STEP 07: PUBLISH ONLY */}
              {step === 6 && (
                <StepPublish
                  fullName={fullName}
                  photoUrl={photoUrl}
                  roleTitle={roleTitle}
                  intro={intro}
                  categories={categories}
                  skills={skills}
                  services={services}
                  availability={availability}
                  publishing={publishing}
                  onPublish={handlePublish}
                  onBack={() => setStep(5)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls (Steps 0-5) */}
          {step < STEPS.length - 1 && (
            <div className="flex justify-between items-center mt-12 pt-6 border-t border-grey-soft">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 px-5 py-2.5 border border-grey-soft rounded-xl text-navy text-sm font-medium disabled:opacity-30 hover:border-navy/30 hover:bg-white transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <button
                type="button"
                onClick={saveAndAdvance}
                disabled={saving}
                className="flex items-center gap-2 px-7 py-3 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all hover:shadow-card disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Save & Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── STEP 01: INTRODUCE YOURSELF ──────────────────────────────────────────────
function StepIntroduce({
  photoUrl, setPhotoUrl, fullName, setFullName, roleTitle, setRoleTitle,
  company, setCompany, location, setLocation, intro, setIntro, languages, setLanguages
}: {
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
  const { user } = useAuth()

  // Custom "Other" language handling
  const [otherActive, setOtherActive] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [inputError, setInputError] = useState('')

  const handleToggleOther = () => {
    if (otherActive) {
      setOtherActive(false)
      setCustomInput('')
      setInputError('')
    } else {
      setOtherActive(true)
    }
  }

  const handleAddCustomLanguage = () => {
    const clean = customInput.trim()
    if (!clean) {
      setInputError('Please enter a language.')
      toast('Please enter a language.', 'error')
      return
    }

    const alreadyExists = languages.some(
      l => l.toLowerCase() === clean.toLowerCase()
    ) || LANGUAGES.some(
      l => l.toLowerCase() === clean.toLowerCase()
    )

    if (alreadyExists) {
      setInputError('This language has already been added.')
      toast('This language has already been added.', 'error')
      return
    }

    setLanguages([...languages, clean])
    setCustomInput('')
    setInputError('')
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      // Use Supabase Storage for permanent cross-session URLs.
      // Falls back to a blob URL (session-only) if Storage is unavailable.
      const userId = user?.id || `anon-${Date.now()}`
      const url = await uploadProfilePhoto(file, userId)
      setPhotoUrl(url)
      toast('Photo uploaded!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <StepHeader
        n="01"
        title="Introduce yourself"
        sub="Your photo and bio are the first thing mentees see."
      />

      {/* Profile Photo */}
      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label mb-2">Profile Photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-ivory-dark overflow-hidden shrink-0 border border-grey-soft flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <div className="text-grey-mid text-3xl font-display">{fullName?.[0] || '?'}</div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-grey-soft rounded-xl text-sm text-navy font-medium hover:border-gold/40 hover:bg-ivory-light transition-colors disabled:opacity-50 cursor-pointer"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <p className="text-xs text-grey mt-1.5">JPG, PNG or WebP · Max 4MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) uploadPhoto(f)
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full Name *" value={fullName} onChange={setFullName} placeholder="Your name" />
        <FormField label="Current Role / Title *" value={roleTitle} onChange={setRoleTitle} placeholder="e.g. Senior Software Engineer" />
        <FormField label="Company / Organization" value={company} onChange={setCompany} placeholder="e.g. Google, Flipkart, or Independent" />
        <FormField label="Location" value={location} onChange={setLocation} placeholder="e.g. Bengaluru, India" />
      </div>

      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label">Short Introduction * <span className="text-grey font-normal">(shown on your mentor card)</span></label>
        <textarea
          value={intro}
          onChange={e => setIntro(e.target.value)}
          placeholder="One powerful sentence about how you help people navigate their journey."
          className="field-input field-textarea mt-1"
          rows={3}
          maxLength={200}
        />
        <div className="flex justify-between items-center mt-1 text-xs text-grey">
          <span>Keep it concise and approachable.</span>
          <span>{intro.length}/200 characters</span>
        </div>
      </div>

      {/* Languages mentored in (MUST stay on Step 01) */}
      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label mb-2">Languages you mentor in</label>
        <p className="text-xs text-grey mb-3">Select the languages you feel comfortable having conversations in.</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              type="button"
              onClick={() =>
                setLanguages(
                  languages.includes(lang)
                    ? languages.filter(l => l !== lang)
                    : [...languages, lang]
                )
              }
              className={`pill text-xs cursor-pointer ${languages.includes(lang) ? 'pill-active' : ''}`}
            >
              {languages.includes(lang) ? '✓ ' : ''}{lang}
            </button>
          ))}

          {/* Custom added languages */}
          {languages.filter(l => !LANGUAGES.includes(l)).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguages(languages.filter(lang => lang !== l))}
              className="pill pill-active text-xs cursor-pointer"
            >
              ✓ {l}
            </button>
          ))}

          {/* Other option */}
          <button
            type="button"
            onClick={handleToggleOther}
            className={`pill text-xs cursor-pointer ${otherActive ? 'pill-active' : ''}`}
          >
            {otherActive ? '✓ ' : ''}Other
          </button>
        </div>

        {/* Small input field and Add button shown only when Other is selected */}
        {otherActive && (
          <div className="pt-3 max-w-sm">
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => {
                  setCustomInput(e.target.value)
                  if (inputError) setInputError('')
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomLanguage()
                  }
                }}
                placeholder="Enter your language"
                className={`field-input text-xs flex-1 ${inputError ? 'border-rose-400' : ''}`}
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddCustomLanguage}
                className="px-4 py-2 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid transition-colors cursor-pointer shrink-0"
              >
                Add
              </button>
            </div>
            {inputError && (
              <p className="text-xs text-rose-500 mt-1.5 font-medium">{inputError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STEP 02: EXPERTISE ONLY ──────────────────────────────────────────────────
function StepExpertise({
  categories, setCategories, skills, setSkills
}: {
  categories: string[]; setCategories: (v: string[]) => void
  skills: string[]; setSkills: (v: string[]) => void
}) {
  const [customCat, setCustomCat] = useState('')
  const [showCustomCatInput, setShowCustomCatInput] = useState(false)

  const [customSkill, setCustomSkill] = useState('')
  const [showCustomSkillInput, setShowCustomSkillInput] = useState(false)

  const toggleCategory = (cat: string) => {
    setCategories(categories.includes(cat) ? categories.filter(c => c !== cat) : [...categories, cat])
  }

  const toggleSkill = (skill: string) => {
    setSkills(skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill])
  }

  const addCustomCategory = () => {
    if (!customCat.trim()) return
    const val = customCat.trim()
    if (!categories.includes(val)) {
      setCategories([...categories, val])
    }
    setCustomCat('')
    setShowCustomCatInput(false)
  }

  const addCustomSkill = () => {
    if (!customSkill.trim()) return
    const val = customSkill.trim()
    if (!skills.includes(val)) {
      setSkills([...skills, val])
    }
    setCustomSkill('')
    setShowCustomSkillInput(false)
  }

  return (
    <div className="space-y-8">
      <StepHeader
        n="02"
        title="Your expertise"
        sub="What areas can you genuinely help with? Select all that apply."
      />

      {/* Categories */}
      <div className="bg-white p-6 rounded-2xl border border-grey-soft shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="field-label mb-0">Categories *</label>
          <span className="text-xs text-gold font-medium">{categories.length} selected</span>
        </div>
        <p className="text-xs text-grey">Select broad domains where you have direct experience.</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {BASE_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`pill text-xs cursor-pointer ${categories.includes(c) ? 'pill-active' : ''}`}
            >
              {categories.includes(c) ? '✓ ' : ''}{c}
            </button>
          ))}

          {/* Custom added categories */}
          {categories.filter(c => !BASE_CATEGORIES.includes(c)).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className="pill pill-active text-xs cursor-pointer"
            >
              ✓ {c} (Custom)
            </button>
          ))}

          {/* Other button */}
          <button
            type="button"
            onClick={() => setShowCustomCatInput(v => !v)}
            className="pill text-xs border-dashed border-gold text-gold hover:bg-gold/10 cursor-pointer flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Other
          </button>
        </div>

        {/* Custom Category Input */}
        {showCustomCatInput && (
          <div className="pt-2 flex gap-2">
            <input
              type="text"
              value={customCat}
              onChange={e => setCustomCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomCategory())}
              placeholder="Tell us your area of expertise (e.g. Health Tech, Cleantech)"
              className="field-input text-xs flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomCategory}
              className="px-4 py-2 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid cursor-pointer"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Specific Skills */}
      <div className="bg-white p-6 rounded-2xl border border-grey-soft shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="field-label mb-0">Specific Skills</label>
          <span className="text-xs text-gold font-medium">{skills.length} selected</span>
        </div>
        <p className="text-xs text-grey">Specific tools, crafts, and practical topics you can discuss or teach.</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {BASE_SKILLS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSkill(s)}
              className={`pill text-xs cursor-pointer ${skills.includes(s) ? 'pill-active' : ''}`}
            >
              {skills.includes(s) ? '✓ ' : ''}{s}
            </button>
          ))}

          {/* Custom added skills */}
          {skills.filter(s => !BASE_SKILLS.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSkill(s)}
              className="pill pill-active text-xs cursor-pointer"
            >
              ✓ {s} (Custom)
            </button>
          ))}

          {/* Other button */}
          <button
            type="button"
            onClick={() => setShowCustomSkillInput(v => !v)}
            className="pill text-xs border-dashed border-gold text-gold hover:bg-gold/10 cursor-pointer flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Other
          </button>
        </div>

        {/* Custom Skill Input */}
        {showCustomSkillInput && (
          <div className="pt-2 flex gap-2">
            <input
              type="text"
              value={customSkill}
              onChange={e => setCustomSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
              placeholder="Tell us your specific skill (e.g. Next.js, Product Analytics)"
              className="field-input text-xs flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomSkill}
              className="px-4 py-2 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid cursor-pointer"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STEP 03: EXPERIENCE ONLY ─────────────────────────────────────────────────
function StepExperience({
  yearsExp, setYearsExp, companies, setCompanies, education, setEducation,
  achievements, setAchievements, about, setAbout, linkedinUrl, setLinkedinUrl,
  websiteUrl, setWebsiteUrl
}: {
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
      <StepHeader
        n="03"
        title="Your experience"
        sub="Help mentees understand your background and career journey."
      />

      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label">Years of Professional Experience</label>
        <div className="flex items-center gap-3 mt-1">
          <input
            type="number"
            min={0}
            max={50}
            value={yearsExp}
            onChange={e => setYearsExp(Math.max(0, Number(e.target.value)))}
            className="field-input w-28"
          />
          <span className="text-sm text-grey">years in the industry</span>
        </div>
      </div>

      <div className="space-y-4">
        <ListField
          label="Companies / Organizations"
          values={companies}
          setValues={setCompanies}
          placeholder="e.g. Microsoft, Razorpay, Zepto"
        />
        <ListField
          label="Education / Degrees"
          values={education}
          setValues={setEducation}
          placeholder="e.g. B.Tech Computer Science, IIT Bombay"
        />
        <ListField
          label="Key Achievements / Honors"
          values={achievements}
          setValues={setAchievements}
          placeholder="e.g. Built open-source tool with 10k stars, Speaker at React India"
        />
      </div>

      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label">About You <span className="text-grey font-normal">(longer background story)</span></label>
        <textarea
          value={about}
          onChange={e => setAbout(e.target.value)}
          placeholder="Share your personal story, transitions you navigated, lessons you learned the hard way, and why you want to mentor."
          className="field-input field-textarea mt-1"
          rows={5}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="LinkedIn Profile URL" value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/…" type="url" />
        <FormField label="Personal Website / Portfolio" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://yourportfolio.com" type="url" />
      </div>
    </div>
  )
}

// ─── STEP 04: AVAILABILITY ONLY ───────────────────────────────────────────────
function StepAvailability({
  timezone, setTimezone, availability, setAvailability
}: {
  timezone: string; setTimezone: (v: string) => void
  availability: AvailRule[]; setAvailability: (v: AvailRule[]) => void
}) {
  function updateDay(weekday: number, key: keyof AvailRule, value: unknown) {
    setAvailability(availability.map(r => (r.weekday === weekday ? { ...r, [key]: value } : r)))
  }
  function copyToAll(weekday: number) {
    const src = availability.find(r => r.weekday === weekday)
    if (!src) return
    setAvailability(
      availability.map(r => (r.enabled ? { ...r, startTime: src.startTime, endTime: src.endTime } : r))
    )
  }

  return (
    <div className="space-y-6">
      <StepHeader
        n="04"
        title="Your availability"
        sub="Set when you are available for mentorship sessions. You can adjust this anytime."
      />

      <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
        <label className="field-label flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-gold" /> Timezone
        </label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          className="field-input mt-1"
        >
          {Intl.supportedValuesOf('timeZone').map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        <p className="text-xs text-grey mt-1.5">Session slots will be shown in your mentees' local timezones automatically.</p>
      </div>

      <div className="space-y-3">
        {availability.map(rule => (
          <div
            key={rule.weekday}
            className={`p-4 rounded-2xl border transition-all ${
              rule.enabled
                ? 'bg-white border-navy/20 shadow-xs'
                : 'bg-ivory-light border-grey-soft opacity-70'
            }`}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    rule.enabled ? 'bg-navy' : 'bg-grey-soft'
                  }`}
                  onClick={() => updateDay(rule.weekday, 'enabled', !rule.enabled)}
                  role="switch"
                  aria-checked={rule.enabled}
                  tabIndex={0}
                  onKeyDown={e => e.key === ' ' && updateDay(rule.weekday, 'enabled', !rule.enabled)}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </div>
                <span className={`font-semibold text-sm w-28 ${rule.enabled ? 'text-navy' : 'text-grey'}`}>
                  {DAYS[rule.weekday]}
                </span>
              </label>

              {rule.enabled ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-grey">From:</span>
                  <input
                    type="time"
                    value={rule.startTime}
                    onChange={e => updateDay(rule.weekday, 'startTime', e.target.value)}
                    className="field-input w-auto text-xs py-1.5 px-2.5 font-medium"
                  />
                  <span className="text-grey text-xs">to</span>
                  <input
                    type="time"
                    value={rule.endTime}
                    onChange={e => updateDay(rule.weekday, 'endTime', e.target.value)}
                    className="field-input w-auto text-xs py-1.5 px-2.5 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => copyToAll(rule.weekday)}
                    title="Apply these times to all enabled days"
                    className="p-1.5 text-grey hover:text-gold hover:bg-gold/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs ml-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copy to all</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-grey italic">Unavailable</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── STEP 05: SERVICES (REDESIGNED WITH INR & EDITABLE PRICES) ─────────────────
function StepServices({
  services, setServices
}: {
  services: Service[]; setServices: (v: Service[]) => void
}) {
  function addService() {
    setServices([
      ...services,
      {
        title: '',
        description: '',
        durationMinutes: 45,
        priceCents: 9900, // ₹99 default
        currency: 'INR',
        format: 'online',
      },
    ])
  }

  function removeService(index: number) {
    if (services.length <= 1) {
      alert('You must have at least one service offering.')
      return
    }
    setServices(services.filter((_, j) => j !== index))
  }

  function updateService(index: number, key: keyof Service, value: unknown) {
    setServices(services.map((s, j) => (j === index ? { ...s, [key]: value } : s)))
  }

  function addFromTemplate(t: typeof SERVICE_TEMPLATES[0]) {
    setServices([
      ...services,
      {
        title: t.title,
        description: t.description,
        durationMinutes: t.durationMinutes,
        priceCents: t.defaultPrice * 100,
        currency: 'INR',
        format: 'online',
      },
    ])
  }

  return (
    <div className="space-y-8">
      <StepHeader
        n="05"
        title="Your services"
        sub="What types of sessions do you offer? Set session length, format, and pricing."
      />

      {/* Service Templates quick selection */}
      <div className="bg-white p-6 rounded-2xl border border-grey-soft shadow-xs space-y-3">
        <p className="field-label mb-1">Quick Add From Session Templates</p>
        <p className="text-xs text-grey mb-3">Click any template to add it to your service offerings.</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_TEMPLATES.map(t => (
            <button
              key={t.title}
              type="button"
              onClick={() => addFromTemplate(t)}
              className="pill text-xs flex items-center gap-1.5 hover:border-gold hover:text-gold hover:bg-gold/5 transition-all cursor-pointer"
            >
              <Plus className="h-3 w-3 text-gold" />
              <span>{t.title}</span>
              <span className="text-[0.625rem] text-grey">({t.durationMinutes}m · ₹{t.defaultPrice})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-6">
        {services.map((s, i) => {
          const priceValue = s.priceCents > 0 ? Math.round(s.priceCents / 100).toString() : '0'

          return (
            <div
              key={i}
              className="bg-white border border-grey-soft rounded-3xl p-6 sm:p-7 shadow-xs space-y-5 relative transition-all hover:border-gold/30"
            >
              {/* Card Header Strip */}
              <div className="flex items-center justify-between pb-4 border-b border-grey-soft">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-navy text-white text-[0.6875rem] font-bold flex items-center justify-center">
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-navy">
                      {s.title.trim() || 'Untitled Service'}
                    </h3>
                    <p className="text-xs text-gold font-medium">
                      {s.durationMinutes} min · {formatPrice(s.priceCents, s.currency)} · {s.format}
                    </p>
                  </div>
                </div>

                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeService(i)}
                    title="Delete service"
                    className="p-2 text-grey hover:text-maroon hover:bg-maroon/5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <div>
                  <label className="field-label">Service Title *</label>
                  <input
                    type="text"
                    value={s.title}
                    onChange={e => updateService(i, 'title', e.target.value)}
                    placeholder="e.g. 1:1 Mentorship Session"
                    className="field-input mt-1 font-medium text-navy"
                  />
                </div>

                <div>
                  <label className="field-label">Session Description</label>
                  <textarea
                    value={s.description}
                    onChange={e => updateService(i, 'description', e.target.value)}
                    placeholder="A focused session to work through your challenges, portfolio, or career roadmaps."
                    className="field-input field-textarea mt-1"
                    rows={2}
                  />
                </div>
              </div>

              {/* Settings Grid: Duration, Price, Currency, Format */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* Duration */}
                <div>
                  <label className="field-label">Duration (min)</label>
                  <select
                    value={s.durationMinutes}
                    onChange={e => updateService(i, 'durationMinutes', Number(e.target.value))}
                    className="field-input mt-1"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>

                {/* Price (INR / ₹ Default) */}
                <div>
                  <label className="field-label">
                    Price ({s.currency === 'INR' ? '₹' : s.currency}) *
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy font-bold text-sm">
                      {s.currency === 'INR' ? '₹' : s.currency === 'USD' ? '$' : '€'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={priceValue === '0' && s.priceCents === 0 ? '' : priceValue}
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '')
                        const amount = clean === '' ? 0 : Math.max(0, parseInt(clean, 10))
                        updateService(i, 'priceCents', amount * 100)
                      }}
                      placeholder="0 (Free)"
                      className="field-input pl-8 font-semibold text-navy"
                    />
                  </div>

                  {/* Quick price chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[
                      { label: 'Free', val: 0 },
                      { label: '₹99', val: 99 },
                      { label: '₹199', val: 199 },
                      { label: '₹499', val: 499 },
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => updateService(i, 'priceCents', p.val * 100)}
                        className={`text-[0.625rem] px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                          Math.round(s.priceCents / 100) === p.val
                            ? 'bg-gold/15 border-gold text-gold font-bold'
                            : 'border-grey-soft text-grey hover:border-gold/40'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label className="field-label">Currency</label>
                  <select
                    value={s.currency}
                    onChange={e => updateService(i, 'currency', e.target.value)}
                    className="field-input mt-1 font-medium"
                  >
                    <option value="INR">INR (₹) - India</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="field-label">Format</label>
                  <select
                    value={s.format}
                    onChange={e => updateService(i, 'format', e.target.value)}
                    className="field-input mt-1"
                  >
                    {FORMATS.map(f => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add another service button */}
      <button
        type="button"
        onClick={addService}
        className="flex items-center gap-2 px-6 py-4 border-2 border-dashed border-grey-soft rounded-2xl text-sm font-semibold text-grey hover:border-gold hover:text-gold hover:bg-gold/5 transition-all w-full justify-center cursor-pointer shadow-2xs"
      >
        <Plus className="h-4 w-4 text-gold" />
        <span>Add another service</span>
      </button>
    </div>
  )
}

// ─── STEP 06: LIVE MENTOR PROFILE PREVIEW ─────────────────────────────────────
function StepPreview({
  fullName, photoUrl, roleTitle, company, location, intro, about,
  categories, skills, yearsExp, companies, education, achievements,
  languages, services, availability, timezone, linkedinUrl, websiteUrl
}: {
  fullName: string; photoUrl: string; roleTitle: string; company: string; location: string
  intro: string; about: string; categories: string[]; skills: string[]; yearsExp: number
  companies: string[]; education: string[]; achievements: string[]; languages: string[]
  services: Service[]; availability: AvailRule[]; timezone: string
  linkedinUrl: string; websiteUrl: string
}) {
  const activeDays = availability.filter(a => a.enabled)

  return (
    <div className="space-y-6">
      <StepHeader
        n="06"
        title="Preview your profile"
        sub="This is exactly how your mentor profile will appear to mentees discovering you on HELPAMART."
      />

      <div className="bg-white rounded-3xl border border-grey-soft overflow-hidden shadow-card">
        {/* Top Preview Banner */}
        <div className="bg-navy px-8 py-4 flex items-center justify-between text-xs text-white/80 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="font-bold tracking-widest uppercase text-[0.6875rem] text-gold">
              Live Mentee View
            </span>
          </div>
          <span>HELPAMART Verified Profile</span>
        </div>

        {/* Profile Card Header */}
        <div className="p-8 sm:p-10 border-b border-grey-soft bg-ivory-light/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-ivory-dark border-2 border-gold/40 shadow-soft shrink-0 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} className="w-full h-full object-cover" alt={fullName} />
              ) : (
                <span className="text-3xl font-display text-grey">{fullName?.[0] || '?'}</span>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-display text-navy">
                  {fullName || 'Your Name'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/15 text-gold text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified Mentor
                </span>
              </div>

              <p className="text-base text-navy/80 font-medium mt-1">
                {roleTitle || 'Your Role'} {company ? `at ${company}` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-3 text-xs text-grey">
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-gold" /> {location}
                  </span>
                )}
                {yearsExp > 0 && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-gold" /> {yearsExp}+ years experience
                  </span>
                )}
                {languages.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-gold" /> {languages.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Short Intro */}
          {intro && (
            <div className="mt-6 p-4 rounded-xl bg-white border border-grey-soft text-navy/90 text-sm leading-relaxed italic font-display text-lg">
              "{intro}"
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-8 sm:p-10 space-y-8">
          {/* Categories & Skills */}
          {(categories.length > 0 || skills.length > 0) && (
            <div>
              <p className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase mb-3">
                Expertise & Focus Areas
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {categories.map(c => (
                  <span key={c} className="px-3 py-1 rounded-lg bg-navy text-white text-xs font-medium">
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-md bg-ivory text-navy text-xs border border-grey-soft font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Services with EXACT Price (₹) */}
          <div>
            <p className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase mb-3">
              Session Offerings ({services.length})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((srv, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-grey-soft bg-ivory-light flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-navy text-sm">{srv.title || 'Untitled Session'}</h4>
                      <span className="text-base font-bold text-gold font-sans">
                        {formatPrice(srv.priceCents, srv.currency)}
                      </span>
                    </div>
                    {srv.description && (
                      <p className="text-xs text-grey leading-relaxed mb-3 line-clamp-2">
                        {srv.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[0.6875rem] text-navy/70 border-t border-grey-soft pt-2.5 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gold" /> {srv.durationMinutes} min
                    </span>
                    <span>·</span>
                    <span className="capitalize">{srv.format}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* About Bio */}
          {about && (
            <div>
              <p className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase mb-2">
                About the Mentor
              </p>
              <p className="text-sm text-navy/80 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-grey-soft">
                {about}
              </p>
            </div>
          )}

          {/* Experience Highlights */}
          {(companies.length > 0 || education.length > 0 || achievements.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {companies.length > 0 && (
                <div className="bg-ivory-light p-4 rounded-xl border border-grey-soft">
                  <p className="text-[0.625rem] font-bold text-grey uppercase tracking-wider mb-2">Companies</p>
                  <ul className="text-xs text-navy space-y-1">
                    {companies.map((c, i) => <li key={i}>• {c}</li>)}
                  </ul>
                </div>
              )}
              {education.length > 0 && (
                <div className="bg-ivory-light p-4 rounded-xl border border-grey-soft">
                  <p className="text-[0.625rem] font-bold text-grey uppercase tracking-wider mb-2">Education</p>
                  <ul className="text-xs text-navy space-y-1">
                    {education.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
              {achievements.length > 0 && (
                <div className="bg-ivory-light p-4 rounded-xl border border-grey-soft">
                  <p className="text-[0.625rem] font-bold text-grey uppercase tracking-wider mb-2">Achievements</p>
                  <ul className="text-xs text-navy space-y-1">
                    {achievements.map((a, i) => <li key={i}>• {a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Availability Summary */}
          <div>
            <p className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase mb-2">
              Weekly Availability ({timezone})
            </p>
            <div className="flex flex-wrap gap-2">
              {activeDays.length > 0 ? (
                activeDays.map(r => (
                  <span key={r.weekday} className="px-3 py-1.5 rounded-lg bg-ivory border border-grey-soft text-xs text-navy font-medium">
                    {DAYS[r.weekday]}: {r.startTime} – {r.endTime}
                  </span>
                ))
              ) : (
                <span className="text-xs text-grey italic">No active days set yet</span>
              )}
            </div>
          </div>

          {/* External Links */}
          {(linkedinUrl || websiteUrl) && (
            <div className="flex items-center gap-4 pt-2 border-t border-grey-soft">
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-navy hover:text-gold flex items-center gap-1 font-medium"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn Profile
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-navy hover:text-gold flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Personal Website
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── GOOGLE CALENDAR CONNECT CARD (used inside Step 07 Publish) ──────────────
// Self-contained component so it can use hooks without breaking the parent function.
function CalendarConnectCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [calStatus, setCalStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [calEmail, setCalEmail] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!user) { setCalStatus('disconnected'); return }
    let cancelled = false
    async function check() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (cancelled) return
        if (!token) { setCalStatus('disconnected'); return }

        // Use the secure server endpoint — avoids RLS race on the anon client
        const resp = await fetch('/api/calendar-status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (!resp.ok) { setCalStatus('disconnected'); return }
        const json = await resp.json() as { connected: boolean; status: string; accountEmail: string | null }
        if (!cancelled) {
          if (json.connected) {
            setCalStatus('connected')
            setCalEmail(json.accountEmail ?? null)
          } else {
            setCalStatus('disconnected')
          }
        }
      } catch {
        if (!cancelled) setCalStatus('disconnected')
      }
    }
    check()
    return () => { cancelled = true }
  }, [user])

  async function handleConnect() {
    if (!user) return
    setConnecting(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) { toast('Session expired. Please sign in again.', 'error'); setConnecting(false); return }
      window.location.href = `/api/calendar-connect?token=${encodeURIComponent(token)}`
    } catch {
      toast('Could not start Calendar connection. Please try again.', 'error')
      setConnecting(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-5 ${calStatus === 'connected' ? 'bg-gold/6 border-gold/25' : 'bg-ivory-light border-grey-soft'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${calStatus === 'connected' ? 'bg-gold/15 text-gold' : 'bg-grey-soft text-grey'}`}>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">Google Calendar</p>
            {calStatus === 'loading' && <p className="text-xs text-grey mt-0.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</p>}
            {calStatus === 'connected' && (
              <p className="text-xs text-grey mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                Connected{calEmail && <span className="text-grey/70">— {calEmail}</span>}
              </p>
            )}
            {calStatus === 'disconnected' && (
              <p className="text-xs text-grey mt-0.5">Connect to enable Google Meet for every session</p>
            )}
          </div>
        </div>
        {calStatus !== 'loading' && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              calStatus === 'connected'
                ? 'border border-grey-soft text-navy/60 hover:text-navy'
                : 'bg-navy text-white hover:bg-navy-mid'
            }`}
          >
            {connecting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…</> : calStatus === 'connected' ? 'Reconnect' : 'Connect Google Calendar'}
          </button>
        )}
      </div>
      {calStatus === 'disconnected' && (
        <p className="text-xs text-grey/60 mt-3 pt-3 border-t border-grey-soft">
          Optional but recommended. Once connected, each booking automatically creates a real Google Meet link.
          You can also connect this after publishing from your Mentor Dashboard.
        </p>
      )}
    </div>
  )
}

// ─── STEP 07: PUBLISH ONLY ────────────────────────────────────────────────────
function StepPublish({
  fullName, photoUrl, roleTitle, intro, categories, skills, services,
  availability, publishing, onPublish, onBack
}: {
  fullName: string; photoUrl: string; roleTitle: string; intro: string
  categories: string[]; skills: string[]; services: Service[]
  availability: AvailRule[]; publishing: boolean; onPublish: () => void
  onBack: () => void
}) {
  const activeDaysCount = availability.filter(r => r.enabled).length
  const lowestPrice = services.reduce((min, s) => (s.priceCents < min ? s.priceCents : min), Infinity)

  const checks = [
    { label: 'Introduction & Profile Photo', detail: fullName ? `${fullName} (${roleTitle || 'Mentor'})` : 'Missing', done: Boolean(fullName && roleTitle && intro) },
    { label: 'Expertise & Focus Areas', detail: `${categories.length} categories, ${skills.length} skills`, done: categories.length > 0 },
    { label: 'Weekly Availability Rules', detail: `${activeDaysCount} active days configured`, done: activeDaysCount > 0 },
    { label: 'Services & Session Offerings', detail: `${services.length} services (starting at ${formatPrice(lowestPrice === Infinity ? 0 : lowestPrice, services[0]?.currency || 'INR')})`, done: services.length > 0 && services.some(s => s.title.trim()) },
    { label: 'Profile Preview Verified', detail: 'Ready for mentee bookings', done: true },
  ]

  const ready = checks.every(c => c.done)

  return (
    <div className="space-y-8">
      <StepHeader
        n="07"
        title="Ready to publish?"
        sub="Your experience is ready to meet someone who needs it. Review the final checklist and launch your profile."
      />

      {/* Completion Summary Card */}
      <div className="bg-white border border-grey-soft rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-grey-soft">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-ivory-dark overflow-hidden border border-grey-soft flex items-center justify-center shrink-0">
              {photoUrl ? (
                <img src={photoUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-xl font-display text-grey">{fullName?.[0] || '?'}</span>
              )}
            </div>
            <div>
              <p className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase">Final Step</p>
              <h3 className="text-lg font-display text-navy mt-0.5">{fullName || 'Mentor Profile'}</h3>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ready ? 'bg-gold/15 text-gold' : 'bg-maroon/10 text-maroon'}`}>
            {ready ? 'Ready to Publish' : 'Action Required'}
          </span>
        </div>

        <div className="space-y-3.5">
          {checks.map(c => (
            <div key={c.label} className="flex items-center justify-between p-3.5 rounded-xl bg-ivory-light/70 border border-grey-soft">
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    c.done ? 'bg-gold text-white' : 'bg-grey-soft text-grey'
                  }`}
                >
                  {c.done ? <Check className="h-3.5 w-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-grey-mid" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-navy">{c.label}</p>
                  <p className="text-[0.6875rem] text-grey">{c.detail}</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${c.done ? 'text-gold' : 'text-grey'}`}>
                {c.done ? 'Complete' : 'Incomplete'}
              </span>
            </div>
          ))}
        </div>

        {/* Final Ready Callout */}
        {ready ? (
          <div className="p-4 rounded-xl bg-gold/10 border border-gold/30 text-xs text-navy/90 leading-relaxed flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-navy">Everything looks complete!</strong> Mentees can immediately find you in search results and request 1:1 sessions within your specified windows.
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-maroon/10 border border-maroon/20 text-xs text-maroon leading-relaxed">
            Please go back to earlier steps and ensure all required fields are filled out.
          </div>
        )}
      </div>

      {/* Google Calendar Connection — inside the Publish step, no extra onboarding step */}
      <CalendarConnectCard />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-grey-soft">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-grey-soft rounded-xl text-navy text-sm font-medium hover:border-navy/30 hover:bg-white transition-all cursor-pointer w-full sm:w-auto justify-center"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Preview
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={!ready || publishing}
          className="w-full sm:w-auto py-3.5 px-8 bg-gold hover:bg-gold-mid text-white rounded-xl font-semibold transition-all hover:shadow-[0_6px_24px_rgba(183,122,34,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer text-sm"
        >
          {publishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Publishing Your Profile…
            </>
          ) : (
            <>
              Publish My HELPAMART Mentor Profile <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── REUSABLE HELPERS ─────────────────────────────────────────────────────────

function StepHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 text-gold text-[0.6875rem] font-bold tracking-widest uppercase mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        Step {n}
      </div>
      <h2 className="text-2xl sm:text-3xl font-display text-navy">{title}</h2>
      <p className="text-sm text-grey mt-1 leading-relaxed">{sub}</p>
    </div>
  )
}

function FormField({
  label, value, onChange, placeholder, type = 'text', className
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input mt-1"
      />
    </div>
  )
}

function ListField({
  label, values, setValues, placeholder
}: {
  label: string; values: string[]; setValues: (v: string[]) => void; placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  function add() {
    if (!draft.trim()) return
    setValues([...values, draft.trim()])
    setDraft('')
  }
  return (
    <div className="bg-white p-5 rounded-2xl border border-grey-soft shadow-xs">
      <label className="field-label mb-2">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="field-input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2 bg-ivory-dark rounded-xl text-sm font-semibold text-navy hover:bg-grey-soft transition-colors shrink-0 cursor-pointer"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {values.map((v, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1 bg-ivory rounded-full text-xs font-medium text-navy border border-grey-soft"
            >
              {v}
              <button
                type="button"
                onClick={() => setValues(values.filter((_, j) => j !== i))}
                className="text-grey hover:text-maroon transition-colors cursor-pointer font-bold ml-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
