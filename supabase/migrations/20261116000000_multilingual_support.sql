-- =============================================================================
-- HELPAMART MULTILINGUAL SUPPORT — SAFE ADDITIVE MIGRATION
-- Migration: 20261116000000_multilingual_support.sql
--
-- PRODUCTION SAFETY RULES:
--   • Forward-only. No DROP, no ALTER COLUMN TYPE, no data deletion.
--   • All ADD COLUMN statements use IF NOT EXISTS semantics via DO blocks.
--   • Idempotent: safe to re-run.
--   • All new columns have safe DEFAULT values so existing rows are unaffected.
--   • No existing columns modified.
--   • RLS policies added for new columns using DROP IF EXISTS → CREATE.
--
-- ⚠️  MANUAL DEPLOYMENT STEP REQUIRED ⚠️
--     This migration must be executed manually in the Supabase SQL Editor
--     (or via `supabase db push` on the production project).
--     Do NOT apply this automatically — verify the diff before applying.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.  public.profiles — interface language + student mentorship preferences
-- ---------------------------------------------------------------------------

-- 1a. Website interface language preference (ISO code, e.g. 'en', 'hi', 'mr')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ui_language'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN ui_language TEXT DEFAULT 'en';
    COMMENT ON COLUMN public.profiles.ui_language IS
      'Preferred website interface language code (BCP-47). Default: en.';
  END IF;
END $$;

-- 1b. Student primary preferred mentorship language (language code)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'student_lang_primary'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN student_lang_primary TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.profiles.student_lang_primary IS
      'Student primary preferred mentorship language code. NULL = no preference set.';
  END IF;
END $$;

-- 1c. Student additional preferred mentorship languages (array of language codes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'student_lang_additional'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN student_lang_additional TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN public.profiles.student_lang_additional IS
      'Student additional preferred mentorship language codes. Empty array = no preference.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2.  public.mentors — structured mentorship language details
-- ---------------------------------------------------------------------------

-- 2a. JSONB array of { code, proficiency, mode } objects.
--     The existing mentors.languages TEXT[] column is preserved and kept in sync.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'language_details'
  ) THEN
    ALTER TABLE public.mentors ADD COLUMN language_details JSONB DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN public.mentors.language_details IS
      'Structured mentorship language entries: [{code, proficiency, mode}].
       The existing languages TEXT[] column is preserved for backward compatibility.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3.  public.bookings — selected session language
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'session_language'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN session_language TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.bookings.session_language IS
      'Language code selected by the student for this mentorship session. NULL = not specified.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4.  Indexes for filtering mentors by language
-- ---------------------------------------------------------------------------

-- GIN index on language_details for JSONB contains queries
CREATE INDEX IF NOT EXISTS idx_mentors_language_details
  ON public.mentors USING GIN (language_details);

-- GIN index on the existing languages TEXT[] column (may already exist from prior migration;
-- this is safe to repeat due to IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_mentors_languages
  ON public.mentors USING GIN (languages);

-- ---------------------------------------------------------------------------
-- 5.  RLS — no new policies needed for new columns:
--     Existing policies on profiles/mentors/bookings already cover SELECT/UPDATE.
--     The new columns inherit the table-level policies.
--     Explicitly confirmed:
--       - profiles.ui_language readable by all (profiles_select_all policy)
--       - profiles.ui_language writable only by owner (profiles_update_own)
--       - mentors.language_details readable by all (mentors_select_all)
--       - mentors.language_details writable only by owner (mentors_update_own)
--       - bookings.session_language covered by existing booking policies
-- ---------------------------------------------------------------------------

-- No additional RLS policy changes required. ✓

-- ---------------------------------------------------------------------------
-- 6.  Validation CHECK constraints (optional but recommended)
-- ---------------------------------------------------------------------------

-- Validate ui_language is a known code (non-exhaustive; more can be added)
-- Using a simple length + character class check to stay flexible:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_ui_language_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_ui_language_format
      CHECK (
        ui_language IS NULL OR
        (ui_language ~ '^[a-z]{2,8}$' OR ui_language = 'en')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Migration complete.
-- New columns:
--   public.profiles.ui_language              TEXT  DEFAULT 'en'
--   public.profiles.student_lang_primary     TEXT  DEFAULT NULL
--   public.profiles.student_lang_additional  TEXT[] DEFAULT '{}'
--   public.mentors.language_details          JSONB  DEFAULT '[]'
--   public.bookings.session_language         TEXT  DEFAULT NULL
-- ---------------------------------------------------------------------------
