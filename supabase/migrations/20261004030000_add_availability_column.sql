-- =============================================================================
-- HELPAMART — Add availability column to public.mentors
-- Migration: 20261004030000_add_availability_column.sql
--
-- The availability column stores the mentor's weekly recurring schedule as a
-- JSONB array of AvailabilityRule objects:
--   [{ weekday: 0-6, startTime: "HH:MM", endTime: "HH:MM", enabled: bool }]
--
-- This column was present in the superseded 20261004010000 migration but was
-- omitted from the authoritative 20261004020000 schema.  This migration adds
-- it safely using ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.mentors.availability IS
  'Weekly recurring availability rules: [{weekday,startTime,endTime,enabled}]';

-- Notify PostgREST to reload schema cache so the new column is immediately visible
NOTIFY pgrst, 'reload schema';
