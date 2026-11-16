/**
 * HELPAMART — Mentorship Language Selector
 * ==========================================
 * Reusable component for selecting mentorship languages with proficiency
 * and communication mode per language.
 *
 * Used in:
 *  - BecomeMentor form (mentor onboarding)
 *  - MentorProfileEdit (existing mentors update)
 *
 * Features:
 *  - Searchable dropdown over ALL 33 supported languages
 *  - Shows selected languages as removable chips
 *  - Per-language: proficiency level + communication mode
 *  - Native scripts displayed correctly (RTL for Urdu/Kashmiri)
 *
 * Props:
 *  value     — array of MentorLanguageEntry currently selected
 *  onChange  — callback when the list changes
 *  disabled  — optional, disables all interaction
 */

import { useRef, useState, useEffect } from 'react'
import { ChevronDown, X, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import {
  ALL_MENTORSHIP_LANGUAGES,
  PROFICIENCY_LEVELS,
  COMMUNICATION_MODES,
  LANGUAGE_BY_CODE,
  type MentorLanguageEntry,
  type ProficiencyLevel,
  type CommunicationMode,
} from '@/i18n/catalogue'

interface Props {
  value: MentorLanguageEntry[]
  onChange: (value: MentorLanguageEntry[]) => void
  disabled?: boolean
  label?: string
  description?: string
}

export function MentorshipLanguageSelector({
  value,
  onChange,
  disabled = false,
  label = 'Languages I Can Mentor In',
  description = 'Select the languages in which you can confidently conduct mentorship sessions.',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedCodes = new Set(value.map(e => e.code))

  const filtered = ALL_MENTORSHIP_LANGUAGES.filter(lang => {
    if (selectedCodes.has(lang.code)) return false // already selected — don't show in dropdown
    if (!search) return true
    const q = search.toLowerCase()
    return lang.english.toLowerCase().includes(q) || lang.native.toLowerCase().includes(q)
  })

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60)
    else setSearch('')
  }, [open])

  function addLanguage(code: string) {
    if (selectedCodes.has(code) || disabled) return
    onChange([...value, { code, proficiency: 'professional', mode: 'both' }])
    setSearch('')
    setOpen(false)
  }

  function removeLanguage(code: string) {
    if (disabled) return
    onChange(value.filter(e => e.code !== code))
  }

  function updateEntry(
    code: string,
    field: 'proficiency' | 'mode',
    val: ProficiencyLevel | CommunicationMode
  ) {
    if (disabled) return
    onChange(value.map(e => e.code === code ? { ...e, [field]: val } : e))
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Label + description */}
      <div>
        <label className="field-label">{label}</label>
        {description && (
          <p className="text-xs text-grey mt-1">{description}</p>
        )}
      </div>

      {/* Selected language chips with proficiency/mode controls */}
      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((entry, idx) => {
            const langEntry = LANGUAGE_BY_CODE[entry.code]
            if (!langEntry) return null
            return (
              <motion.div
                key={entry.code}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="bg-ivory-light border border-grey-soft rounded-xl p-4"
              >
                {/* Chip header: language name + remove */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span
                      className="font-semibold text-navy text-sm"
                      lang={langEntry.code}
                      dir={langEntry.rtl ? 'rtl' : 'ltr'}
                    >
                      {langEntry.native}
                    </span>
                    {langEntry.code !== 'en' && (
                      <span className="text-xs text-grey ml-2">— {langEntry.english}</span>
                    )}
                    {idx === 0 && (
                      <span className="ml-2 text-[0.625rem] font-semibold uppercase tracking-widest text-gold border border-gold/30 rounded px-1.5 py-0.5">
                        Primary
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLanguage(entry.code)}
                    disabled={disabled}
                    className="text-grey hover:text-maroon transition-colors shrink-0 cursor-pointer disabled:opacity-40"
                    aria-label={`Remove ${langEntry.english}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Proficiency select */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[0.6875rem] font-medium text-grey uppercase tracking-wider block mb-1">
                      Proficiency
                    </label>
                    <select
                      value={entry.proficiency}
                      onChange={e => updateEntry(entry.code, 'proficiency', e.target.value as ProficiencyLevel)}
                      disabled={disabled}
                      className="field-input text-sm py-2 cursor-pointer"
                      aria-label={`Proficiency in ${langEntry.english}`}
                    >
                      {PROFICIENCY_LEVELS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[0.6875rem] font-medium text-grey uppercase tracking-wider block mb-1">
                      Communication
                    </label>
                    <select
                      value={entry.mode}
                      onChange={e => updateEntry(entry.code, 'mode', e.target.value as CommunicationMode)}
                      disabled={disabled}
                      className="field-input text-sm py-2 cursor-pointer"
                      aria-label={`Communication mode for ${langEntry.english}`}
                    >
                      {COMMUNICATION_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add language dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={clsx(
            'flex items-center gap-2 w-full px-4 py-3 rounded-xl border text-sm font-medium font-nav transition-all duration-200 cursor-pointer',
            open
              ? 'border-navy bg-white text-navy shadow-[0_0_0_3px_rgba(7,26,53,0.06)]'
              : 'border-dashed border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy bg-white/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="text-gold">+</span>
          <span>Add a language…</span>
          <ChevronDown
            className={clsx('h-4 w-4 ml-auto transition-transform duration-200', open && 'rotate-180')}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-grey-soft overflow-hidden z-30"
            >
              {/* Search */}
              <div className="px-3 pt-3 pb-2 border-b border-grey-soft">
                <div className="flex items-center gap-2 bg-ivory-dark rounded-xl px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-grey shrink-0" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search languages…"
                    className="flex-1 bg-transparent text-sm text-navy placeholder-grey outline-none font-nav"
                    aria-label="Search languages to add"
                  />
                </div>
              </div>

              {/* Results */}
              <ul
                role="listbox"
                aria-label="Select a language to add"
                className="py-1 max-h-52 overflow-y-auto"
              >
                {filtered.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-grey text-center">
                    No languages found
                  </li>
                ) : (
                  filtered.map(lang => (
                    <li key={lang.code} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => addLanguage(lang.code)}
                        className="w-full text-left px-4 py-2.5 hover:bg-ivory-dark transition-colors flex items-center gap-3"
                        dir={lang.rtl ? 'rtl' : 'ltr'}
                      >
                        <span className="flex flex-col min-w-0">
                          <span
                            className="text-sm font-medium text-navy font-nav"
                            lang={lang.code}
                          >
                            {lang.native}
                          </span>
                          {lang.code !== 'en' && (
                            <span className="text-xs text-grey font-nav">{lang.english}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Helper text */}
      {value.length === 0 && (
        <p className="text-xs text-grey">
          The first language you add will be your primary mentorship language.
        </p>
      )}
    </div>
  )
}

/**
 * Utility: serialize MentorLanguageEntry[] to a plain string[] for the
 * existing mentors.languages column (backward-compatible).
 * Just extracts the language codes.
 */
export function mentorLangEntriesToStringArray(entries: MentorLanguageEntry[]): string[] {
  return entries.map(e => {
    const lang = LANGUAGE_BY_CODE[e.code]
    return lang ? lang.english : e.code
  })
}

/**
 * Utility: deserialize the existing mentors.language_details JSONB column.
 * Falls back to creating native/professional entries from the legacy
 * string languages array when the JSONB column is absent.
 */
export function parseMentorLanguageEntries(
  languageDetails?: MentorLanguageEntry[] | null,
  legacyLanguages?: string[]
): MentorLanguageEntry[] {
  if (Array.isArray(languageDetails) && languageDetails.length > 0) {
    return languageDetails
  }
  // Migrate from legacy string array
  if (Array.isArray(legacyLanguages)) {
    return legacyLanguages.map(name => {
      // Find by English name
      const entry = ALL_MENTORSHIP_LANGUAGES.find(l =>
        l.english.toLowerCase() === name.toLowerCase() ||
        l.native === name
      )
      return {
        code: entry?.code ?? 'en',
        proficiency: 'native' as ProficiencyLevel,
        mode: 'both' as CommunicationMode,
      }
    }).filter((e, idx, arr) => arr.findIndex(a => a.code === e.code) === idx)
  }
  return []
}

/**
 * Display helper: format a MentorLanguageEntry[] into a human-readable
 * list string for mentor cards / profile pages.
 * e.g. "Hindi (Native/Fluent), Marathi (Conversational)"
 */
export function formatMentorLanguages(entries: MentorLanguageEntry[]): string {
  return entries.map(e => {
    const lang = LANGUAGE_BY_CODE[e.code]
    const name = lang?.english ?? e.code
    const prof = PROFICIENCY_LEVELS.find(p => p.value === e.proficiency)?.label ?? e.proficiency
    return `${name} (${prof})`
  }).join(', ')
}

/**
 * Display helper: return just an array of display strings for the
 * compact "Languages I Speak" pill row on mentor cards.
 */
export function languageChips(entries: MentorLanguageEntry[]): string[] {
  return entries.map(e => {
    const lang = LANGUAGE_BY_CODE[e.code]
    return lang?.english ?? e.code
  })
}
