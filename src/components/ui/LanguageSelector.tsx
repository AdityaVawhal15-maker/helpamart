/**
 * HELPAMART — Global Language Selector
 * ======================================
 * A compact, searchable dropdown added to the existing navigation bar.
 * Controls the WEBSITE INTERFACE language only.
 *
 * Design constraints:
 *  - Reuses existing CSS classes (pill, text-navy, text-grey, bg-white, etc.)
 *  - No layout shift — fits naturally between existing nav elements
 *  - Keyboard accessible: arrow keys navigate, Enter selects, Escape closes
 *  - Mobile-friendly: auto-closes on outside click / Escape
 *  - Shows native script + English name in dropdown; compact label in trigger
 *  - RTL languages rendered with proper dir attribute
 */

import { useEffect, useRef, useState } from 'react'
import { Globe, ChevronDown, Check, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { LANGUAGE_BY_CODE, languageDisplayLabel, UI_SUPPORTED_LANGUAGES } from '@/i18n/catalogue'

export type LanguageSelectorProps = {
  className?: string
  align?: 'left' | 'right'
  showLabelOnMobile?: boolean
}

export function LanguageSelector({
  className,
  align = 'right',
  showLabelOnMobile = false,
}: LanguageSelectorProps = {}) {
  const { language, setLanguage, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const current = LANGUAGE_BY_CODE[language] ?? LANGUAGE_BY_CODE['en']

  const filtered = UI_SUPPORTED_LANGUAGES.filter(lang => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      lang.english.toLowerCase().includes(q) ||
      lang.native.toLowerCase().includes(q)
    )
  })

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setFocused(0)
      setTimeout(() => searchRef.current?.focus(), 60)
    } else {
      setSearch('')
    }
  }, [open])

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

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocused(f => Math.min(f + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocused(f => Math.max(f - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[focused]) {
          selectLanguage(filtered[focused].code)
        }
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[focused] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  function selectLanguage(code: string) {
    setLanguage(code)
    setOpen(false)
    setSearch('')
  }

  // Compact trigger label — show flag code or short native name
  const triggerLabel = current.code === 'en'
    ? 'EN'
    : current.code.toUpperCase().slice(0, 2)

  return (
    <div ref={containerRef} className={clsx('relative', className)} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('nav.language')}
        className={clsx(
          'flex items-center gap-1.5 h-9 px-2.5 rounded-xl border transition-all duration-200 cursor-pointer',
          'text-xs font-medium font-nav',
          open
            ? 'border-gold/50 bg-white text-navy shadow-[0_2px_8px_rgba(7,26,53,0.08)]'
            : 'border-navy/[0.08] bg-white/40 text-navy/70 hover:bg-white/90 hover:border-gold/40 hover:text-navy'
        )}
      >
        <Globe className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        <span className={showLabelOnMobile ? 'inline' : 'hidden sm:inline'}>{triggerLabel}</span>
        <ChevronDown
          className={clsx('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'absolute top-full mt-2 w-64 bg-white rounded-2xl shadow-lg border border-grey-soft overflow-hidden z-50',
              align === 'left' ? 'left-0' : 'right-0'
            )}
            role="dialog"
            aria-label={t('nav.language')}
          >
            {/* Search box */}
            <div className="px-3 pt-3 pb-2 border-b border-grey-soft">
              <div className="flex items-center gap-2 bg-ivory-dark rounded-xl px-3 py-2">
                <Search className="h-3.5 w-3.5 text-grey shrink-0" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setFocused(0) }}
                  placeholder={t('profile.searchLanguages') || 'Search languages…'}
                  className="flex-1 bg-transparent text-sm text-navy placeholder-grey outline-none font-nav"
                  aria-label="Search languages"
                />
              </div>
            </div>

            {/* Language list */}
            <ul
              ref={listRef}
              role="listbox"
              aria-label={t('nav.language')}
              className="py-1 max-h-56 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-grey text-center">
                  No languages found
                </li>
              ) : (
                filtered.map((lang, idx) => {
                  const isActive = lang.code === language
                  const isFocused = idx === focused
                  return (
                    <li
                      key={lang.code}
                      role="option"
                      aria-selected={isActive}
                      dir={lang.rtl ? 'rtl' : 'ltr'}
                    >
                      <button
                        type="button"
                        onClick={() => selectLanguage(lang.code)}
                        onMouseEnter={() => setFocused(idx)}
                        className={clsx(
                          'w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors duration-100',
                          isActive ? 'bg-gold/8' : isFocused ? 'bg-ivory-dark' : 'hover:bg-ivory-dark'
                        )}
                      >
                        <span className="flex flex-col min-w-0">
                          <span
                            className={clsx(
                              'text-sm font-medium font-nav truncate',
                              isActive ? 'text-navy' : 'text-navy/80'
                            )}
                            lang={lang.code}
                          >
                            {lang.native}
                          </span>
                          {lang.code !== 'en' && (
                            <span className="text-xs text-grey font-nav truncate">
                              {lang.english}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <Check className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            {/* Footer note */}
            <div className="px-4 py-2 border-t border-grey-soft">
              <p className="text-[0.6875rem] text-grey/70 font-nav">
                {languageDisplayLabel(current)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
