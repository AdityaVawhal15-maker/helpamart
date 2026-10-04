export type User = {
  id: string
  email: string | null
  phone: string | null
  name: string
  photoUrl: string | null
  bio: string | null
  location: string | null
  timezone: string
  languages: string[]
  interests: string[]
  title?: string
  company?: string
}

export type AvailabilityRule = {
  weekday: number
  startTime: string
  endTime: string
  enabled: boolean
}

export type MentorService = {
  id?: string
  title: string
  description: string
  durationMinutes: number
  priceCents: number
  currency: string
  format: string
  active?: boolean
}

export type Mentor = {
  id: string
  slug: string
  name: string
  role: string
  company: string
  location: string
  intro: string
  about: string
  photoUrl: string | null
  languages: string[]
  yearsExperience: number | null
  linkedinUrl: string | null
  websiteUrl: string | null
  education: string[]
  companies: string[]
  achievements: string[]
  status: 'draft' | 'published' | 'paused'
  timezone: string
  bufferMinutes: number
  advanceDays: number
  minNoticeHours: number
  maxBookingsPerDay: number
  categories: string[]
  skills: string[]
  services: MentorService[]
  availability: AvailabilityRule[]
  startingPriceCents: number | null
  availabilityPreview: string | null
  rating?: number
  reviewCount?: number
}

export type Booking = {
  id: string
  mentorId: string
  menteeId: string
  serviceId: string
  startAt: string
  endAt: string
  timezone: string
  status: string
  paymentStatus: string
  priceCents: number
  currency: string
  meetLink: string | null
  calendarEventId: string | null
  calendarStatus: string | null
  mentorName?: string
  mentorSlug?: string
  mentorPhoto?: string | null
  serviceTitle?: string
  menteeName?: string
}
