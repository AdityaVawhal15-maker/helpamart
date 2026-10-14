-- ============================================================================
-- MIGRATION: Profile Views Tracking and Session Completion
-- Migration ID: 20261015000000_profile_views_and_completion
-- Database: Supabase PostgreSQL
-- Project: HELPAMART (https://helpamart.com)
--
-- PRODUCTION ARCHITECTURE & HARDENING SPECIFICATION:
--   1. Comprehensive Pre-flight: Validates catalog prerequisites, all required
--      columns, specific data types, function dependencies, and status check
--      constraints across public.mentors, public.bookings, and public.profiles.
--   2. Mentors Counter Protection: Protects mentors.profile_view_count and
--      rate-limit bucket columns from direct client manipulation. Transparently
--      preserves ordinary mentor profile updates (bio, name, services, photo, etc.).
--   3. Booking Completion Protection: Enforces strict forward and reverse protection
--      on bookings.status ('completed') and bookings.completed_at against direct
--      client manipulation on BOTH INSERT and UPDATE. Preserves mentee cancellation,
--      Google Meet link writes, calendar syncing, and payment webhook reconciliation.
--   4. Anonymous Abuse Mitigation & Anti-Flooding: Enforces a concurrency-safe
--      sliding-window rate-limit bucket on mentors for anonymous view requests.
--      Crucially, rate-limited anonymous views do NOT insert into profile_views
--      nor increment the counter, preventing table bloat and keeping the counter
--      consistent with recorded views.
--   5. Authenticated Dedup & Self-View Exclusion: Deduplicates authenticated
--      views per visitor per hour. Excludes mentor self-views from recording
--      and incrementing.
--   6. Visitor Privacy: Does not store or expose emails, IP addresses, or auth tokens.
--      Only visitor display name and avatar fetched server-side from public.profiles.
--   7. Secure Booking Completion RPC: mark_booking_completed_by_mentor verifies
--      caller authentication, mentor ownership, past end_at, status = 'confirmed',
--      and verified payment.
--      Business logic validation:
--        - Paid sessions (price_cents > 0): require payment_status = 'completed'.
--        - Free sessions (price_cents = 0): require payment_status = 'not_required'.
--        - Fails closed on NULL, pending, failed, negative, or mismatched payment state.
--   8. Concurrency Safety: Uses row-level locks (FOR UPDATE) in both RPCs
--      and re-asserts state in atomic updates with ROW_COUNT verification.
--   9. Clean Policy & Grant Hygiene: Removes demonstrably unsafe legacy policies
--      while preserving necessary mentor access. Enforces 4 restrictive policies
--      and least-privilege table and execute grants.
--  10. Supabase Realtime Configuration: Configures supabase_realtime publication
--      idempotently and sets REPLICA IDENTITY FULL for profile_views.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. PRE-FLIGHT SCHEMA PREREQUISITE VALIDATION
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_col_type TEXT;
BEGIN
  -- 1. Verify existence of required application tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mentors'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Table public.mentors does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Table public.bookings does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Table public.profiles does not exist';
  END IF;

  -- 2. Verify required columns and compatible types on public.mentors
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'user_id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.user_id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.user_id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'slug';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.slug is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.slug must be text, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'status';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.status is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.status must be text, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'mentors' AND column_name = 'updated_at';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.updated_at is missing';
  ELSIF v_col_type NOT IN ('timestamp with time zone', 'timestamp without time zone') THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.mentors.updated_at must be timestamp, found %', v_col_type;
  END IF;

  -- 3. Verify required columns and compatible types on public.profiles
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.full_name is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.full_name must be text, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.avatar_url is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.profiles.avatar_url must be text, found %', v_col_type;
  END IF;

  -- 4. Verify required columns and compatible types on public.bookings
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'mentor_id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.mentor_id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.mentor_id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'mentee_id';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.mentee_id is missing';
  ELSIF v_col_type <> 'uuid' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.mentee_id must be uuid, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'status';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.status is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.status must be text, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'payment_status';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.payment_status is missing';
  ELSIF v_col_type <> 'text' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.payment_status must be text, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'price_cents';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.price_cents is missing';
  ELSIF v_col_type NOT IN ('integer', 'bigint', 'smallint') THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.price_cents must be integer, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'end_at';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.end_at is missing';
  ELSIF v_col_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.end_at must be timestamp with time zone, found %', v_col_type;
  END IF;

  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'updated_at';
  IF v_col_type IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.updated_at is missing';
  ELSIF v_col_type NOT IN ('timestamp with time zone', 'timestamp without time zone') THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Column public.bookings.updated_at must be timestamp, found %', v_col_type;
  END IF;

  -- bookings.completed_at (if already present from previous run, verify type compatibility)
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'completed_at';
  IF v_col_type IS NOT NULL AND v_col_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Existing column public.bookings.completed_at must be timestamp with time zone, found %', v_col_type;
  END IF;

  -- 5. Verify Supabase auth.uid() function is available
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: auth.uid() function not found (Supabase auth extension missing)';
  END IF;

  -- 6. Verify gen_random_uuid() function is available
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.proname = 'gen_random_uuid'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: gen_random_uuid() function not found';
  END IF;

  -- 7. Validate that if any check constraint on status exists, it permits 'completed'
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'bookings'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~ '\mstatus\M'
      AND pg_get_constraintdef(c.oid) !~ '\mpayment_status\M'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%completed%'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Existing CHECK constraint on public.bookings.status forbids ''completed''';
  END IF;

  -- 8. Validate that if any check constraint on payment_status exists, it permits 'completed' and 'not_required'
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'bookings'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~ '\mpayment_status\M'
      AND (
        pg_get_constraintdef(c.oid) NOT LIKE '%completed%'
        OR pg_get_constraintdef(c.oid) NOT LIKE '%not_required%'
      )
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE FAILED: Existing CHECK constraint on public.bookings.payment_status forbids ''completed'' or ''not_required''';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD COLUMNS TO public.mentors (IDEMPOTENT)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS profile_view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS anon_view_bucket_ts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anon_view_bucket_count INTEGER NOT NULL DEFAULT 0;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. CREATE public.profile_views TABLE AND INDEXES (IDEMPOTENT)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_views (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id          UUID        NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  visitor_id         UUID,                      -- NULL for anonymous visitors
  visitor_name       TEXT,                      -- Display name only
  visitor_avatar_url TEXT,                      -- Avatar URL only
  viewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_mentor_viewed_at
  ON public.profile_views (mentor_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_views_dedup
  ON public.profile_views (mentor_id, visitor_id, viewed_at DESC)
  WHERE visitor_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. ADD completed_at COLUMN TO public.bookings (IDEMPOTENT)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_mentor_completed
  ON public.bookings (mentor_id, status, completed_at)
  WHERE status = 'completed';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. DB-LEVEL TRIGGER: PROTECT mentors VIEW COUNTER AND RATE-LIMIT COLUMNS
-- ────────────────────────────────────────────────────────────────────────────
-- Direct PostgREST client updates run as CURRENT_USER = 'authenticated' or 'anon'.
-- SECURITY DEFINER RPCs (record_mentor_profile_view) run as function owner ('postgres').
-- Service-role updates run as CURRENT_USER = 'service_role'.
-- We intercept and preserve counter columns for direct clients without relying on
-- spoofable client-supplied custom settings.
CREATE OR REPLACE FUNCTION public.protect_mentor_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Intercept direct client updates from authenticated or anon PostgREST roles
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    IF NEW.profile_view_count IS DISTINCT FROM OLD.profile_view_count
       OR NEW.anon_view_bucket_ts IS DISTINCT FROM OLD.anon_view_bucket_ts
       OR NEW.anon_view_bucket_count IS DISTINCT FROM OLD.anon_view_bucket_count
    THEN
      NEW.profile_view_count     := OLD.profile_view_count;
      NEW.anon_view_bucket_ts    := OLD.anon_view_bucket_ts;
      NEW.anon_view_bucket_count := OLD.anon_view_bucket_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_protect_mentor_view_count ON public.mentors;
CREATE TRIGGER tg_protect_mentor_view_count
  BEFORE UPDATE ON public.mentors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_mentor_view_count();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. DB-LEVEL TRIGGER: PROTECT bookings COMPLETION FIELDS (INSERT & UPDATE)
-- ────────────────────────────────────────────────────────────────────────────
-- Protects against direct client manipulation on both INSERT and UPDATE:
--   - Prevents inserting bookings with forged status = 'completed' or completed_at
--   - Prevents updating status to 'completed' (must use mark_booking_completed_by_mentor)
--   - Prevents reverting status from 'completed'
--   - Prevents setting, clearing, or modifying completed_at timestamp
-- Preserves mentee cancellation, Cashfree webhooks, Google Meet links, and service_role.
CREATE OR REPLACE FUNCTION public.protect_booking_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Direct PostgREST clients run as CURRENT_USER = 'authenticated' or 'anon'
  IF CURRENT_USER IN ('authenticated', 'anon') THEN

    -- ── INSERT GUARDS ───────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
      -- Direct client creation of confirmed or completed bookings is forbidden.
      -- Legitimate bookings are created through the trusted server-side booking
      -- endpoint (/api/book or payment webhooks) running under service_role.
      IF NEW.status IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION
          'Direct client creation of % bookings is not permitted. Bookings must be created through the trusted booking API.',
          NEW.status
          USING ERRCODE = 'insufficient_privilege';
      END IF;

      IF NEW.completed_at IS NOT NULL THEN
        RAISE EXCEPTION
          'Creating a booking with completed_at set is not permitted.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;

      RETURN NEW;
    END IF;

    -- ── UPDATE GUARDS ───────────────────────────────────────────────────────
    -- Guard 1: Block direct forward transition TO 'completed'
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION
        'Direct status transition to ''completed'' is not permitted. Use mark_booking_completed_by_mentor() RPC.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Guard 2: Block direct reverse transition FROM 'completed'
    IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION
        'Reverting a completed booking status is not permitted.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Guard 3: Block direct write to completed_at when previously NULL
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
      RAISE EXCEPTION
        'Direct write to completed_at is not permitted. Use mark_booking_completed_by_mentor() RPC.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Guard 4: Block clearing completed_at
    IF NEW.completed_at IS NULL AND OLD.completed_at IS NOT NULL THEN
      RAISE EXCEPTION
        'Clearing completed_at is not permitted.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Guard 5: Block modifying completed_at timestamp
    IF NEW.completed_at IS NOT NULL
       AND OLD.completed_at IS NOT NULL
       AND NEW.completed_at IS DISTINCT FROM OLD.completed_at
    THEN
      RAISE EXCEPTION
        'Modifying completed_at is not permitted.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_protect_booking_completion ON public.bookings;
CREATE TRIGGER tg_protect_booking_completion
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_completion();


-- ────────────────────────────────────────────────────────────────────────────
-- 6. RPC: record_mentor_profile_view
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_mentor_profile_view(
  p_mentor_slug TEXT
)
RETURNS TABLE(success BOOLEAN, view_id UUID, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  C_ANON_WINDOW_SECS    CONSTANT INTEGER := 60;    -- 1-minute rate-limit window
  C_ANON_MAX_PER_WINDOW CONSTANT INTEGER := 3;     -- max 3 recorded anonymous views/min
  C_AUTH_DEDUP_SECS     CONSTANT INTEGER := 3600;  -- 1-hour deduplication for authenticated visitors

  v_mentor_id          public.mentors.id%TYPE;
  v_mentor_user_id     public.mentors.user_id%TYPE;
  v_visitor_id         UUID;
  v_visitor_name       public.profiles.full_name%TYPE;
  v_visitor_avatar_url public.profiles.avatar_url%TYPE;
  v_recent_view_id     UUID;
  v_new_view_id        UUID;
  v_dedup_cutoff       TIMESTAMPTZ;
  v_bucket_ts          public.mentors.anon_view_bucket_ts%TYPE;
  v_bucket_count       public.mentors.anon_view_bucket_count%TYPE;
BEGIN
  -- Input validation
  IF p_mentor_slug IS NULL OR trim(p_mentor_slug) = '' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Mentor slug required'::TEXT;
    RETURN;
  END IF;

  -- Step 1: Find mentor and verify published status
  SELECT m.id, m.user_id, m.anon_view_bucket_ts, m.anon_view_bucket_count
  INTO   v_mentor_id, v_mentor_user_id, v_bucket_ts, v_bucket_count
  FROM   public.mentors m
  WHERE  m.slug = trim(p_mentor_slug)
    AND  m.status = 'published'
  LIMIT  1;

  IF v_mentor_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Mentor not found or not published'::TEXT;
    RETURN;
  END IF;

  -- Step 2: Get authenticated caller ID (NULL for anonymous)
  v_visitor_id := auth.uid();

  -- Step 3: Acquire row lock on mentor to serialize concurrent updates safely
  PERFORM 1 FROM public.mentors m
  WHERE  m.id = v_mentor_id
  FOR UPDATE;

  -- Refresh bucket state under row lock
  SELECT m.anon_view_bucket_ts, m.anon_view_bucket_count
  INTO   v_bucket_ts, v_bucket_count
  FROM   public.mentors m
  WHERE  m.id = v_mentor_id;

  -- Step 4: Handle Authenticated vs Anonymous visitors
  IF v_visitor_id IS NOT NULL THEN
    -- ── Authenticated Visitor ───────────────────────────────────────────────

    -- 4a: Mentor self-view check: do not count or record self-views
    IF v_visitor_id = v_mentor_user_id THEN
      RETURN QUERY SELECT true, NULL::UUID, ''::TEXT;
      RETURN;
    END IF;

    -- 4b: Deduplication check: 1 view per visitor per hour
    v_dedup_cutoff := now() - (C_AUTH_DEDUP_SECS || ' seconds')::INTERVAL;
    SELECT pv.id INTO v_recent_view_id
    FROM   public.profile_views pv
    WHERE  pv.mentor_id  = v_mentor_id
      AND  pv.visitor_id = v_visitor_id
      AND  pv.viewed_at  > v_dedup_cutoff
    LIMIT  1;

    -- Already recorded within deduplication window
    IF v_recent_view_id IS NOT NULL THEN
      RETURN QUERY SELECT true, NULL::UUID, ''::TEXT;
      RETURN;
    END IF;

    -- 4c: Fetch visitor display metadata server-side from profiles
    SELECT p.full_name, p.avatar_url
    INTO   v_visitor_name, v_visitor_avatar_url
    FROM   public.profiles p
    WHERE  p.id = v_visitor_id
    LIMIT  1;

    -- 4d: Record view and increment counter atomically
    INSERT INTO public.profile_views (
      mentor_id,
      visitor_id,
      visitor_name,
      visitor_avatar_url,
      viewed_at
    ) VALUES (
      v_mentor_id,
      v_visitor_id,
      v_visitor_name,
      v_visitor_avatar_url,
      now()
    )
    RETURNING public.profile_views.id INTO v_new_view_id;

    UPDATE public.mentors
    SET    profile_view_count = profile_view_count + 1,
           updated_at         = now()
    WHERE  id = v_mentor_id;

    RETURN QUERY SELECT true, v_new_view_id, ''::TEXT;
    RETURN;

  ELSE
    -- ── Anonymous Visitor ───────────────────────────────────────────────────
    -- Check sliding-window rate limit
    IF v_bucket_ts IS NOT NULL
       AND now() < v_bucket_ts + (C_ANON_WINDOW_SECS || ' seconds')::INTERVAL
    THEN
      IF v_bucket_count >= C_ANON_MAX_PER_WINDOW THEN
        -- Rate limit reached: do NOT insert into profile_views to prevent table bloat.
        -- Do NOT increment counter. Return clean success without recording.
        RETURN QUERY SELECT true, NULL::UUID, ''::TEXT;
        RETURN;
      ELSE
        v_bucket_count := v_bucket_count + 1;
      END IF;
    ELSE
      v_bucket_ts    := now();
      v_bucket_count := 1;
    END IF;

    -- Under limit: record anonymous view and increment counter atomically
    INSERT INTO public.profile_views (
      mentor_id,
      visitor_id,
      visitor_name,
      visitor_avatar_url,
      viewed_at
    ) VALUES (
      v_mentor_id,
      NULL,
      NULL,
      NULL,
      now()
    )
    RETURNING public.profile_views.id INTO v_new_view_id;

    UPDATE public.mentors
    SET    profile_view_count     = profile_view_count + 1,
           anon_view_bucket_ts    = v_bucket_ts,
           anon_view_bucket_count = v_bucket_count,
           updated_at             = now()
    WHERE  id = v_mentor_id;

    RETURN QUERY SELECT true, v_new_view_id, ''::TEXT;
    RETURN;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, ('View recording failed: ' || SQLERRM)::TEXT;
  RETURN;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. RPC: mark_booking_completed_by_mentor
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_booking_completed_by_mentor(
  p_booking_id UUID
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mentor_user_id         UUID;
  v_mentor_id              UUID;
  v_booking_status         TEXT;
  v_booking_payment_status TEXT;
  v_booking_price_cents    INTEGER;
  v_booking_end_at         TIMESTAMPTZ;
  v_booking_completed      TIMESTAMPTZ;
  v_current_user_id        UUID;
  v_rows_updated           INTEGER;
BEGIN
  -- ── Step 1: Authentication check ──────────────────────────────────────────
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  -- ── Step 2: Validate input ────────────────────────────────────────────────
  IF p_booking_id IS NULL THEN
    RETURN QUERY SELECT false, 'Booking ID required'::TEXT;
    RETURN;
  END IF;

  -- ── Step 3: Lock booking row and fetch details ────────────────────────────
  SELECT b.mentor_id, b.status, b.payment_status, b.price_cents, b.end_at, b.completed_at
  INTO   v_mentor_id, v_booking_status, v_booking_payment_status, v_booking_price_cents, v_booking_end_at, v_booking_completed
  FROM   public.bookings b
  WHERE  b.id = p_booking_id
  FOR UPDATE;

  IF v_mentor_id IS NULL THEN
    RETURN QUERY SELECT false, 'Booking not found'::TEXT;
    RETURN;
  END IF;

  -- ── Step 4: Verify mentor ownership ──────────────────────────────────────
  SELECT m.user_id INTO v_mentor_user_id
  FROM   public.mentors m
  WHERE  m.id = v_mentor_id
  LIMIT  1;

  IF v_mentor_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Mentor record not found'::TEXT;
    RETURN;
  END IF;

  IF v_mentor_user_id IS DISTINCT FROM v_current_user_id THEN
    RETURN QUERY SELECT false, 'Unauthorized: not the mentor for this booking'::TEXT;
    RETURN;
  END IF;

  -- ── Step 5: Validate booking status & completion state ───────────────────
  IF v_booking_completed IS NOT NULL OR v_booking_status = 'completed' THEN
    RETURN QUERY SELECT false, 'Booking is already marked as completed'::TEXT;
    RETURN;
  END IF;

  IF v_booking_status = 'cancelled' THEN
    RETURN QUERY SELECT false, 'Cannot complete a cancelled booking'::TEXT;
    RETURN;
  END IF;

  IF v_booking_status = 'pending' THEN
    RETURN QUERY SELECT false,
      'Cannot complete a pending booking: payment has not been confirmed yet. Wait for payment confirmation before completing.'::TEXT;
    RETURN;
  END IF;

  IF v_booking_status IS DISTINCT FROM 'confirmed' THEN
    RETURN QUERY SELECT false,
      format('Cannot complete booking with status ''%s''', v_booking_status)::TEXT;
    RETURN;
  END IF;

  -- ── Step 5b: Validate payment eligibility against Helpamart business logic ──
  -- Business Rules:
  -- 1. Free sessions (price_cents = 0):
  --    Must have payment_status = 'not_required'.
  --    A 'completed' payment status does NOT establish eligibility for free sessions.
  -- 2. Paid sessions (price_cents > 0):
  --    MUST have payment_status = 'completed'.
  -- 3. Fail closed on missing, negative, pending, failed, or mismatched state.
  IF v_booking_price_cents IS NULL OR v_booking_price_cents < 0 THEN
    RETURN QUERY SELECT false,
      format('Cannot complete booking: invalid price amount (%s).',
             coalesce(v_booking_price_cents::text, 'NULL'))::TEXT;
    RETURN;
  END IF;

  IF v_booking_payment_status IS NULL THEN
    RETURN QUERY SELECT false,
      'Cannot complete booking: payment status is missing (NULL). Payment verification required.'::TEXT;
    RETURN;
  END IF;

  IF v_booking_price_cents = 0 THEN
    IF v_booking_payment_status = 'not_required' THEN
      NULL; -- Valid free session
    ELSE
      RETURN QUERY SELECT false,
        format('Cannot complete free session: expected payment_status ''not_required'', but found ''%s''. A completed payment status does not establish eligibility for free sessions.',
               v_booking_payment_status)::TEXT;
      RETURN;
    END IF;
  ELSIF v_booking_price_cents > 0 THEN
    IF v_booking_payment_status = 'completed' THEN
      NULL; -- Valid paid session
    ELSE
      RETURN QUERY SELECT false,
        format('Cannot complete paid session: expected payment_status ''completed'', but found ''%s'' (amount: %s paise).',
               v_booking_payment_status,
               v_booking_price_cents)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Step 6: Validate session schedule ─────────────────────────────────────
  IF v_booking_end_at IS NULL THEN
    RETURN QUERY SELECT false, 'Booking end time is null (invalid booking state)'::TEXT;
    RETURN;
  END IF;

  IF now() < v_booking_end_at THEN
    RETURN QUERY SELECT false, 'Cannot mark complete: session has not ended yet'::TEXT;
    RETURN;
  END IF;

  -- ── Step 7: Atomic UPDATE with strict verification ────────────────────────
  UPDATE public.bookings
  SET    status       = 'completed',
         completed_at = now(),
         updated_at   = now()
  WHERE  id           = p_booking_id
    AND  status       = 'confirmed'
    AND  (
           (price_cents > 0 AND payment_status = 'completed')
           OR
           (price_cents = 0 AND payment_status = 'not_required')
         )
    AND  completed_at IS NULL
    AND  end_at       IS NOT NULL
    AND  now()        >= end_at;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN QUERY SELECT false,
      'Update affected 0 rows: booking state changed concurrently or eligibility conditions were not met'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, ''::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, ('Failed to update booking: ' || SQLERRM)::TEXT;
  RETURN;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. RLS POLICY AUDIT AND DEFINITION FOR public.profile_views
-- ────────────────────────────────────────────────────────────────────────────
-- Safely drop demonstrable legacy or unsafe policies while preserving required access.
DROP POLICY IF EXISTS "profile_views_insert_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_anon_insert" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_insert_public" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_allow_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_select_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_insert_policy" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_select_policy" ON public.profile_views;

-- Drop previous revisions of our own policies to allow clean recreation
DROP POLICY IF EXISTS "profile_views_insert_deny_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_select_mentor_own" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_update_deny_all" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views_delete_deny_all" ON public.profile_views;

-- Enforce Row Level Security
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Deny all direct client INSERTs (only the SECURITY DEFINER RPC may insert)
CREATE POLICY "profile_views_insert_deny_all" ON public.profile_views
  FOR INSERT TO PUBLIC
  WITH CHECK (false);

-- Allow authenticated mentors to SELECT only their own profile visitor records
CREATE POLICY "profile_views_select_mentor_own" ON public.profile_views
  FOR SELECT TO authenticated
  USING (
    mentor_id IN (
      SELECT id FROM public.mentors WHERE user_id = auth.uid()
    )
  );

-- Deny all direct client UPDATEs (audit log is immutable)
CREATE POLICY "profile_views_update_deny_all" ON public.profile_views
  FOR UPDATE TO PUBLIC
  USING (false)
  WITH CHECK (false);

-- Deny all direct client DELETEs (audit log preservation)
CREATE POLICY "profile_views_delete_deny_all" ON public.profile_views
  FOR DELETE TO PUBLIC
  USING (false);


-- ────────────────────────────────────────────────────────────────────────────
-- 9. TABLE PRIVILEGES AND ROLE GRANTS
-- ────────────────────────────────────────────────────────────────────────────
-- Revoke all direct modification privileges on profile_views
REVOKE ALL ON public.profile_views FROM PUBLIC;
REVOKE ALL ON public.profile_views FROM anon;
REVOKE ALL ON public.profile_views FROM authenticated;

-- Allow authenticated users to SELECT (restricted by RLS to own mentor profile)
GRANT SELECT ON public.profile_views TO authenticated;

-- Ensure RLS is enabled on mentors and bookings
ALTER TABLE public.mentors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────────────────
-- 10. RPC EXECUTION PERMISSIONS
-- ────────────────────────────────────────────────────────────────────────────
-- record_mentor_profile_view: accessible to all visitors (anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.record_mentor_profile_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_mentor_profile_view(TEXT) TO anon, authenticated;

-- mark_booking_completed_by_mentor: accessible only to authenticated users
REVOKE EXECUTE ON FUNCTION public.mark_booking_completed_by_mentor(UUID) FROM PUBLIC;
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.mark_booking_completed_by_mentor(UUID) FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_booking_completed_by_mentor(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 11. CONFIGURE REALTIME PUBLICATION FOR profile_views
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION
      'supabase_realtime publication not found. Ensure Supabase Realtime is enabled in your project.'
      USING ERRCODE = 'undefined_object';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'profile_views'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_views';
  END IF;

  -- Ensure full replica identity for realtime change replication
  EXECUTE 'ALTER TABLE public.profile_views REPLICA IDENTITY FULL';
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 12. SCHEMA CACHE NOTIFICATION
-- ────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
