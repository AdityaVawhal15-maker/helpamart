import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Menu, ChevronDown, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { NotificationBell } from './ui/NotificationBell'
import clsx from 'clsx'

const NAV_LINKS = [
  { label: 'Find a Mentor', to: '/find-mentor' },
  { label: 'Offer Help', to: '/offer-help' },
  { label: 'Community', to: '/community' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Stories', to: '/stories' },
  { label: 'Pricing', to: '/pricing' },
]

type Props = { transparent?: boolean }

export default function Navbar({ transparent = false }: Props) {
  const { user, mentor, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Scroll detection
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close mobile menu on resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Escape key & ⌘K / Ctrl+K search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setSearchOpen(false)
        setUserMenuOpen(false)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Outside click user menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search on open
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 100)
  }, [searchOpen])

  const isTransparent = transparent && !scrolled && !mobileOpen && !searchOpen

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/find-mentor?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  async function handleLogout() {
    await logout()
    setUserMenuOpen(false)
    navigate('/')
  }

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      <header
        className={clsx(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-out',
          isTransparent
            ? 'bg-transparent'
            : 'bg-ivory-light/92 backdrop-blur-xl border-b border-navy/[0.06] shadow-[0_4px_24px_-4px_rgba(7,26,53,0.04)]'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[70px] flex items-center justify-between gap-4 lg:gap-8">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center shrink-0 group transition-all duration-200 hover:opacity-95"
            aria-label="HELPAMART home"
          >
            <img
              src="/helpamart-logo.png"
              alt="HELPAMART"
              className="h-11 sm:h-12 w-auto object-contain transition-transform duration-250 ease-out group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Nav */}
          <nav
            className="hidden lg:flex items-center gap-1 ml-2 flex-1 justify-center"
            aria-label="Main"
            onMouseLeave={() => setHoveredNav(null)}
          >
            <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-navy/[0.02] border border-navy/[0.03]">
              {NAV_LINKS.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onMouseEnter={() => setHoveredNav(link.to)}
                  className={({ isActive }) => clsx(
                    'relative px-3.5 py-1.5 text-[13.5px] font-nav font-medium rounded-xl transition-colors duration-200 select-none group',
                    isActive
                      ? 'text-navy font-semibold'
                      : 'text-navy/70 hover:text-navy'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {/* Fluid gliding hover pill backdrop */}
                      {hoveredNav === link.to && (
                        <motion.span
                          layoutId="nav-hover-pill"
                          className="absolute inset-0 rounded-xl bg-navy/[0.05] pointer-events-none"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}

                      {/* Label with micro upward movement on hover */}
                      <span className="relative z-10 inline-block transition-transform duration-200 ease-out group-hover:-translate-y-[0.5px]">
                        {link.label}
                      </span>

                      {/* Active persistent accent underline */}
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-indicator"
                          className="absolute -bottom-0.5 left-3 right-3 h-[2px] bg-gradient-to-r from-gold/80 via-gold to-gold/80 rounded-full shadow-[0_1px_4px_rgba(183,122,34,0.35)]"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        />
                      )}

                      {/* Non-active subtle expanding underline on hover */}
                      {!isActive && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[1.5px] bg-navy/25 rounded-full w-0 group-hover:w-[calc(100%-1.5rem)] transition-all duration-250 ease-out pointer-events-none" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 h-9 px-2.5 rounded-xl border border-navy/[0.08] hover:border-gold/40 bg-white/40 hover:bg-white/90 text-navy/60 hover:text-navy shadow-[0_1px_2px_rgba(7,26,53,0.02)] hover:shadow-[0_2px_8px_rgba(7,26,53,0.06)] transition-all duration-200 group cursor-pointer"
              aria-label="Search mentors"
            >
              <Search className="h-3.5 w-3.5 text-navy/50 group-hover:text-gold transition-all duration-200 group-hover:scale-110" />
              <span className="text-xs font-nav text-navy/55 group-hover:text-navy/85 tracking-tight transition-colors">Search</span>
              <kbd className="hidden md:inline-flex items-center text-[10px] font-sans font-medium text-navy/40 bg-navy/[0.04] group-hover:bg-gold/10 group-hover:text-gold px-1.5 py-0.5 rounded transition-colors">
                ⌘K
              </kbd>
            </button>

            {/* Notification bell */}
            {user && <NotificationBell />}

            {user ? (
              /* User menu */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-ivory-dark transition-all duration-200 group cursor-pointer"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-transparent group-hover:ring-gold/30 transition-all">
                    {user.photoUrl
                      ? <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                      : initials
                    }
                  </div>
                  <span className="hidden sm:block text-sm font-medium font-nav text-navy max-w-[100px] truncate">
                    {user.name || 'Account'}
                  </span>
                  <ChevronDown className={clsx(
                    'h-3.5 w-3.5 text-grey transition-transform duration-200 hidden sm:block',
                    userMenuOpen && 'rotate-180'
                  )} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-lg border border-grey-soft overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-grey-soft">
                        <p className="text-xs text-grey font-nav">Signed in as</p>
                        <p className="text-sm font-semibold font-nav text-navy truncate">{user.name}</p>
                      </div>
                      <div className="py-1.5">
                        <UserMenuItem to="/dashboard" label="My Dashboard" onClick={() => setUserMenuOpen(false)} />
                        <UserMenuItem to="/dashboard/bookings" label="My Bookings" onClick={() => setUserMenuOpen(false)} />
                        <UserMenuItem to="/dashboard/profile" label="Profile Settings" onClick={() => setUserMenuOpen(false)} />
                        {mentor && (
                          <>
                            <div className="mx-4 my-1.5 h-px bg-grey-soft" />
                            <UserMenuItem to="/mentor-dashboard" label="Mentor Dashboard" onClick={() => setUserMenuOpen(false)} />
                          </>
                        )}
                        {!mentor && (
                          <>
                            <div className="mx-4 my-1.5 h-px bg-grey-soft" />
                            <UserMenuItem to="/become-a-mentor" label="Become a Mentor" onClick={() => setUserMenuOpen(false)} />
                          </>
                        )}
                        <div className="mx-4 my-1.5 h-px bg-grey-soft" />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm font-nav text-maroon hover:bg-ivory-dark transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center px-3.5 py-2 text-sm font-medium font-nav text-navy/75 hover:text-navy transition-all duration-200 hover:-translate-y-0.5 relative group rounded-lg"
                >
                  <span>Sign In</span>
                  <span className="absolute bottom-1.5 left-3.5 right-3.5 h-[1.5px] bg-gold scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-full" />
                </Link>
                <Link
                  to="/signup"
                  className="relative inline-flex items-center gap-1.5 bg-navy hover:bg-navy-mid text-white px-4.5 py-2 rounded-xl text-sm font-semibold font-nav shadow-[0_2px_8px_rgba(7,26,53,0.12)] hover:shadow-[0_8px_22px_rgba(7,26,53,0.24)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_6px_rgba(7,26,53,0.12)] border border-white/10 transition-all duration-200 group overflow-hidden"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
                  <span className="relative z-10">Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5 relative z-10 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl text-navy hover:bg-navy/[0.05] active:scale-95 transition-all ml-1 cursor-pointer"
              onClick={() => setMobileOpen(v => !v)}
              aria-expanded={mobileOpen}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
            onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}
          >
            <motion.form
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSearch}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-grey-soft">
                <Search className="h-5 w-5 text-gold shrink-0" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search mentors, skills, topics…"
                  className="flex-1 bg-transparent text-navy placeholder-grey outline-none text-base font-nav"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-grey hover:text-navy transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs text-grey mb-2 font-medium font-nav">Try searching for</p>
                <div className="flex flex-wrap gap-2">
                  {['Career change', 'Interview prep', 'Starting a company', 'Learning AI', 'Study abroad'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSearchQuery(s); navigate(`/find-mentor?q=${encodeURIComponent(s)}`); setSearchOpen(false) }}
                      className="text-xs px-3 py-1.5 bg-ivory-dark rounded-full text-navy font-nav hover:text-gold transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-navy/30 backdrop-blur-xs z-30 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-full bg-ivory-light z-40 lg:hidden flex flex-col shadow-2xl"
              aria-label="Mobile menu"
            >
              <div className="flex items-center justify-between px-6 h-16 sm:h-[70px] border-b border-grey-soft">
                <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center" aria-label="HELPAMART home">
                  <img
                    src="/helpamart-logo.png"
                    alt="HELPAMART"
                    className="h-10 w-auto object-contain"
                  />
                </Link>
                <button onClick={() => setMobileOpen(false)} className="text-grey hover:text-navy cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                {NAV_LINKS.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => clsx(
                      'flex items-center justify-between px-6 py-3.5 text-base font-nav font-medium transition-all duration-200 group',
                      isActive
                        ? 'text-navy font-semibold bg-ivory-dark/70 border-l-3 border-gold pl-[21px]'
                        : 'text-navy/75 hover:text-navy hover:bg-ivory-dark/40'
                    )}
                  >
                    <span>{link.label}</span>
                    <span className="text-xs text-grey/50 group-hover:text-gold transition-colors">→</span>
                  </NavLink>
                ))}

                <div className="mx-6 my-4 h-px bg-grey-soft" />

                <button
                  onClick={() => { setSearchOpen(true); setMobileOpen(false) }}
                  className="flex items-center gap-2 px-6 py-3 w-full text-left text-navy hover:text-gold transition-colors font-nav cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-base font-medium">Search</span>
                </button>
              </div>

              <div className="px-6 py-6 border-t border-grey-soft space-y-3">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-ivory-dark text-navy font-nav font-medium text-sm"
                    >
                      <span>{user.name || 'My Account'}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full py-2.5 text-sm font-nav text-maroon font-medium text-center cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full text-center py-2.5 border border-navy/15 rounded-xl text-navy font-nav font-semibold text-sm hover:border-gold/50 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full text-center py-2.5 bg-navy text-white rounded-xl font-nav font-semibold text-sm hover:bg-navy-mid transition-colors shadow-sm"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Spacer (non-transparent pages only) */}
      {!transparent && <div className="h-16 sm:h-[70px]" />}
    </>
  )
}

function UserMenuItem({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-2 text-sm font-nav text-navy hover:bg-ivory-dark transition-colors"
    >
      {label}
    </Link>
  )
}
