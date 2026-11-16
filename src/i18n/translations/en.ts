/**
 * HELPAMART — English (en) UI Translations
 * ==========================================
 * This is the reference/fallback translation.
 * Every key MUST exist in en.ts; other locales may omit keys and will
 * automatically fall back to English.
 */

const en = {
  // ── Navigation ────────────────────────────────────────────────
  nav: {
    findMentor:    'Find a Mentor',
    udaan30:       'Udaan 30',
    offerHelp:     'Offer Help',
    community:     'Community',
    howItWorks:    'How It Works',
    stories:       'Stories',
    pricing:       'Pricing',
    signIn:        'Sign In',
    getStarted:    'Get Started',
    myDashboard:   'My Dashboard',
    myBookings:    'My Bookings',
    profileSettings:'Profile Settings',
    mentorDashboard:'Mentor Dashboard',
    becomeAMentor: 'Become a Mentor',
    signOut:       'Sign Out',
    signedInAs:    'Signed in as',
    search:        'Search',
    searchPlaceholder: 'Search mentors, skills, topics…',
    trySearching:  'Try searching for',
    language:      'Language',
  },

  // ── Home ──────────────────────────────────────────────────────
  home: {
    heroTag:       'Discover',
    heroTitle:     'The mentor who moves\nyou forward.',
    heroSubtitle:  'Real people. Real experience. Real guidance.',
    ctaFindMentor: 'Find Your Mentor',
    ctaBecomeM:    'Become a Mentor',
    firstSessionFree: 'First session free',
  },

  // ── Find Mentor ───────────────────────────────────────────────
  findMentor: {
    discover:      'Discover',
    headline:      'Find the person\nwho can move you forward.',
    subheadline:   'Not just someone who knows. Someone who has been there.',
    searchPlaceholder: 'What are you trying to figure out?',
    searchBtn:     'Search',
    trySearching:  'Try:',
    filters:       'Filters',
    all:           'All',
    mentorshipLanguage: 'Mentorship Language',
    anyLanguage:   'Any Language',
    noMentors:     'No mentors found',
    mentorCount:   '{{count}} mentor',
    mentorCountPlural: '{{count}} mentors',
    for:           'for',
    in:            'in',
    clearAll:      'Clear all',
    viewProfile:   'View Profile',
    firstFree:     'First session free',
    noResultsTitle: 'No mentors matched your search.',
    noResultsBody:  'Try different keywords or browse all available mentors.',
    emptyTitle:    'Your next guide is waiting to be discovered.',
    emptyBody:     'No mentors have published their profile yet.',
    errorTitle:    'Could not load mentors',
    errorBody:     'There was a problem connecting to the database. Please try again.',
    tryAgain:      'Try Again',
    languagesSpoken: 'Languages',
  },

  // ── Booking ───────────────────────────────────────────────────
  booking: {
    confirmTitle:  'Confirm your session',
    confirmSub:    'Review the details below before booking.',
    session:       'Session',
    dateTime:      'Date & Time',
    total:         'Total',
    firstFreeNote: 'First session with this mentor — complimentary',
    subsequentNote:'Subsequent session with this mentor',
    calculating:   'Calculating…',
    googleMeetNote:'A Google Meet link will be generated automatically for your session.',
    confirmBtn:    'Confirm Booking',
    confirming:    'Confirming your session…',
    paymentTitle:  'Complete payment',
    paymentSub:    'Secure payment via Cashfree',
    paymentNote:   'Your booking will be confirmed after successful payment.',
    back:          'Back',
    // Session language
    sessionLanguage:       'Preferred Session Language',
    sessionLanguageHint:   'Choose the language for this mentorship session.',
    sessionLanguageLabel:  'Session Language',
    noCommonLang:          'No common preferred language. Select any language the mentor supports.',
  },

  // ── Mentor ────────────────────────────────────────────────────
  mentor: {
    languagesSpoken: 'Languages I Speak',
    primaryLang:   'Primary Language',
    additionalLangs:'Additional Languages',
    proficiency:   'Proficiency',
    commMode:      'Communication',
    langSection:   'Languages I Can Mentor In',
    langSectionDesc:'Help students connect with you in the language they feel most comfortable with. Select the languages in which you can confidently conduct mentorship sessions.',
    primaryRequired:'Please select at least one mentorship language.',
    addLanguage:   'Add a language',
    selectProficiency: 'Select proficiency',
    removeLanguage:'Remove',
  },

  // ── Dashboard (Student) ────────────────────────────────────────
  dashboard: {
    welcome:       'Welcome back',
    upcomingSessions: 'Upcoming Sessions',
    pastSessions:  'Past Sessions',
    noUpcoming:    'No upcoming sessions.',
    noPast:        'No past sessions.',
    bookNow:       'Book a Session',
  },

  // ── Profile ────────────────────────────────────────────────────
  profile: {
    title:         'Profile Settings',
    profilePhoto:  'Profile Photo',
    fullName:      'Full Name',
    email:         'Email',
    emailNote:     'Email cannot be changed here.',
    saveChanges:   'Save Changes',
    saving:        'Saving…',
    saved:         'Profile updated.',
    // Mentorship preferences section
    mentorshipPrefs: 'Mentorship Language Preferences',
    mentorshipPrefsDesc: 'Set the languages you prefer for your mentorship sessions. This helps us match you with mentors who speak your language.',
    primaryPrefLang: 'Primary Preferred Language',
    additionalPrefLangs: 'Additional Preferred Languages',
    noPrimarySelected: 'None selected',
    searchLanguages: 'Search languages…',
    uiLanguage:    'Website Language',
    uiLanguageDesc:'Choose the language for the website interface.',
  },

  // ── Mentor Onboarding / Dashboard ─────────────────────────────
  mentorDash: {
    editProfile:   'Edit Profile',
    profileSaved:  'Profile updated!',
    langPrefs:     'Mentorship Languages',
    langSaved:     'Languages updated.',
  },

  // ── Common ────────────────────────────────────────────────────
  common: {
    loading:       'Loading…',
    error:         'Something went wrong.',
    retry:         'Try Again',
    cancel:        'Cancel',
    save:          'Save',
    close:         'Close',
    remove:        'Remove',
    optional:      'Optional',
    required:      'Required',
    native:        'Native / Fluent',
    professional:  'Professional Proficiency',
    conversational:'Conversational',
    basic:         'Basic Understanding',
    both:          'Both',
    spoken:        'Spoken',
    written:       'Written',
  },
}

export default en
export type TranslationSchema = typeof en

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

export type LocaleTranslation = DeepPartial<TranslationSchema>
