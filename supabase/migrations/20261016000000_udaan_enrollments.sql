-- ============================================================
-- HELPAMART — Udaan 30 Enrollments
-- Migration: 20261016000000_udaan_enrollments.sql
--
-- Creates the udaan_enrollments table to track 30-day
-- mentorship subscription enrollments with Cashfree payments.
-- ============================================================

BEGIN;

-- 1. PREFLIGHT VALIDATION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE EXCEPTION '[udaan] auth schema not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    RAISE EXCEPTION '[udaan] auth.users table not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mentors') THEN
    RAISE EXCEPTION '[udaan] public.mentors table not found';
  END IF;
END;
$$;

-- 2. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.udaan_enrollments (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name                 TEXT          NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email                     TEXT          NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                     TEXT          CHECK (phone IS NULL OR char_length(phone) BETWEEN 7 AND 20),
  journey                   TEXT          NOT NULL CHECK (char_length(journey) BETWEEN 2 AND 100),
  custom_goal               TEXT          CHECK (custom_goal IS NULL OR char_length(custom_goal) <= 1000),
  experience_level          TEXT          CHECK (experience_level IS NULL OR char_length(experience_level) <= 100),
  communication_preference  TEXT          CHECK (communication_preference IS NULL OR char_length(communication_preference) <= 100),
  availability_preference   TEXT          CHECK (availability_preference IS NULL OR char_length(availability_preference) <= 100),
  amount_cents              INTEGER       NOT NULL DEFAULT 14900 CHECK (amount_cents = 14900),
  currency                  TEXT          NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_status            TEXT          NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  enrollment_status         TEXT          NOT NULL DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'active', 'completed', 'cancelled')),
  payment_provider          TEXT          NOT NULL DEFAULT 'cashfree',
  cashfree_order_id         TEXT          UNIQUE,
  cashfree_payment_id       TEXT,
  mentor_id                 UUID          REFERENCES public.mentors(id) ON DELETE SET NULL,
  paid_at                   TIMESTAMPTZ,
  starts_at                 TIMESTAMPTZ,
  ends_at                   TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT udaan_window_order CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE public.udaan_enrollments IS 'Udaan 30: 30-day mentorship enrollments (INR 14900 = Rs149 via Cashfree).';

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS udaan_enrollments_user_id_idx           ON public.udaan_enrollments (user_id);
CREATE INDEX IF NOT EXISTS udaan_enrollments_email_idx             ON public.udaan_enrollments (email);
CREATE INDEX IF NOT EXISTS udaan_enrollments_payment_status_idx    ON public.udaan_enrollments (payment_status);
CREATE INDEX IF NOT EXISTS udaan_enrollments_enrollment_status_idx ON public.udaan_enrollments (enrollment_status);
CREATE INDEX IF NOT EXISTS udaan_enrollments_cashfree_order_id_idx ON public.udaan_enrollments (cashfree_order_id);
CREATE INDEX IF NOT EXISTS udaan_enrollments_created_at_idx        ON public.udaan_enrollments (created_at DESC);
CREATE INDEX IF NOT EXISTS udaan_enrollments_journey_idx           ON public.udaan_enrollments (journey);

-- 4. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.udaan_touch_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_udaan_enrollments_updated_at ON public.udaan_enrollments;
CREATE TRIGGER tg_udaan_enrollments_updated_at
  BEFORE UPDATE ON public.udaan_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.udaan_touch_updated_at();

-- 5. PROTECT PAYMENT & ENROLLMENT FIELDS FROM DIRECT CLIENT MODIFICATION
CREATE OR REPLACE FUNCTION public.protect_udaan_payment_fields()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _role TEXT := current_setting('role', true);
BEGIN
  -- Service role / backend server is trusted to update payment & activation fields
  IF _role = 'service_role' THEN RETURN NEW; END IF;

  IF (NEW.payment_status IS DISTINCT FROM OLD.payment_status) OR
     (NEW.enrollment_status IS DISTINCT FROM OLD.enrollment_status) OR
     (NEW.cashfree_order_id IS DISTINCT FROM OLD.cashfree_order_id) OR
     (NEW.cashfree_payment_id IS DISTINCT FROM OLD.cashfree_payment_id) OR
     (NEW.mentor_id IS DISTINCT FROM OLD.mentor_id) OR
     (NEW.paid_at IS DISTINCT FROM OLD.paid_at) OR
     (NEW.starts_at IS DISTINCT FROM OLD.starts_at) OR
     (NEW.ends_at IS DISTINCT FROM OLD.ends_at) OR
     (NEW.amount_cents IS DISTINCT FROM OLD.amount_cents) OR
     (NEW.currency IS DISTINCT FROM OLD.currency)
  THEN
    RAISE EXCEPTION 'udaan: direct modification of payment or subscription fields is not permitted (role=%).', _role
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_protect_udaan_payment_fields ON public.udaan_enrollments;
CREATE TRIGGER tg_protect_udaan_payment_fields
  BEFORE UPDATE ON public.udaan_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.protect_udaan_payment_fields();

-- 6. ROW LEVEL SECURITY
ALTER TABLE public.udaan_enrollments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own enrollments by user_id or matching email
DROP POLICY IF EXISTS "udaan_select_own" ON public.udaan_enrollments;
CREATE POLICY "udaan_select_own"
  ON public.udaan_enrollments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR email = (auth.jwt() ->> 'email'));

-- Allow authenticated users to insert their own pending enrollment record
DROP POLICY IF EXISTS "udaan_insert_own" ON public.udaan_enrollments;
CREATE POLICY "udaan_insert_own"
  ON public.udaan_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND payment_status = 'pending'
    AND enrollment_status = 'pending'
    AND cashfree_payment_id IS NULL
    AND paid_at IS NULL
    AND starts_at IS NULL
    AND ends_at IS NULL
    AND mentor_id IS NULL
    AND amount_cents = 14900
    AND currency = 'INR'
  );

-- 7. GRANTS
GRANT SELECT ON public.udaan_enrollments TO authenticated;
GRANT INSERT ON public.udaan_enrollments TO authenticated;

-- 8. POST-FLIGHT VERIFICATION
DO $$
DECLARE
  _col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'udaan_enrollments';

  IF _col_count < 20 THEN
    RAISE EXCEPTION '[udaan] Expected at least 20 columns, found %', _col_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'udaan_enrollments' AND policyname = 'udaan_select_own') THEN
    RAISE EXCEPTION '[udaan] RLS policy udaan_select_own not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_protect_udaan_payment_fields') THEN
    RAISE EXCEPTION '[udaan] Trigger tg_protect_udaan_payment_fields not found';
  END IF;

  RAISE NOTICE '[udaan] Migration 20261016000000 — PASSED';
END;
$$;

COMMIT;
