-- ============================================================================
-- MIGRATION: Add platform column to track source of purchases
-- Date: 2025-12-10
-- Description: Track where the purchase came from (StoreHub, Manual, etc.)
-- ============================================================================

-- Add platform column to customer_purchases
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS platform text DEFAULT 'Manual';

-- Update existing StoreHub entries (those with storehub_invoice) to have platform = 'StoreHub'
UPDATE public.customer_purchases
SET platform = 'StoreHub'
WHERE storehub_invoice IS NOT NULL OR remarks LIKE 'StoreHub:%';

-- ============================================================================
-- DONE!
-- ============================================================================
