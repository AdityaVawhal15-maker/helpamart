-- ============================================================================
-- HELPAMART COMPLETE PRODUCTION DATABASE SCHEMA
-- Migration: 20261004010000_complete_schema.sql
-- Covers: Profiles, Mentors, Services, Availability, Bookings, Calendar & Meet
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE (Syncs from auth.users)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  languages TEXT[] DEFAULT '{"English"}',
  interests TEXT[] DEFAULT '{}',
  title TEXT,
  company TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. MENTORS TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  languages TEXT[] DEFAULT '{"English"}',
  categories TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  years_experience INTEGER,
  linkedin_url TEXT,
  website_url TEXT,
  education TEXT[] DEFAULT '{}',
  companies TEXT[] DEFAULT '{}',
  achievements TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  advance_days INTEGER NOT NULL DEFAULT 30,
  min_notice_hours INTEGER NOT NULL DEFAULT 24,
  max_bookings_per_day INTEGER NOT NULL DEFAULT 4,
  services JSONB DEFAULT '[]'::jsonb,
  availability JSONB DEFAULT '[]'::jsonb,
  starting_price_cents INTEGER,
  rating NUMERIC(3, 2) DEFAULT 5.0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mentors_status ON public.mentors(status);
CREATE INDEX IF NOT EXISTS idx_mentors_slug ON public.mentors(slug);
CREATE INDEX IF NOT EXISTS idx_mentors_categories ON public.mentors USING GIN(categories);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. MENTOR SERVICES TABLE (Optional relational table for services)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  format TEXT NOT NULL DEFAULT 'online',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mentor_services_mentor_id ON public.mentor_services(mentor_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. AVAILABILITY RULES TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_mentor_id ON public.availability_rules(mentor_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. AVAILABILITY EXCEPTIONS TABLE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'blocked',
  start_time TEXT,
  end_time TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. CALENDAR CONNECTIONS TABLE (Google Calendar OAuth tokens)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  account_email TEXT,
  calendar_id TEXT DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. BOOKINGS TABLE (Complete session tracking with Google Meet link)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  mentor_email TEXT,
  student_email TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  meet_link TEXT,
  calendar_event_id TEXT,
  calendar_status TEXT,
  notes TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_mentor_start ON public.bookings(mentor_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_mentee_id ON public.bookings(mentee_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, owner insert/update
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Mentors: Public read for published mentors (or own profile for the creator)
DROP POLICY IF EXISTS "Published mentors are viewable by everyone" ON public.mentors;
CREATE POLICY "Published mentors are viewable by everyone" ON public.mentors FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their mentor profile" ON public.mentors;
CREATE POLICY "Users can insert their mentor profile" ON public.mentors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their mentor profile" ON public.mentors;
CREATE POLICY "Users can update their mentor profile" ON public.mentors FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Mentor Services: Public read for published mentors, owner manage
DROP POLICY IF EXISTS "Services viewable by everyone" ON public.mentor_services;
CREATE POLICY "Services viewable by everyone" ON public.mentor_services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mentors manage own services" ON public.mentor_services;
CREATE POLICY "Mentors manage own services" ON public.mentor_services FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- Availability Rules: Public read, owner manage
DROP POLICY IF EXISTS "Availability rules viewable by everyone" ON public.availability_rules;
CREATE POLICY "Availability rules viewable by everyone" ON public.availability_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mentors manage own availability rules" ON public.availability_rules;
CREATE POLICY "Mentors manage own availability rules" ON public.availability_rules FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- Bookings: Both Student and Mentor can see their bookings
DROP POLICY IF EXISTS "Users can view their own bookings as student or mentor" ON public.bookings;
CREATE POLICY "Users can view their own bookings as student or mentor" ON public.bookings FOR SELECT
  USING (auth.uid() = mentee_id OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

DROP POLICY IF EXISTS "Students can create bookings" ON public.bookings;
CREATE POLICY "Students can create bookings" ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = mentee_id);

DROP POLICY IF EXISTS "Student or mentor can update booking status" ON public.bookings;
CREATE POLICY "Student or mentor can update booking status" ON public.bookings FOR UPDATE
  USING (auth.uid() = mentee_id OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- Calendar connections: Owner only
DROP POLICY IF EXISTS "Users manage own calendar connection" ON public.calendar_connections;
CREATE POLICY "Users manage own calendar connection" ON public.calendar_connections FOR ALL
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. AUTH TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
