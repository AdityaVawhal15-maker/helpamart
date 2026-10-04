import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { db, nowIso, uploadDirPath } from './db.ts'
import {
  authUrl,
  calendarAuthUrl,
  calendarStatus,
  cancelMeetEvent,
  createMeetEvent,
  exchangeAuthCode,
  exchangeCalendarCode,
  googleAuthConfigured,
  saveCalendarConnection,
} from './calendar.ts'
import {
  sendMentorBookingNotification,
  sendStudentBookingConfirmation,
} from './email.ts'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

app.use(
  cors({
    origin: APP_URL,
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadDirPath))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDirPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    if (ok) {
      cb(null, true)
    } else {
      cb(new Error('Only JPG, PNG, or WebP images up to 4MB are allowed.'))
    }
  },
})

type UserRow = {
  id: string
  email: string | null
  phone: string | null
  password_hash: string | null
  google_id: string | null
  name: string
  photo_url: string | null
  bio: string | null
  location: string | null
  timezone: string
  languages: string
  interests: string
  created_at: string
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    name: u.name,
    photoUrl: u.photo_url,
    bio: u.bio,
    location: u.location,
    timezone: u.timezone,
    languages: parseJson<string[]>(u.languages, []),
    interests: parseJson<string[]>(u.interests, []),
    createdAt: u.created_at,
  }
}

function createSession(userId: string, res: express.Response) {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expires.toISOString(),
  )
  res.cookie('helpa_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  })
}

const verifiedTokens = new Map<string, { userId: string; expiresAt: number }>()

async function verifySupabaseToken(token: string): Promise<string | null> {
  const cached = verifiedTokens.get(token)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId
  }
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hespppkftlslbcsizyur.supabase.co'
  const anonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY'
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!res.ok) return null
    const sbUser = (await res.json()) as { id?: string }
    if (!sbUser?.id) return null
    verifiedTokens.set(token, { userId: sbUser.id, expiresAt: Date.now() + 5 * 60 * 1000 })
    return sbUser.id
  } catch {
    return null
  }
}

app.use(async (req, _res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const userId = await verifySupabaseToken(token)
    if (userId) {
      ;(req as any).supabaseUserId = userId
    }
  }
  next()
})

function currentUser(req: express.Request): UserRow | null {
  const supabaseUserId = (req as any).supabaseUserId
  if (supabaseUserId) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(supabaseUserId) as UserRow | undefined
    if (row) return row
  }
  const token = req.cookies?.helpa_session as string | undefined
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowIso()) as UserRow | undefined
  return row || null
}

function requireUser(req: express.Request, res: express.Response): UserRow | null {
  const user = currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' })
    return null
  }
  return user
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'mentor'
  let slug = base
  let i = 1
  while (db.prepare('SELECT id FROM mentor_profiles WHERE slug = ?').get(slug)) {
    slug = `${base}-${i++}`
  }
  return slug
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function zonedDate(date: string, time: string, timeZone: string) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
  const locale = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(
    locale.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]),
  )
  const asIf = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )
  const offset = asIf - utcGuess
  return new Date(utcGuess - offset)
}

type MentorRow = {
  id: string
  user_id: string
  slug: string
  full_name: string
  role_title: string
  company: string
  location: string
  intro: string
  about: string
  photo_url: string | null
  languages: string
  years_experience: number | null
  linkedin_url: string | null
  website_url: string | null
  education: string
  companies: string
  achievements: string
  status: string
  timezone: string
  buffer_minutes: number
  advance_days: number
  min_notice_hours: number
  max_bookings_per_day: number
}

function expertiseFor(mentorId: string) {
  return db
    .prepare('SELECT kind, value FROM mentor_expertise WHERE mentor_id = ?')
    .all(mentorId) as { kind: string; value: string }[]
}

function servicesFor(mentorId: string, activeOnly = false) {
  const sql = activeOnly
    ? 'SELECT * FROM mentor_services WHERE mentor_id = ? AND active = 1'
    : 'SELECT * FROM mentor_services WHERE mentor_id = ?'
  return (db.prepare(sql).all(mentorId) as any[]).map((s) => ({
    id: String(s.id),
    title: String(s.title || ''),
    description: s.description ? String(s.description) : null,
    durationMinutes: Number(s.duration_minutes) || 30,
    priceCents: Number(s.price_cents) || 0,
    currency: String(s.currency || 'USD'),
    format: String(s.format || '1:1 video call'),
    active: Boolean(s.active),
  }))
}

function serializeMentor(m: MentorRow, opts?: { includePrivate?: boolean }) {
  const tags = expertiseFor(m.id)
  const lowest = db
    .prepare(
      'SELECT MIN(price_cents) as min FROM mentor_services WHERE mentor_id = ? AND active = 1',
    )
    .get(m.id) as { min: number | null }
  return {
    id: m.id,
    slug: m.slug,
    name: m.full_name,
    role: m.role_title,
    company: m.company,
    location: m.location,
    intro: m.intro,
    about: m.about,
    photoUrl: m.photo_url,
    languages: parseJson<string[]>(m.languages, []),
    yearsExperience: m.years_experience,
    linkedinUrl: m.linkedin_url,
    websiteUrl: m.website_url,
    education: parseJson<string[]>(m.education, []),
    companies: parseJson<string[]>(m.companies, []),
    achievements: parseJson<string[]>(m.achievements, []),
    status: m.status,
    timezone: m.timezone,
    bufferMinutes: m.buffer_minutes,
    advanceDays: m.advance_days,
    minNoticeHours: m.min_notice_hours,
    maxBookingsPerDay: m.max_bookings_per_day,
    categories: tags.filter((t) => t.kind === 'category').map((t) => t.value),
    skills: tags.filter((t) => t.kind === 'skill').map((t) => t.value),
    services: servicesFor(m.id, m.status === 'published' && !opts?.includePrivate),
    startingPriceCents: lowest.min,
    availabilityPreview: nextAvailabilityLabel(m),
  }
}

type BookingRow = Record<string, unknown>

function serializeBooking(b: BookingRow) {
  return {
    id: b.id,
    mentorId: b.mentor_id,
    menteeId: b.mentee_id,
    serviceId: b.service_id,
    startAt: b.start_at,
    endAt: b.end_at,
    timezone: b.timezone,
    status: b.status,
    paymentStatus: b.payment_status,
    priceCents: b.price_cents,
    currency: b.currency,
    meetLink: b.meet_link || null,
    calendarEventId: b.calendar_event_id || null,
    calendarStatus: b.calendar_status || null,
    notes: b.notes || null,
    createdAt: b.created_at,
    // Joined fields (present only in list queries)
    mentorName: b.mentor_name || null,
    mentorSlug: b.mentor_slug || null,
    mentorPhoto: b.mentor_photo || null,
    serviceTitle: b.service_title || null,
    menteeName: b.mentee_name || null,
  }
}

function nextAvailabilityLabel(m: MentorRow) {
  const slots = generateSlots(m, 14)
  if (!slots.length) return null
  return slots[0].start
}

function generateSlots(m: MentorRow, days = 14) {
  const rules = db
    .prepare('SELECT * FROM availability_rules WHERE mentor_id = ? AND enabled = 1')
    .all(m.id) as { weekday: number; start_time: string; end_time: string }[]
  const exceptions = db
    .prepare('SELECT * FROM availability_exceptions WHERE mentor_id = ?')
    .all(m.id) as { date: string; kind: string; start_time: string | null; end_time: string | null }[]
  const bookings = db
    .prepare(
      `SELECT start_at, end_at FROM bookings
       WHERE mentor_id = ? AND status IN ('confirmed', 'pending')`,
    )
    .all(m.id) as { start_at: string; end_at: string }[]

  const services = servicesFor(m.id, true)
  const duration = services[0]?.durationMinutes || 30
  const now = Date.now()
  const minStart = now + m.min_notice_hours * 60 * 60 * 1000
  const maxStart = now + m.advance_days * 24 * 60 * 60 * 1000
  const slots: { start: string; end: string }[] = []

  for (let d = 0; d < Math.min(days, m.advance_days); d++) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + d)
    const dateStr = day.toISOString().slice(0, 10)
    const weekday = day.getDay()
    if (exceptions.some((e) => e.date === dateStr && e.kind === 'blocked')) continue
    const dayRules = rules.filter((r) => r.weekday === weekday)
    let count = 0
    for (const rule of dayRules) {
      let cursor = timeToMinutes(rule.start_time)
      const end = timeToMinutes(rule.end_time)
      while (cursor + duration <= end) {
        const startH = String(Math.floor(cursor / 60)).padStart(2, '0')
        const startM = String(cursor % 60).padStart(2, '0')
        const endMin = cursor + duration
        const endH = String(Math.floor(endMin / 60)).padStart(2, '0')
        const endM = String(endMin % 60).padStart(2, '0')
        const startDt = zonedDate(dateStr, `${startH}:${startM}`, m.timezone)
        const endDt = zonedDate(dateStr, `${endH}:${endM}`, m.timezone)
        const startMs = startDt.getTime()
        const endMs = endDt.getTime()
        if (startMs >= minStart && startMs <= maxStart) {
          const conflict = bookings.some((b) => {
            const bs = Date.parse(b.start_at)
            const be = Date.parse(b.end_at)
            return startMs < be && endMs > bs
          })
          if (!conflict && count < m.max_bookings_per_day) {
            slots.push({ start: startDt.toISOString(), end: endDt.toISOString() })
            count++
          }
        }
        cursor += duration + m.buffer_minutes
      }
    }
  }
  return slots
}

function getOrCreateMentor(user: UserRow): MentorRow {
  const existing = db.prepare('SELECT * FROM mentor_profiles WHERE user_id = ?').get(user.id) as
    | MentorRow
    | undefined
  if (existing) return existing
  const id = crypto.randomUUID()
  const slug = slugify(user.name || 'mentor')
  const t = nowIso()
  db.prepare(
    `INSERT INTO mentor_profiles (id, user_id, slug, full_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, slug, user.name || '', t, t)
  return db.prepare('SELECT * FROM mentor_profiles WHERE id = ?').get(id) as MentorRow
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/config', (_req, res) => {
  const fee = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(
    'platform_fee_percent',
  ) as { value: string }
  res.json({
    googleAuth: googleAuthConfigured(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    platformFeePercent: Number(fee.value),
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  })
})

app.get('/api/me', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.json({ user: null, mentor: null })
  const mentor = db.prepare('SELECT * FROM mentor_profiles WHERE user_id = ?').get(user.id) as
    | MentorRow
    | undefined
  res.json({
    user: publicUser(user),
    mentor: mentor ? serializeMentor(mentor, { includePrivate: true }) : null,
    calendar: calendarStatus(user.id),
  })
})

const handleUserUpdate = (req: express.Request, res: express.Response) => {
  const user = requireUser(req, res)
  if (!user) return
  const { name, bio, location, timezone, languages, interests } = req.body as Record<string, unknown>
  db.prepare(
    `UPDATE users SET name=COALESCE(?, name), bio=COALESCE(?, bio), location=COALESCE(?, location),
     timezone=COALESCE(?, timezone), languages=COALESCE(?, languages), interests=COALESCE(?, interests)
     WHERE id=?`,
  ).run(
    typeof name === 'string' ? name.trim() : null,
    typeof bio === 'string' ? bio : null,
    typeof location === 'string' ? location : null,
    typeof timezone === 'string' ? timezone : null,
    Array.isArray(languages) ? JSON.stringify(languages) : null,
    Array.isArray(interests) ? JSON.stringify(interests) : null,
    user.id,
  )
  const next = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow
  res.json({ user: publicUser(next) })
}

app.patch('/api/me', handleUserUpdate)
app.put('/api/me', handleUserUpdate)
app.put('/api/users/me', handleUserUpdate)
app.patch('/api/users/me', handleUserUpdate)

app.post('/api/auth/supabase-sync', async (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.body?.access_token
  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided.' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://hespppkftlslbcsizyur.supabase.co'
  const anonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY'

  let sbUser: any = null
  try {
    const sbRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!sbRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired authentication session.' })
    }
    sbUser = await sbRes.json()
  } catch {
    return res.status(500).json({ error: 'Failed to verify session with authentication server.' })
  }

  if (!sbUser?.id) {
    return res.status(401).json({ error: 'User could not be identified.' })
  }

  const userId = sbUser.id as string
  const email = (sbUser.email || '').toLowerCase()
  const metadata = sbUser.user_metadata || {}
  const name = (metadata.name || metadata.full_name || req.body?.name || '').trim()
  const photoUrl = metadata.avatar_url || metadata.picture || null

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  if (!user && email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
    if (user) {
      db.prepare('UPDATE users SET id = ?, photo_url = COALESCE(photo_url, ?) WHERE id = ?').run(
        userId,
        photoUrl,
        user.id,
      )
      db.prepare('UPDATE mentor_profiles SET user_id = ? WHERE user_id = ?').run(userId, user.id)
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow
    }
  }

  if (!user) {
    db.prepare(
      `INSERT INTO users (id, email, name, photo_url, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, email || null, name, photoUrl, nowIso())
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow
  } else {
    if ((name && !user.name) || (photoUrl && !user.photo_url)) {
      db.prepare('UPDATE users SET name = COALESCE(NULLIF(name, ""), ?), photo_url = COALESCE(photo_url, ?) WHERE id = ?').run(
        name,
        photoUrl,
        userId,
      )
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow
    }
  }

  createSession(user.id, res)
  const mentor = db.prepare('SELECT * FROM mentor_profiles WHERE user_id = ?').get(user.id) as MentorRow | undefined
  res.json({
    user: publicUser(user),
    mentor: mentor ? serializeMentor(mentor, { includePrivate: true }) : null,
    calendar: calendarStatus(user.id),
  })
})

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string }
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Use a valid email and a password of at least 8 characters.' })
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' })
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, email.toLowerCase(), bcrypt.hashSync(password, 10), name?.trim() || '', nowIso())
  createSession(id, res)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
    | UserRow
    | undefined
  if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  createSession(user.id, res)
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.helpa_session
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.clearCookie('helpa_session', { path: '/' })
  res.json({ ok: true })
})

app.post('/api/auth/otp/request', (req, res) => {
  const { destination } = req.body as { destination?: string }
  if (!destination || !destination.includes('@')) {
    return res.status(400).json({ error: 'A valid email destination is required.' })
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const id = crypto.randomUUID()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  db.prepare(
    `INSERT INTO otp_codes (id, destination, channel, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, destination.toLowerCase().trim(), 'email', bcrypt.hashSync(code, 8), expires)

  console.info(`[HELPA EMAIL OTP] ${destination}: ${code}`)
  res.json({
    ok: true,
    delivery: 'email',
    message: 'Verification code sent to your email.',
  })
})

app.post('/api/auth/otp/verify', (req, res) => {
  const { destination, code, name } = req.body as { destination?: string; code?: string; name?: string }
  if (!destination || !code) return res.status(400).json({ error: 'Code is required.' })
  const cleanEmail = destination.toLowerCase().trim()
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE destination = ? AND consumed = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`,
    )
    .get(cleanEmail, nowIso()) as { id: string; code_hash: string } | undefined
  if (!row || !bcrypt.compareSync(code, row.code_hash)) {
    return res.status(401).json({ error: 'That code is invalid or has expired.' })
  }
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id)
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as UserRow | undefined
  if (!user) {
    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`,
    ).run(
      id,
      cleanEmail,
      name?.trim() || '',
      nowIso(),
    )
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
  }
  createSession(user.id, res)
  res.json({ user: publicUser(user) })
})

app.get('/api/auth/google', (_req, res) => {
  if (!googleAuthConfigured()) {
    return res.status(501).json({ error: 'Google sign-in is not configured.' })
  }
  res.redirect(authUrl())
})

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '')
    const { profile } = await exchangeAuthCode(code)
    if (!profile.email) throw new Error('No email from Google')
    const googleId = profile.id || null
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR (google_id IS NOT NULL AND google_id = ?)').get(
      profile.email,
      googleId,
    ) as UserRow | undefined
    if (!user) {
      const id = crypto.randomUUID()
      db.prepare(
        `INSERT INTO users (id, email, google_id, name, photo_url, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, profile.email, googleId, profile.name || '', profile.picture || null, nowIso())
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
    } else {
      db.prepare('UPDATE users SET google_id = COALESCE(google_id, ?) WHERE id = ?').run(
        googleId,
        user.id,
      )
    }
    createSession(user.id, res)
    res.redirect(`${APP_URL}/dashboard`)
  } catch {
    res.redirect(`${APP_URL}/login?error=google`)
  }
})

app.get('/api/calendar/status', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  res.json(calendarStatus(user.id))
})

app.get('/api/calendar/connect', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  if (!googleAuthConfigured()) {
    return res.status(501).json({ error: 'Google Calendar is not configured on this server.' })
  }
  res.redirect(calendarAuthUrl())
})

app.get('/api/calendar/callback', async (req, res) => {
  const user = currentUser(req)
  if (!user) return res.redirect(`${APP_URL}/login`)
  try {
    const { tokens, email } = await exchangeCalendarCode(String(req.query.code || ''))
    saveCalendarConnection(user.id, tokens, email)
    res.redirect(`${APP_URL}/mentor-dashboard?calendar=connected`)
  } catch {
    res.redirect(`${APP_URL}/mentor-dashboard?calendar=error`)
  }
})

app.get('/api/taxonomy', (_req, res) => {
  res.json({
    categories: [
      'Career',
      'Technology',
      'AI & Machine Learning',
      'Design',
      'Business',
      'Startups',
      'Education',
      'Study Abroad',
      'Finance',
      'Leadership',
      'Personal Growth',
      'Interview Preparation',
      'College',
      'Skills',
      'Life',
      'Community',
    ],
    skills: [
      'Software Engineering',
      'AI & ML',
      'Product Management',
      'Career Guidance',
      'Design',
      'Startups',
      'Finance',
      'Study Abroad',
      'Interview Preparation',
      'Leadership',
      'Research',
      'Writing',
    ],
    languages: ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Mandarin'],
    serviceTemplates: [
      { title: '1:1 Mentorship', duration: 45 },
      { title: 'Career Guidance', duration: 30 },
      { title: 'Mock Interview', duration: 60 },
      { title: 'Portfolio Review', duration: 45 },
      { title: 'Resume Review', duration: 30 },
      { title: 'Technical Discussion', duration: 45 },
      { title: 'Startup Advice', duration: 45 },
    ],
  })
})

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (!q) return res.json({ mentors: [], posts: [], suggestions: [] })
  const mentors = (
    db
      .prepare(
        `SELECT * FROM mentor_profiles WHERE status = 'published'
         AND (lower(full_name) LIKE ? OR lower(role_title) LIKE ? OR lower(intro) LIKE ? OR lower(company) LIKE ?)`,
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as MentorRow[]
  ).map((m) => serializeMentor(m))
  const bySkill = db
    .prepare(
      `SELECT DISTINCT m.* FROM mentor_profiles m
       JOIN mentor_expertise e ON e.mentor_id = m.id
       WHERE m.status = 'published' AND lower(e.value) LIKE ?`,
    )
    .all(`%${q}%`) as MentorRow[]
  const merged = [...mentors]
  for (const m of bySkill) {
    if (!merged.some((x) => x.id === m.id)) merged.push(serializeMentor(m))
  }
  const posts = db
    .prepare(
      `SELECT id, title, category FROM community_posts
       WHERE lower(title) LIKE ? OR lower(body) LIKE ? LIMIT 8`,
    )
    .all(`%${q}%`, `%${q}%`)
  res.json({
    mentors: merged,
    posts,
    suggestions: ['AI mentor', 'career transition', 'product management', 'study abroad'].filter((s) =>
      s.includes(q),
    ),
  })
})

app.get('/api/mentors', (req, res) => {
  const { q, category, language, format } = req.query as Record<string, string | undefined>
  let mentors = db
    .prepare(`SELECT * FROM mentor_profiles WHERE status = 'published' ORDER BY published_at DESC`)
    .all() as MentorRow[]
  if (category) {
    const ids = new Set(
      (
        db
          .prepare(`SELECT mentor_id FROM mentor_expertise WHERE kind='category' AND value = ?`)
          .all(category) as { mentor_id: string }[]
      ).map((r) => r.mentor_id),
    )
    mentors = mentors.filter((m) => ids.has(m.id))
  }
  if (q) {
    const query = q.toLowerCase()
    mentors = mentors.filter((m) => {
      const tags = expertiseFor(m.id)
      return (
        m.full_name.toLowerCase().includes(query) ||
        m.role_title.toLowerCase().includes(query) ||
        m.intro.toLowerCase().includes(query) ||
        tags.some((t) => t.value.toLowerCase().includes(query))
      )
    })
  }
  let results = mentors.map((m) => serializeMentor(m))
  if (language) results = results.filter((m) => m.languages.includes(language))
  if (format) results = results.filter((m) => m.services.some((s) => s.format === format))
  res.json({ mentors: results })
})

app.get('/api/mentors/:slug', (req, res) => {
  const m = db.prepare(`SELECT * FROM mentor_profiles WHERE slug = ?`).get(req.params.slug) as
    | MentorRow
    | undefined
  if (!m || (m.status !== 'published' && currentUser(req)?.id !== m.user_id)) {
    return res.status(404).json({ error: 'This profile is not available.' })
  }
  res.json({
    mentor: serializeMentor(m, { includePrivate: currentUser(req)?.id === m.user_id }),
    slots: m.status === 'published' ? generateSlots(m, 21) : [],
  })
})

app.get('/api/mentors/:slug/availability', (req, res) => {
  const m = db.prepare(`SELECT * FROM mentor_profiles WHERE slug = ? AND status = 'published'`).get(
    req.params.slug,
  ) as MentorRow | undefined
  if (!m) return res.status(404).json({ error: 'Mentor not found.' })
  const serviceId = String(req.query.serviceId || '')
  const service = serviceId
    ? (db.prepare('SELECT * FROM mentor_services WHERE id = ? AND mentor_id = ?').get(serviceId, m.id) as
        | { duration_minutes: number }
        | undefined)
    : undefined
  const slots = generateSlots(
    service ? { ...m } : m,
    21,
  )
  res.json({ timezone: m.timezone, slots, durationMinutes: service?.duration_minutes || 30 })
})

app.post('/api/uploads/photo', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'Choose a photo to upload.' })
    const url = `/uploads/${req.file.filename}`
    db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(url, user.id)
    res.json({ url })
  })
})

app.get('/api/mentor/me', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = getOrCreateMentor(user)
  const rules = db.prepare('SELECT * FROM availability_rules WHERE mentor_id = ?').all(mentor.id)
  res.json({
    mentor: serializeMentor(mentor, { includePrivate: true }),
    availability: rules,
    calendar: calendarStatus(user.id),
  })
})

app.put('/api/mentor/me', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = getOrCreateMentor(user)
  const b = req.body as Record<string, unknown>
  const fullName = typeof b.fullName === 'string' ? b.fullName : mentor.full_name
  db.prepare(
    `UPDATE mentor_profiles SET
      full_name=?, role_title=?, company=?, location=?, intro=?, about=?, photo_url=?,
      languages=?, years_experience=?, linkedin_url=?, website_url=?, education=?, companies=?,
      achievements=?, timezone=?, buffer_minutes=?, advance_days=?, min_notice_hours=?,
      max_bookings_per_day=?, updated_at=?
     WHERE id=?`,
  ).run(
    fullName,
    typeof b.roleTitle === 'string' ? b.roleTitle : mentor.role_title,
    typeof b.company === 'string' ? b.company : mentor.company,
    typeof b.location === 'string' ? b.location : mentor.location,
    typeof b.intro === 'string' ? b.intro : mentor.intro,
    typeof b.about === 'string' ? b.about : mentor.about,
    typeof b.photoUrl === 'string' ? b.photoUrl : mentor.photo_url,
    Array.isArray(b.languages) ? JSON.stringify(b.languages) : mentor.languages,
    typeof b.yearsExperience === 'number' ? b.yearsExperience : mentor.years_experience,
    typeof b.linkedinUrl === 'string' ? b.linkedinUrl : mentor.linkedin_url,
    typeof b.websiteUrl === 'string' ? b.websiteUrl : mentor.website_url,
    Array.isArray(b.education) ? JSON.stringify(b.education) : mentor.education,
    Array.isArray(b.companies) ? JSON.stringify(b.companies) : mentor.companies,
    Array.isArray(b.achievements) ? JSON.stringify(b.achievements) : mentor.achievements,
    typeof b.timezone === 'string' ? b.timezone : mentor.timezone,
    typeof b.bufferMinutes === 'number' ? b.bufferMinutes : mentor.buffer_minutes,
    typeof b.advanceDays === 'number' ? b.advanceDays : mentor.advance_days,
    typeof b.minNoticeHours === 'number' ? b.minNoticeHours : mentor.min_notice_hours,
    typeof b.maxBookingsPerDay === 'number' ? b.maxBookingsPerDay : mentor.max_bookings_per_day,
    nowIso(),
    mentor.id,
  )
  if (fullName && fullName !== mentor.full_name && mentor.status !== 'published') {
    const slug = slugify(fullName)
    db.prepare('UPDATE mentor_profiles SET slug=? WHERE id=?').run(slug, mentor.id)
  }
  if (Array.isArray(b.categories) || Array.isArray(b.skills)) {
    db.prepare('DELETE FROM mentor_expertise WHERE mentor_id = ?').run(mentor.id)
    const cats = (b.categories as string[] | undefined) || []
    const skills = (b.skills as string[] | undefined) || []
    const ins = db.prepare('INSERT INTO mentor_expertise (id, mentor_id, kind, value) VALUES (?, ?, ?, ?)')
    for (const c of cats) ins.run(crypto.randomUUID(), mentor.id, 'category', c)
    for (const s of skills) ins.run(crypto.randomUUID(), mentor.id, 'skill', s)
  }
  if (Array.isArray(b.services)) {
    db.prepare('DELETE FROM mentor_services WHERE mentor_id = ?').run(mentor.id)
    const ins = db.prepare(
      `INSERT INTO mentor_services (id, mentor_id, title, description, duration_minutes, price_cents, currency, format, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    for (const s of b.services as {
      title: string
      description?: string
      durationMinutes: number
      priceCents: number
      currency?: string
      format?: string
    }[]) {
      if (!s.title || !s.durationMinutes) continue
      ins.run(
        crypto.randomUUID(),
        mentor.id,
        s.title,
        s.description || '',
        s.durationMinutes,
        s.priceCents || 0,
        s.currency || 'USD',
        s.format || 'online',
      )
    }
  }
  if (Array.isArray(b.availability)) {
    db.prepare('DELETE FROM availability_rules WHERE mentor_id = ?').run(mentor.id)
    const ins = db.prepare(
      `INSERT INTO availability_rules (id, mentor_id, weekday, start_time, end_time, enabled) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const r of b.availability as {
      weekday: number
      startTime: string
      endTime: string
      enabled: boolean
    }[]) {
      ins.run(crypto.randomUUID(), mentor.id, r.weekday, r.startTime, r.endTime, r.enabled ? 1 : 0)
    }
  }
  const next = db.prepare('SELECT * FROM mentor_profiles WHERE id = ?').get(mentor.id) as MentorRow
  res.json({ mentor: serializeMentor(next, { includePrivate: true }) })
})

app.post('/api/mentor/publish', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = getOrCreateMentor(user)
  const services = servicesFor(mentor.id)
  const rules = db.prepare('SELECT * FROM availability_rules WHERE mentor_id = ? AND enabled = 1').all(
    mentor.id,
  )
  const missing: string[] = []
  if (!mentor.full_name) missing.push('name')
  if (!mentor.role_title) missing.push('role')
  if (!mentor.intro) missing.push('introduction')
  if (!mentor.photo_url) missing.push('photo')
  if (!expertiseFor(mentor.id).length) missing.push('expertise')
  if (!services.length) missing.push('services')
  if (!rules.length) missing.push('availability')
  if (missing.length) {
    return res.status(400).json({ error: 'Profile is not complete yet.', missing })
  }
  db.prepare(
    `UPDATE mentor_profiles SET status='published', published_at=?, updated_at=? WHERE id=?`,
  ).run(nowIso(), nowIso(), mentor.id)
  const next = db.prepare('SELECT * FROM mentor_profiles WHERE id = ?').get(mentor.id) as MentorRow
  res.json({ mentor: serializeMentor(next, { includePrivate: true }) })
})

app.post('/api/mentor/status', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = getOrCreateMentor(user)
  const { status } = req.body as { status?: string }
  if (!status || !['published', 'paused', 'draft'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' })
  }
  db.prepare('UPDATE mentor_profiles SET status=?, updated_at=? WHERE id=?').run(status, nowIso(), mentor.id)
  res.json({ ok: true, status })
})

app.post('/api/bookings', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const { mentorSlug, serviceId, startAt, timezone } = req.body as {
    mentorSlug?: string
    serviceId?: string
    startAt?: string
    timezone?: string
  }
  if (!mentorSlug || !serviceId || !startAt || !timezone) {
    return res.status(400).json({ error: 'Mentor, service, time, and timezone are required.' })
  }
  const mentor = db
    .prepare(`SELECT * FROM mentor_profiles WHERE slug = ? AND status = 'published'`)
    .get(mentorSlug) as MentorRow | undefined
  if (!mentor) return res.status(404).json({ error: 'This mentor is not available.' })
  const service = db
    .prepare('SELECT * FROM mentor_services WHERE id = ? AND mentor_id = ? AND active = 1')
    .get(serviceId, mentor.id) as
    | {
        id: string
        title: string
        duration_minutes: number
        price_cents: number
        currency: string
      }
    | undefined
  if (!service) return res.status(400).json({ error: 'That session type is not available.' })

  const start = new Date(startAt)
  const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000)
  const slots = generateSlots(mentor, mentor.advance_days)
  const stillOpen = slots.some((s) => Math.abs(Date.parse(s.start) - start.getTime()) < 1000)
  if (!stillOpen) {
    return res.status(409).json({ error: 'That time is no longer available.' })
  }

  const bookingId = crypto.randomUUID()
  const price = service.price_cents
  const paymentStatus = price === 0 ? 'not_required' : process.env.STRIPE_SECRET_KEY ? 'pending' : 'unconfigured'
  const status = price === 0 ? 'confirmed' : 'pending'

  // Resolve mentor email for notifications
  const mentorUser = db.prepare('SELECT email FROM users WHERE id = ?').get(mentor.user_id) as { email: string | null } | undefined
  const mentorEmail = mentorUser?.email || null
  const studentEmail = user.email || null

  try {
    db.exec('BEGIN')
    const clash = db
      .prepare(
        `SELECT id FROM bookings WHERE mentor_id = ? AND status IN ('confirmed','pending')
         AND start_at < ? AND end_at > ?`,
      )
      .get(mentor.id, end.toISOString(), start.toISOString())
    if (clash) {
      db.exec('ROLLBACK')
      return res.status(409).json({ error: 'That time was just booked by someone else.' })
    }
    db.prepare(
      `INSERT INTO bookings (id, mentor_id, mentee_id, service_id, mentor_email, student_email, start_at, end_at, timezone, status, payment_status, price_cents, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      bookingId,
      mentor.id,
      user.id,
      service.id,
      mentorEmail,
      studentEmail,
      start.toISOString(),
      end.toISOString(),
      timezone,
      status,
      paymentStatus,
      price,
      service.currency,
      nowIso(),
      nowIso(),
    )
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return res.status(500).json({ error: 'Could not reserve that time.' })
  }

  let calendarNote: string | null = null
  let meetLink: string | null = null

  if (status === 'confirmed') {
    const cal = await createMeetEvent({
      mentorUserId: mentor.user_id,
      menteeEmail: user.email,
      title: `${service.title} with ${mentor.full_name}`,
      description: 'HELPAMART session',
      start: start.toISOString(),
      end: end.toISOString(),
      timezone,
    })
    if (cal.ok) {
      meetLink = cal.meetLink || null
      db.prepare(
        `UPDATE bookings SET meet_link=?, calendar_event_id=?, calendar_status='created', updated_at=? WHERE id=?`,
      ).run(cal.meetLink, cal.eventId, nowIso(), bookingId)
    } else {
      calendarNote =
        cal.reason === 'not_configured'
          ? 'Your booking is confirmed. Google Calendar is not configured on this server, so a Meet link was not created.'
          : cal.reason === 'not_authorized'
            ? 'Your booking is confirmed. The mentor has not connected Google Calendar yet, so a Meet link is not available.'
            : 'Your booking was saved, but calendar connection needs attention.'
      db.prepare(`UPDATE bookings SET calendar_status=?, updated_at=? WHERE id=?`).run(cal.reason, nowIso(), bookingId)
    }

    // Send email notifications (non-blocking — errors are logged but do not fail the request)
    const emailDetails = {
      bookingId,
      mentorName: mentor.full_name,
      mentorEmail: mentorEmail || '',
      studentName: user.name || 'Student',
      studentEmail: studentEmail || '',
      serviceTitle: service.title,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      durationMinutes: service.duration_minutes,
      timezone,
      meetLink,
    }

    Promise.all([
      mentorEmail ? sendMentorBookingNotification(emailDetails) : Promise.resolve({ sent: false, reason: 'no_mentor_email' }),
      studentEmail ? sendStudentBookingConfirmation(emailDetails) : Promise.resolve({ sent: false, reason: 'no_student_email' }),
    ]).then(([mentorResult, studentResult]) => {
      console.log(`[BOOKING ${bookingId}] Email notifications — mentor: ${JSON.stringify(mentorResult)}, student: ${JSON.stringify(studentResult)}`)
    }).catch((err) => {
      console.error(`[BOOKING ${bookingId}] Email dispatch error:`, err)
    })
  } else if (paymentStatus === 'unconfigured') {
    calendarNote =
      'This session has a fee, but payments are not configured yet. The time is held as pending until a payment provider is connected.'
  }

  const rawBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as BookingRow
  res.json({ booking: serializeBooking(rawBooking), mentor: serializeMentor(mentor), service, calendarNote })
})

// ─── Mentor-specific booking routes ────────────────────────────────────────

app.get('/api/mentor/bookings/stats', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = db.prepare('SELECT id FROM mentor_profiles WHERE user_id = ?').get(user.id) as { id: string } | undefined
  if (!mentor) return res.json({ upcoming: 0, completed: 0 })
  const now = nowIso()
  const upcoming = (db.prepare(
    `SELECT COUNT(*) as c FROM bookings WHERE mentor_id = ? AND status IN ('confirmed','pending') AND start_at >= ?`
  ).get(mentor.id, now) as { c: number }).c
  const completed = (db.prepare(
    `SELECT COUNT(*) as c FROM bookings WHERE mentor_id = ? AND (status = 'completed' OR (status = 'confirmed' AND end_at < ?))`
  ).get(mentor.id, now) as { c: number }).c
  res.json({ upcoming, completed })
})

app.get('/api/mentor/bookings', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = db.prepare('SELECT id FROM mentor_profiles WHERE user_id = ?').get(user.id) as { id: string } | undefined
  if (!mentor) return res.json({ bookings: [] })
  const rows = db.prepare(
    `SELECT b.*, m.full_name as mentor_name, m.slug as mentor_slug, m.photo_url as mentor_photo,
            s.title as service_title, u.name as mentee_name
     FROM bookings b
     JOIN mentor_profiles m ON m.id = b.mentor_id
     JOIN mentor_services s ON s.id = b.service_id
     JOIN users u ON u.id = b.mentee_id
     WHERE b.mentor_id = ?
     ORDER BY b.start_at DESC`
  ).all(mentor.id)
  res.json({ bookings: (rows as BookingRow[]).map(serializeBooking) })
})

app.get('/api/bookings', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentor = db.prepare('SELECT id FROM mentor_profiles WHERE user_id = ?').get(user.id) as
    | { id: string }
    | undefined
  const rows = db
    .prepare(
      `SELECT b.*, m.full_name as mentor_name, m.slug as mentor_slug, m.photo_url as mentor_photo,
              s.title as service_title, u.name as mentee_name
       FROM bookings b
       JOIN mentor_profiles m ON m.id = b.mentor_id
       JOIN mentor_services s ON s.id = b.service_id
       JOIN users u ON u.id = b.mentee_id
       WHERE b.mentee_id = ? ${mentor ? 'OR b.mentor_id = ?' : ''}
       ORDER BY b.start_at DESC`,
    )
    .all(...(mentor ? [user.id, mentor.id] : [user.id]))
  res.json({ bookings: (rows as BookingRow[]).map(serializeBooking) })
})

app.post('/api/bookings/:id/cancel', async (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as
    | {
        id: string
        mentee_id: string
        mentor_id: string
        calendar_event_id: string | null
        start_at: string
        status: string
      }
    | undefined
  if (!booking) return res.status(404).json({ error: 'Booking not found.' })
  const mentor = db.prepare('SELECT user_id FROM mentor_profiles WHERE id = ?').get(booking.mentor_id) as {
    user_id: string
  }
  if (booking.mentee_id !== user.id && mentor.user_id !== user.id) {
    return res.status(403).json({ error: 'You cannot change this booking.' })
  }
  if (Date.parse(booking.start_at) < Date.now()) {
    return res.status(400).json({ error: 'Past sessions cannot be cancelled.' })
  }
  db.prepare(`UPDATE bookings SET status='cancelled' WHERE id=?`).run(booking.id)
  if (booking.calendar_event_id) {
    await cancelMeetEvent(mentor.user_id, booking.calendar_event_id)
  }
  res.json({ ok: true })
})

app.get('/api/community/stats', (_req, res) => {
  const postCount = (db.prepare('SELECT COUNT(*) as c FROM community_posts').get() as { c: number }).c
  const replyCount = (db.prepare('SELECT COUNT(*) as c FROM community_replies').get() as { c: number }).c
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
  res.json({ postCount, replyCount, userCount })
})

app.get('/api/community', (req, res) => {
  const category = req.query.category as string | undefined
  const search = (req.query.search as string | undefined)?.trim()
  const limit = Math.min(Number(req.query.limit || 50), 100)
  const me = currentUser(req)
  const userId = me ? me.id : null

  let rows: Record<string, unknown>[]
  if (category && category !== 'All') {
    rows = db.prepare(
      `SELECT p.*, u.name as author_name FROM community_posts p JOIN users u ON u.id = p.author_id
       WHERE p.category = ? ORDER BY p.created_at DESC LIMIT ?`
    ).all(category, limit) as Record<string, unknown>[]
  } else if (search) {
    const q = `%${search}%`
    rows = db.prepare(
      `SELECT p.*, u.name as author_name FROM community_posts p JOIN users u ON u.id = p.author_id
       WHERE p.title LIKE ? OR p.body LIKE ? ORDER BY p.created_at DESC LIMIT ?`
    ).all(q, q, limit) as Record<string, unknown>[]
  } else {
    rows = db.prepare(
      `SELECT p.*, u.name as author_name FROM community_posts p JOIN users u ON u.id = p.author_id
       ORDER BY p.created_at DESC LIMIT ?`
    ).all(limit) as Record<string, unknown>[]
  }

  const posts = rows.map((p) => {
    const replyCount = (db.prepare('SELECT COUNT(*) as c FROM community_replies WHERE post_id = ?').get(p.id as string) as { c: number }).c
    const likesCount = (db.prepare('SELECT COUNT(*) as c FROM community_likes WHERE post_id = ?').get(p.id as string) as { c: number }).c
    const likedByMe = userId
      ? !!(db.prepare('SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?').get(userId, p.id as string))
      : false
    return { ...p, replyCount, likesCount, likedByMe }
  })
  res.json({ posts })
})

app.get('/api/community/:id', (req, res) => {
  const post = db
    .prepare(`SELECT p.*, u.name as author_name FROM community_posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined
  if (!post) return res.status(404).json({ error: 'Discussion not found.' })
  const replies = db
    .prepare(`SELECT r.*, u.name as author_name FROM community_replies r JOIN users u ON u.id = r.author_id WHERE r.post_id = ? ORDER BY r.created_at ASC`)
    .all(req.params.id)
  const likesCount = (db.prepare('SELECT COUNT(*) as c FROM community_likes WHERE post_id = ?').get(req.params.id) as { c: number }).c
  const replyCount = (db.prepare('SELECT COUNT(*) as c FROM community_replies WHERE post_id = ?').get(req.params.id) as { c: number }).c
  res.json({ post: { ...post, likesCount, replyCount }, replies })
})

app.post('/api/community', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const { category, title, body } = req.body as { category?: string; title?: string; body?: string }
  if (!category || !title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Category, question, and details are required.' })
  }
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  db.prepare(`INSERT INTO community_posts (id, author_id, category, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, user.id, category, title.trim(), body.trim(), createdAt)
  res.json({
    post: {
      id, category, title: title.trim(), body: body.trim(),
      author_name: user.name, author_id: user.id,
      created_at: createdAt, replyCount: 0, likesCount: 0, likedByMe: false
    }
  })
})

app.post('/api/community/:id/replies', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const { body } = req.body as { body?: string }
  if (!body?.trim()) return res.status(400).json({ error: 'A reply is required.' })
  const post = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Discussion not found.' })
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  db.prepare(`INSERT INTO community_replies (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.params.id, user.id, body.trim(), createdAt)
  res.json({ reply: { id, post_id: req.params.id, author_id: user.id, author_name: user.name, body: body.trim(), created_at: createdAt } })
})

app.post('/api/community/:id/like', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const existing = db.prepare('SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?').get(user.id, req.params.id)
  if (existing) {
    db.prepare('DELETE FROM community_likes WHERE user_id = ? AND post_id = ?').run(user.id, req.params.id)
  } else {
    db.prepare(`INSERT INTO community_likes (user_id, post_id, created_at) VALUES (?, ?, ?)`).run(user.id, req.params.id, nowIso())
  }
  const likesCount = (db.prepare('SELECT COUNT(*) as c FROM community_likes WHERE post_id = ?').get(req.params.id) as { c: number }).c
  res.json({ liked: !existing, likesCount })
})

app.post('/api/community/:id/follow', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  db.prepare(
    `INSERT OR IGNORE INTO community_follows (user_id, post_id, created_at) VALUES (?, ?, ?)`,
  ).run(user.id, req.params.id, nowIso())
  res.json({ ok: true })
})

app.post('/api/saved/:mentorId', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  db.prepare(
    `INSERT OR IGNORE INTO saved_mentors (user_id, mentor_id, created_at) VALUES (?, ?, ?)`,
  ).run(user.id, req.params.mentorId, nowIso())
  res.json({ ok: true })
})

app.delete('/api/saved/:mentorId', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  db.prepare('DELETE FROM saved_mentors WHERE user_id = ? AND mentor_id = ?').run(
    user.id,
    req.params.mentorId,
  )
  res.json({ ok: true })
})

app.get('/api/saved', (req, res) => {
  const user = requireUser(req, res)
  if (!user) return
  const mentors = (
    db
      .prepare(
        `SELECT m.* FROM mentor_profiles m JOIN saved_mentors s ON s.mentor_id = m.id
         WHERE s.user_id = ? AND m.status = 'published'`,
      )
      .all(user.id) as MentorRow[]
  ).map((m) => serializeMentor(m))
  res.json({ mentors })
})

app.get('/api/stories', (_req, res) => {
  const stories = db.prepare('SELECT * FROM stories WHERE published = 1 ORDER BY created_at DESC').all()
  res.json({ stories })
})

app.get('/api/pricing', (_req, res) => {
  const fee = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(
    'platform_fee_percent',
  ) as { value: string }
  res.json({
    platformFeePercent: Number(fee.value),
    paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    note: 'Mentors set their own session prices. HELPA’s platform fee is configurable and is not a promise of earnings.',
  })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message || 'Something went wrong.' })
})

app.listen(PORT, () => {
  console.log(`HELPA API on http://127.0.0.1:${PORT}`)
})
