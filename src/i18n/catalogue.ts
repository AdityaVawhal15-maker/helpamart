/**
 * HELPAMART LANGUAGE CATALOGUE
 * ============================================================
 * Single source of truth for every language supported on the platform.
 *
 * TWO DISTINCT PURPOSES — these are independent systems:
 *
 *   1. WEBSITE INTERFACE LANGUAGE — which language the UI renders in.
 *      Stored in profiles.ui_language (or localStorage for guests).
 *
 *   2. MENTORSHIP SESSION LANGUAGE — in which language a mentor can
 *      conduct a session. Stored in mentors.mentor_languages (JSONB).
 *
 * This catalogue is shared by both systems.
 */

export interface LanguageEntry {
  /** BCP-47 / IETF language code used as the stable key */
  code: string
  /** Display name in English */
  english: string
  /** Display name in the native script */
  native: string
  /** Whether the script is RTL */
  rtl?: boolean
  /** Whether a full UI translation exists; false → English fallback for UI */
  uiSupported: boolean
}

/**
 * All 33 languages supported on HELPAMART.
 * uiSupported = true  → translations are present in src/i18n/translations/
 * uiSupported = false → mentorship sessions only; UI falls back to English
 */
export const LANGUAGE_CATALOGUE: LanguageEntry[] = [
  { code: 'en',  english: 'English',              native: 'English',                uiSupported: true  },
  { code: 'hi',  english: 'Hindi',                native: 'हिन्दी',                 uiSupported: true  },
  { code: 'mr',  english: 'Marathi',              native: 'मराठी',                  uiSupported: true  },
  { code: 'bho', english: 'Bhojpuri',             native: 'भोजपुरी',                uiSupported: false },
  { code: 'mai', english: 'Maithili',             native: 'मैथिली',                 uiSupported: false },
  { code: 'bn',  english: 'Bengali',              native: 'বাংলা',                  uiSupported: true  },
  { code: 'ta',  english: 'Tamil',                native: 'தமிழ்',                  uiSupported: true  },
  { code: 'te',  english: 'Telugu',               native: 'తెలుగు',                 uiSupported: true  },
  { code: 'gu',  english: 'Gujarati',             native: 'ગુજરાતી',                uiSupported: true  },
  { code: 'pa',  english: 'Punjabi',              native: 'ਪੰਜਾਬੀ',                 uiSupported: true  },
  { code: 'kn',  english: 'Kannada',              native: 'ಕನ್ನಡ',                  uiSupported: true  },
  { code: 'ml',  english: 'Malayalam',            native: 'മലയാളം',                 uiSupported: true  },
  { code: 'or',  english: 'Odia',                 native: 'ଓଡ଼ିଆ',                   uiSupported: false },
  { code: 'as',  english: 'Assamese',             native: 'অসমীয়া',                uiSupported: false },
  { code: 'ur',  english: 'Urdu',                 native: 'اردو',                   rtl: true, uiSupported: false },
  { code: 'sa',  english: 'Sanskrit',             native: 'संस्कृतम्',               uiSupported: false },
  { code: 'ks',  english: 'Kashmiri',             native: 'کٲشُر',                  rtl: true, uiSupported: false },
  { code: 'sd',  english: 'Sindhi',                native: 'سنڌي',                   rtl: true, uiSupported: false },
  { code: 'kok', english: 'Konkani',              native: 'कोंकणी',                 uiSupported: false },
  { code: 'mni', english: 'Manipuri (Meitei)',    native: 'ꯃꯩꯇꯩꯂꯣꯟ',               uiSupported: false },
  { code: 'ne',  english: 'Nepali',               native: 'नेपाली',                 uiSupported: false },
  { code: 'brx', english: 'Bodo',                 native: 'बड़ो',                   uiSupported: false },
  { code: 'doi', english: 'Dogri',                native: 'डोगरी',                  uiSupported: false },
  { code: 'sat', english: 'Santali',              native: 'ᱥᱟᱱᱛᱟᱲᱤ',              uiSupported: false },
  { code: 'mag', english: 'Magahi',               native: 'मगही',                   uiSupported: false },
  { code: 'bgc', english: 'Haryanvi',             native: 'हरियाणवी',               uiSupported: false },
  { code: 'raj', english: 'Rajasthani',           native: 'राजस्थानी',              uiSupported: false },
  { code: 'hne', english: 'Chhattisgarhi',        native: 'छत्तीसगढ़ी',             uiSupported: false },
  { code: 'tcy', english: 'Tulu',                 native: 'ತುಳು',                   uiSupported: false },
  { code: 'gbm', english: 'Garhwali',             native: 'गढ़वाली',                uiSupported: false },
  { code: 'kfy', english: 'Kumaoni',              native: 'कुमाऊँनी',               uiSupported: false },
  { code: 'awa', english: 'Awadhi',               native: 'अवधी',                   uiSupported: false },
  { code: 'mwr', english: 'Marwari',              native: 'मारवाड़ी',               uiSupported: false },
  { code: 'bns', english: 'Bundeli',              native: 'बुन्देली',               uiSupported: false },
]

/** Quick lookup: code → entry */
export const LANGUAGE_BY_CODE: Record<string, LanguageEntry> = Object.fromEntries(
  LANGUAGE_CATALOGUE.map(l => [l.code, l])
)

/** All languages that have UI translations */
export const UI_SUPPORTED_LANGUAGES = LANGUAGE_CATALOGUE.filter(l => l.uiSupported)

/** All languages usable as mentorship session languages */
export const ALL_MENTORSHIP_LANGUAGES = LANGUAGE_CATALOGUE

/**
 * Returns the display label shown in the language selector:
 *   "हिन्दी — Hindi"  (non-English)
 *   "English"          (English)
 */
export function languageDisplayLabel(entry: LanguageEntry): string {
  if (entry.code === 'en') return 'English'
  return `${entry.native} — ${entry.english}`
}

/**
 * Returns the short chip label used for selected chips (native script only).
 */
export function languageChipLabel(entry: LanguageEntry): string {
  if (entry.code === 'en') return 'English'
  return entry.native
}

/** Proficiency levels for mentorship languages */
export const PROFICIENCY_LEVELS = [
  { value: 'native',         label: 'Native / Fluent' },
  { value: 'professional',   label: 'Professional Proficiency' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'basic',          label: 'Basic Understanding' },
] as const

export type ProficiencyLevel = typeof PROFICIENCY_LEVELS[number]['value']

/** Communication preferences */
export const COMMUNICATION_MODES = [
  { value: 'both',    label: 'Both (Spoken & Written)' },
  { value: 'spoken',  label: 'Spoken' },
  { value: 'written', label: 'Written' },
] as const

export type CommunicationMode = typeof COMMUNICATION_MODES[number]['value']

/** A single mentorship language entry with metadata */
export interface MentorLanguageEntry {
  code: string
  proficiency: ProficiencyLevel
  mode: CommunicationMode
}
