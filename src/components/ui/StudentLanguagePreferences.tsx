/**
 * HELPAMART — Student Mentorship Language Preferences
 * ======================================================
 * Renders a small section in the student's Profile Settings page.
 * Completely optional — existing students are not forced to fill this in.
 *
 * Fields:
 *  - Primary preferred language (single select, optional for the student)
 *  - Additional preferred languages (multi-select)
 *
 * Data is stored in profiles.student_lang_primary (text) and
 * profiles.student_lang_additional (text[]) via Supabase direct update.
 */

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ALL_MENTORSHIP_LANGUAGES,
  LANGUAGE_BY_CODE,
  languageDisplayLabel,
} from '@/i18n/catalogue'

interface PrefsState {
  primaryCode: string    // language code, '' = not set
  additionalCodes: string[]
}

export function StudentLanguagePreferences() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<PrefsState>({ primaryCode: '', additionalCodes: [] })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [additionalOpen, setAdditionalOpen] = useState(false)
  const [additionalSearch, setAdditionalSearch] = useState('')
  const addContainerRef = useRef<HTMLDivElement>(null)
  const addSearchRef = useRef<HTMLInputElement>(null)

  // ── Load existing preferences ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('profiles')
      .select('student_lang_primary, student_lang_additional')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[StudentLangPrefs] load error', error)
          return
        }
        if (data) {
          setPrefs({
            primaryCode: (data as any).student_lang_primary ?? '',
            additionalCodes: Array.isArray((data as any).student_lang_additional)
              ? (data as any).student_lang_additional
              : [],
          })
        }
        setLoaded(true)
      })
  }, [user?.id])

  // ── Save preferences ───────────────────────────────────────────
  async function save() {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          student_lang_primary: prefs.primaryCode || null,
          student_lang_additional: prefs.additionalCodes,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id)

      if (error) throw error
      toast('Language preferences saved.', 'success')
    } catch (err: any) {
      console.error('[StudentLangPrefs] save error', err)
      toast(err?.message || 'Could not save language preferences.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Outside click for additional dropdown ──────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addContainerRef.current && !addContainerRef.current.contains(e.target as Node)) {
        setAdditionalOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (additionalOpen) setTimeout(() => addSearchRef.current?.focus(), 60)
    else setAdditionalSearch('')
  }, [additionalOpen])

  // ── Helpers ────────────────────────────────────────────────────
  function setPrimary(code: string) {
    setPrefs(p => ({
      ...p,
      primaryCode: code,
      // Remove from additional if it was there
      additionalCodes: p.additionalCodes.filter(c => c !== code),
    }))
  }

  function toggleAdditional(code: string) {
    // Can't add if it's the primary
    if (code === prefs.primaryCode) return
    setPrefs(p => ({
      ...p,
      additionalCodes: p.additionalCodes.includes(code)
        ? p.additionalCodes.filter(c => c !== code)
        : [...p.additionalCodes, code],
    }))
  }

  function removeAdditional(code: string) {
    setPrefs(p => ({ ...p, additionalCodes: p.additionalCodes.filter(c => c !== code) }))
  }

  // Available for additional (not primary)
  const additionalFiltered = ALL_MENTORSHIP_LANGUAGES.filter(lang => {
    if (lang.code === prefs.primaryCode) return false
    if (!additionalSearch) return true
    const q = additionalSearch.toLowerCase()
    return lang.english.toLowerCase().includes(q) || lang.native.toLowerCase().includes(q)
  })

  if (!loaded) return null // don't render until prefs are loaded (avoids flash)

  return (
    <div className="bg-white rounded-2xl border border-grey-soft p-6 space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-base font-semibold text-navy">
          Mentorship Language Preferences
        </h3>
        <p className="text-xs text-grey mt-1">
          Optionally set the languages you prefer for mentorship sessions.
          This helps us match you with mentors who can communicate in your language.
        </p>
      </div>

      {/* Primary language */}
      <div>
        <label className="field-label">Primary Preferred Language</label>
        <select
          value={prefs.primaryCode}
          onChange={e => setPrimary(e.target.value)}
          className="field-input text-sm mt-1"
          aria-label="Primary preferred language for mentorship"
        >
          <option value="">None selected (optional)</option>
          {ALL_MENTORSHIP_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {languageDisplayLabel(lang)}
            </option>
          ))}
        </select>
      </div>

      {/* Additional languages */}
      <div>
        <label className="field-label">Additional Preferred Languages</label>
        <p className="text-xs text-grey mb-2">Optional. Select one or more additional languages.</p>

        {/* Selected chips */}
        {prefs.additionalCodes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <AnimatePresence>
              {prefs.additionalCodes.map(code => {
                const lang = LANGUAGE_BY_CODE[code]
                if (!lang) return null
                return (
                  <motion.span
                    key={code}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-navy/[0.06] text-navy rounded-full border border-navy/10"
                    dir={lang.rtl ? 'rtl' : 'ltr'}
                    lang={lang.code}
                  >
                    <span>{lang.code === 'en' ? 'English' : lang.native}</span>
                    <button
                      type="button"
                      onClick={() => removeAdditional(code)}
                      className="text-grey hover:text-maroon transition-colors"
                      aria-label={`Remove ${lang.english}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Dropdown trigger */}
        <div ref={addContainerRef} className="relative">
          <button
            type="button"
            onClick={() => setAdditionalOpen(v => !v)}
            aria-expanded={additionalOpen}
            className={clsx(
              'flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border text-sm font-medium font-nav transition-all cursor-pointer',
              additionalOpen
                ? 'border-navy bg-white text-navy'
                : 'border-dashed border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy'
            )}
          >
            <span className="text-gold">+</span>
            <span>Add language…</span>
          </button>

          <AnimatePresence>
            {additionalOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-grey-soft overflow-hidden z-30"
              >
                {/* Search */}
                <div className="px-3 pt-3 pb-2 border-b border-grey-soft">
                  <div className="flex items-center gap-2 bg-ivory-dark rounded-xl px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-grey shrink-0" />
                    <input
                      ref={addSearchRef}
                      value={additionalSearch}
                      onChange={e => setAdditionalSearch(e.target.value)}
                      placeholder="Search languages…"
                      className="flex-1 bg-transparent text-sm text-navy placeholder-grey outline-none font-nav"
                    />
                  </div>
                </div>
                <ul className="py-1 max-h-48 overflow-y-auto">
                  {additionalFiltered.map(lang => {
                    const isSelected = prefs.additionalCodes.includes(lang.code)
                    return (
                      <li key={lang.code}>
                        <button
                          type="button"
                          onClick={() => { toggleAdditional(lang.code); setAdditionalOpen(false) }}
                          className={clsx(
                            'w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors',
                            isSelected ? 'bg-gold/8' : 'hover:bg-ivory-dark'
                          )}
                          dir={lang.rtl ? 'rtl' : 'ltr'}
                        >
                          <span
                            className="text-sm font-medium text-navy font-nav"
                            lang={lang.code}
                          >
                            {lang.native}
                          </span>
                          {lang.code !== 'en' && (
                            <span className="text-xs text-grey">{lang.english}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Saving…
          </>
        ) : 'Save Language Preferences'}
      </button>
    </div>
  )
}

/**
 * Utility: given a student's lang preferences and a mentor's language entries,
 * compute the recommended session language.
 *
 * Priority:
 *  1. Exact primary-language match (mentor supports student's primary)
 *  2. Additional-language intersection
 *  3. Fall back to mentor's primary language (first entry)
 */
export function recommendSessionLanguage(
  studentPrimaryCode: string,
  studentAdditionalCodes: string[],
  mentorLanguageCodes: string[]
): string | null {
  if (!mentorLanguageCodes.length) return null
  if (studentPrimaryCode && mentorLanguageCodes.includes(studentPrimaryCode)) {
    return studentPrimaryCode
  }
  for (const code of studentAdditionalCodes) {
    if (mentorLanguageCodes.includes(code)) return code
  }
  return mentorLanguageCodes[0] ?? null
}
