-- ============================================================================
-- MIGRATION: Add Tracking Number and make bundle_id optional
-- Date: 2025-12-10
-- Description: Add optional tracking_number column and make bundle_id nullable
-- ============================================================================

-- Add tracking_number column to customer_purchases table
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS tracking_number text;

-- Make bundle_id nullable (since we now use product directly instead of bundle)
ALTER TABLE public.customer_purchases
ALTER COLUMN bundle_id DROP NOT NULL;

-- Create index for searching by tracking number
CREATE INDEX IF NOT EXISTS idx_customer_purchases_tracking_number ON public.customer_purchases(tracking_number);

-- ============================================================================
-- DONE!
-- ============================================================================
