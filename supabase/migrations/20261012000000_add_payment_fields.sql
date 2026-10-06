-- ============================================================================
-- HELPAMART PAYMENT FIELDS MIGRATION
-- Migration: 20261012000000_add_payment_fields.sql
-- Adds Cashfree payment integration fields to bookings table
-- ============================================================================

-- Add payment provider, order ID, and enhanced payment status fields to bookings
ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'cashfree',
ADD COLUMN IF NOT EXISTS cashfree_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS payment_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS service_title TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create indexes for payment order lookups and idempotency
CREATE INDEX IF NOT EXISTS idx_bookings_cashfree_order_id ON public.bookings(cashfree_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_mentee_status ON public.bookings(mentee_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency_key ON public.bookings(mentee_id, idempotency_key);

-- Add service_title if it doesn't exist (for backward compatibility)
-- Note: This field may already exist from previous migrations

-- Update payment_status constraint to include new values if needed
-- ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
-- ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check 
--   CHECK (payment_status IN ('not_required', 'pending', 'failed', 'completed', 'refunded'));

-- All existing bookings with price_cents = 0 should have payment_status = 'not_required'
UPDATE public.bookings 
SET payment_status = 'not_required' 
WHERE price_cents = 0 AND payment_status IS NULL;

-- All existing bookings with price_cents > 0 and null payment_status should default to 'pending'
UPDATE public.bookings 
SET payment_status = 'pending' 
WHERE price_cents > 0 AND payment_status IS NULL;
