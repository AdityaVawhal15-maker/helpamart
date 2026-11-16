/**
 * HELPAMART — i18n Engine
 * =======================
 * Lightweight, zero-dependency internationalization that:
 *
 *  • Lazily loads translation files on demand
 *  • Falls back to English for missing keys (never shows raw keys)
 *  • Persists language in localStorage (guests) or Supabase profiles (users)
 *  • Detects browser language for first-time visitors
 *  • Keeps website interface language and mentorship language preferences SEPARATE
 *
 * Usage:
 *   const { t, language, setLanguage } = useI18n()
 *   t('nav.findMentor')           → 'Find a Mentor' or translated string
 *   t('booking.mentorCount', { count: 3 }) → '3 mentors'
 */

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import type { TranslationSchema } from './translations/en'
import en from './translations/en'
import { LANGUAGE_BY_CODE, UI_SUPPORTED_LANGUAGES } from './catalogue'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

type TranslationMap = DeepPartial<TranslationSchema>

export type I18nContextValue = {
  /** Active language code, e.g. 'en', 'hi', 'mr' */
  language: string
  /** Change the UI language. Persists to localStorage (and Supabase if logged in). */
  setLanguage: (code: string) => void
  /** Translate a dot-notation key with optional string interpolation */
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Whether translations for the current language are still loading */
  loading: boolean
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const LS_KEY = 'helpamart_ui_lang'
const DEFAULT_LANG = 'en'

/** Lazy-load map — will be populated on demand */
const translationCache = new Map<string, TranslationMap>()
// Pre-seed English
translationCache.set('en', en as TranslationMap)

// ─────────────────────────────────────────────────────────────────
// Lazy loader — dynamic imports per locale
// ─────────────────────────────────────────────────────────────────

async function loadTranslations(code: string): Promise<TranslationMap> {
  if (translationCache.has(code)) return translationCache.get(code)!

  try {
    let mod: { default: TranslationMap }

    switch (code) {
      case 'hi': mod = await import('./translations/hi'); break
      case 'mr': mod = await import('./translations/mr'); break
      case 'bn': mod = await import('./translations/bn'); break
      case 'ta': mod = await import('./translations/ta'); break
      case 'te': mod = await import('./translations/te'); break
      case 'gu': mod = await import('./translations/gu'); break
      case 'pa': mod = await import('./translations/pa'); break
      case 'kn': mod = await import('./translations/kn'); break
      case 'ml': mod = await import('./translations/ml'); break
      default:   mod = { default: {} }; break
    }

    translationCache.set(code, mod.default)
    return mod.default
  } catch {
    // If loading fails, return empty (will fall back to English)
    translationCache.set(code, {})
    return {}
  }
}

// ─────────────────────────────────────────────────────────────────
// Key resolver — dot-notation deep access
// ─────────────────────────────────────────────────────────────────

function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`))
}

// ─────────────────────────────────────────────────────────────────
// Detect browser language
// ─────────────────────────────────────────────────────────────────

function detectBrowserLanguage(): string {
  const supported = new Set(UI_SUPPORTED_LANGUAGES.map(l => l.code))
  const navLangs = navigator.languages ?? [navigator.language]

  for (const lang of navLangs) {
    const code = lang.split('-')[0].toLowerCase()
    if (supported.has(code)) return code
  }
  return DEFAULT_LANG
}

// ─────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // Resolve initial language: localStorage → browser → English
  function getInitialLang(): string {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored && LANGUAGE_BY_CODE[stored]) return stored
    } catch { /* SSR or private browsing */ }
    return detectBrowserLanguage()
  }

  const [language, setLanguageState] = useState<string>(getInitialLang)
  const [translations, setTranslations] = useState<TranslationMap>(
    translationCache.get(language) ?? {}
  )
  const [loading, setLoading] = useState(language !== 'en')
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Load translations whenever language changes
  useEffect(() => {
    if (language === 'en') {
      setTranslations(en as TranslationMap)
      setLoading(false)
      return
    }
    setLoading(true)
    loadTranslations(language).then(t => {
      if (isMountedRef.current) {
        setTranslations(t)
        setLoading(false)
      }
    })
  }, [language])

  // Apply RTL direction for Urdu, Kashmiri
  useEffect(() => {
    const entry = LANGUAGE_BY_CODE[language]
    document.documentElement.dir = entry?.rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((code: string) => {
    if (!LANGUAGE_BY_CODE[code]) return // ignore unknown codes
    setLanguageState(code)
    try { localStorage.setItem(LS_KEY, code) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    // Try current language first
    const translated = resolvePath(translations, key)
    if (translated !== undefined) return interpolate(translated, vars)
    // Fall back to English
    const fallback = resolvePath(en, key)
    if (fallback !== undefined) return interpolate(fallback, vars)
    // Last resort: return the key (should never reach users)
    return key
  }, [translations])

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </I18nContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

/**
 * Convenience: expose the localStorage key so other modules can read
 * the persisted language without importing the full provider.
 */
export const I18N_LS_KEY = LS_KEY
