-- =============================================================================
-- HELPAMART — Central Google service connection
-- Migration: 20261004070000_google_service_connection.sql
--
-- Stores the single central HELPAMART Google account connection used for
-- creating Calendar events and Google Meet conferences on behalf of all
-- bookings.  One row, identified by key = 'helpamart_organizer'.
--
-- The refresh token is stored here as a fallback/audit record.
-- The primary storage is the HELPAMART_GOOGLE_REFRESH_TOKEN Vercel env var.
--
-- Per-mentor calendar_connections rows are no longer required for booking;
-- this table replaces that dependency for the organizer account.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.google_service_connections (
  key           TEXT        PRIMARY KEY,          -- e.g. 'helpamart_organizer'
  provider      TEXT        NOT NULL DEFAULT 'google',
  account_email TEXT,                             -- display only, e.g. calendar@helpamart.com
  refresh_token TEXT,                             -- server-side only, never exposed to browser
  access_token  TEXT,
  expiry        TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'disconnected',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Only service-role can read/write this table (RLS blocks all anon + authenticated access)
ALTER TABLE public.google_service_connections ENABLE ROW LEVEL SECURITY;

-- No public access policy — service role bypasses RLS, so this is effectively
-- server-only storage. The anon/authenticated roles cannot read tokens.
-- (no CREATE POLICY here means no JWT-based access at all)

COMMENT ON TABLE public.google_service_connections IS
  'Central HELPAMART Google account used as the Calendar organizer for all bookings. '
  'Refresh token stored here is used server-side only. '
  'Primary secret lives in HELPAMART_GOOGLE_REFRESH_TOKEN Vercel env var.';

NOTIFY pgrst, 'reload schema';
