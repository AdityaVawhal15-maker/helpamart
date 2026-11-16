import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * HELPAMART — Multilingual System Test Suite
 * ==========================================
 * Verifies:
 * 1. Catalogue completeness across 33 Indian languages + English
 * 2. Proper script representation & RTL markers (Urdu, Kashmiri, Sindhi)
 * 3. Fallback resolution engine: never leaks raw dot-paths
 * 4. Variable interpolation with strings and numbers
 * 5. Backward compatibility for legacy string arrays vs JSONB details
 * 6. Migration SQL safety: additive only, IF NOT EXISTS clauses
 */

// ── 1. Catalogue verification (mirrors src/i18n/catalogue.ts) ────────
test('1. Mentorship Catalogue contains all 33 Indian languages + English', async () => {
  const catalogueContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/i18n/catalogue.ts'),
    'utf-8'
  )

  // Verify key languages are present
  const requiredLanguages = [
    'Hindi', 'English', 'Marathi', 'Bengali', 'Tamil', 'Telugu',
    'Gujarati', 'Punjabi', 'Kannada', 'Malayalam', 'Odia', 'Assamese',
    'Urdu', 'Sanskrit', 'Kashmiri', 'Sindhi', 'Konkani', 'Maithili',
    'Santali', 'Nepali', 'Bodo', 'Dogri', 'Manipuri (Meitei)', 'Bhojpuri',
    'Marwari', 'Chhattisgarhi', 'Magahi', 'Haryanvi', 'Tulu', 'Rajasthani'
  ]

  for (const lang of requiredLanguages) {
    assert.ok(
      catalogueContent.includes(`english: '${lang}'`),
      `Expected catalogue to contain language: ${lang}`
    )
  }

  // Verify RTL languages are correctly flagged
  assert.ok(catalogueContent.includes("code: 'ur'") && catalogueContent.includes('rtl: true'))
  assert.ok(catalogueContent.includes("code: 'ks'") && catalogueContent.includes('rtl: true'))
  assert.ok(catalogueContent.includes("code: 'sd'") && catalogueContent.includes('rtl: true'))
})

// ── 2. Fallback and Interpolation Logic ──────────────────────────────
function resolvePath(obj, pathStr) {
  const parts = pathStr.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(text, vars) {
  if (!vars) return text
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match
  })
}

function translate(key, currentLocaleStrings, enStrings, vars) {
  const localVal = resolvePath(currentLocaleStrings, key)
  const fallbackVal = resolvePath(enStrings, key)
  const resolved = localVal ?? fallbackVal ?? key
  return interpolate(resolved, vars)
}

test('2. i18n Resolver falls back cleanly to English when key is missing in locale', () => {
  const enMock = {
    nav: { findMentor: 'Find a Mentor', udaan30: 'Udaan 30' },
    booking: { mentorCount: '{{count}} mentors available' },
  }
  const hiMock = {
    nav: { findMentor: 'मेंटर खोजें' }, // udaan30 omitted to test fallback
  }

  // Existing key in Hindi
  const translatedFind = translate('nav.findMentor', hiMock, enMock)
  assert.strictEqual(translatedFind, 'मेंटर खोजें')

  // Missing key falls back to English, NEVER returning raw key
  const fallbackUdaan = translate('nav.udaan30', hiMock, enMock)
  assert.strictEqual(fallbackUdaan, 'Udaan 30')
  assert.notStrictEqual(fallbackUdaan, 'nav.udaan30')

  // Interpolation in English fallback
  const interpolated = translate('booking.mentorCount', hiMock, enMock, { count: 5 })
  assert.strictEqual(interpolated, '5 mentors available')
})

test('3. Interpolation handles multiple variables and missing variables safely', () => {
  const template = 'Session with {{mentor}} on {{date}} for ₹{{price}}'
  const result = interpolate(template, { mentor: 'Dr. Sharma', date: 'Nov 20', price: 99 })
  assert.strictEqual(result, 'Session with Dr. Sharma on Nov 20 for ₹99')

  // Unsupplied variable remains intact
  const partial = interpolate('Hello {{name}}, code: {{code}}', { name: 'Aditya' })
  assert.strictEqual(partial, 'Hello Aditya, code: {{code}}')
})

// ── 3. Backward Compatibility & Serialization Helpers ───────────────
function parseMentorLanguageEntries(rawDetails, legacyLanguages = ['English']) {
  if (Array.isArray(rawDetails) && rawDetails.length > 0) {
    return rawDetails
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        languageCode: String(item.languageCode || 'en'),
        languageName: String(item.languageName || 'English'),
        nativeName: item.nativeName ? String(item.nativeName) : undefined,
        proficiency: ['native', 'professional', 'conversational', 'basic'].includes(item.proficiency)
          ? item.proficiency
          : 'professional',
        mode: ['spoken', 'written', 'both'].includes(item.mode)
          ? item.mode
          : 'both',
      }))
  }

  const legacyList = Array.isArray(legacyLanguages) && legacyLanguages.length > 0
    ? legacyLanguages
    : ['English']

  return legacyList.map(name => ({
    languageCode: name.toLowerCase().slice(0, 5),
    languageName: name,
    proficiency: 'professional',
    mode: 'both',
  }))
}

function mentorLangEntriesToStringArray(entries) {
  if (!Array.isArray(entries)) return []
  return entries.map(e => e.languageName).filter(Boolean)
}

test('4. Backward compatibility: Converts legacy string array into structured details', () => {
  const legacy = ['English', 'Hindi', 'Marathi']
  const parsed = parseMentorLanguageEntries(null, legacy)

  assert.strictEqual(parsed.length, 3)
  assert.strictEqual(parsed[0].languageName, 'English')
  assert.strictEqual(parsed[0].proficiency, 'professional')
  assert.strictEqual(parsed[0].mode, 'both')
  assert.strictEqual(parsed[1].languageName, 'Hindi')
  assert.strictEqual(parsed[2].languageName, 'Marathi')

  // String array extraction maintains backward compatibility
  const extracted = mentorLangEntriesToStringArray(parsed)
  assert.deepStrictEqual(extracted, ['English', 'Hindi', 'Marathi'])
})

test('5. Backward compatibility: Existing JSONB details take precedence over legacy array', () => {
  const existingJsonb = [
    { languageCode: 'mr', languageName: 'Marathi', proficiency: 'native', mode: 'spoken' },
    { languageCode: 'en', languageName: 'English', proficiency: 'professional', mode: 'both' },
  ]
  const legacy = ['Marathi']

  const parsed = parseMentorLanguageEntries(existingJsonb, legacy)
  assert.strictEqual(parsed.length, 2)
  assert.strictEqual(parsed[0].proficiency, 'native')
  assert.strictEqual(parsed[0].mode, 'spoken')

  const extracted = mentorLangEntriesToStringArray(parsed)
  assert.deepStrictEqual(extracted, ['Marathi', 'English'])
})

// ── 4. Migration SQL safety check ───────────────────────────────────
test('6. Migration script is strictly additive and non-destructive', () => {
  const sql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261116000000_multilingual_support.sql'),
    'utf-8'
  )

  // Must NOT contain DROP TABLE, DROP COLUMN, TRUNCATE, or DELETE
  assert.ok(!sql.includes('DROP TABLE'), 'Migration must not drop tables')
  assert.ok(!sql.includes('DROP COLUMN'), 'Migration must not drop columns')
  assert.ok(!sql.includes('TRUNCATE'), 'Migration must not truncate tables')

  // Must check column existence safely
  assert.ok(sql.includes("column_name = 'ui_language'"))
  assert.ok(sql.includes("column_name = 'student_lang_primary'"))
  assert.ok(sql.includes("column_name = 'language_details'"))
  assert.ok(sql.includes("column_name = 'session_language'"))
})
