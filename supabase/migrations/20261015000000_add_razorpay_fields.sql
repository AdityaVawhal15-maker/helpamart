-- ============================================================================
-- HELPAMART RAZORPAY PAYMENT FIELDS MIGRATION
-- Migration: 20261015000000_add_razorpay_fields.sql
-- Adds Razorpay payment integration fields to bookings table
-- ============================================================================

-- Add Razorpay-specific fields to bookings table
ALTER TABLE IF EXISTS public.bookings
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

-- Create indexes for Razorpay order and payment lookups
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id ON public.bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_payment_id ON public.bookings(razorpay_payment_id);
