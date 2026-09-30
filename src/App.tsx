import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ToastProvider } from '@/components/ui/Toast'

// Lazy load all pages for performance
const Home = lazy(() => import('@/pages/Home'))
const FindMentor = lazy(() => import('@/pages/FindMentor'))
const MentorProfile = lazy(() => import('@/pages/MentorProfile'))
const BecomeMentor = lazy(() => import('@/pages/BecomeMentor'))
const BookingFlow = lazy(() => import('@/pages/BookingFlow'))
const HowItWorks = lazy(() => import('@/pages/HowItWorks'))
const Community = lazy(() => import('@/pages/Community'))
const CommunityPost = lazy(() => import('@/pages/CommunityPost'))
const Stories = lazy(() => import('@/pages/Stories'))
const Pricing = lazy(() => import('@/pages/Pricing'))
const Login = lazy(() => import('@/pages/Login'))
const Signup = lazy(() => import('@/pages/Signup'))
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const DashboardBookings = lazy(() => import('@/pages/dashboard/Bookings'))
const DashboardProfile = lazy(() => import('@/pages/dashboard/Profile'))
const DashboardSettings = lazy(() => import('@/pages/dashboard/Settings'))
const MentorDashboard = lazy(() => import('@/pages/mentor-dashboard/MentorDashboard'))
const MentorBookings = lazy(() => import('@/pages/mentor-dashboard/MentorBookings'))
const MentorAvailability = lazy(() => import('@/pages/mentor-dashboard/MentorAvailability'))
const MentorServices = lazy(() => import('@/pages/mentor-dashboard/MentorServices'))
const MentorProfileEdit = lazy(() => import('@/pages/mentor-dashboard/MentorProfileEdit'))

// Pages that use a transparent navbar initially
const HERO_PAGES = ['/']

// Pages that should not show navbar/footer
const BARE_PAGES = ['/login', '/signup']

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
        <span className="text-sm text-grey font-medium tracking-wide">Loading…</span>
      </div>
    </div>
  )
}

function ScrollRestoration() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const isBare = BARE_PAGES.some(p => pathname.startsWith(p))
  const isHeroPage = HERO_PAGES.includes(pathname)

  return (
    <ToastProvider>
      <ScrollRestoration />
      {!isBare && <Navbar transparent={isHeroPage} />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/find-mentor" element={<FindMentor />} />
          <Route path="/mentor/:slug" element={<MentorProfile />} />
          <Route path="/mentor/:slug/book" element={<BookingFlow />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<CommunityPost />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/become-a-mentor" element={<BecomeMentor />} />
          <Route path="/offer-help" element={<BecomeMentor />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/bookings" element={<DashboardBookings />} />
          <Route path="/dashboard/profile" element={<DashboardProfile />} />
          <Route path="/dashboard/settings" element={<DashboardSettings />} />
          <Route path="/mentor-dashboard" element={<MentorDashboard />} />
          <Route path="/mentor-dashboard/bookings" element={<MentorBookings />} />
          <Route path="/mentor-dashboard/availability" element={<MentorAvailability />} />
          <Route path="/mentor-dashboard/services" element={<MentorServices />} />
          <Route path="/mentor-dashboard/profile" element={<MentorProfileEdit />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!isBare && <Footer />}
    </ToastProvider>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory">
      <div className="text-center max-w-md mx-auto px-6">
        <p className="text-sm font-semibold tracking-widest text-gold uppercase mb-4">404</p>
        <h1 className="text-display-xl text-navy mb-4">
          This page doesn't exist.
        </h1>
        <p className="text-grey mb-8">
          The page you're looking for has moved or doesn't exist.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold hover:bg-navy-mid transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
