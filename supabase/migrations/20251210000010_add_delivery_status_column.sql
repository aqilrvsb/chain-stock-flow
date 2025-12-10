-- ============================================================================
-- MIGRATION: Add delivery status columns to customer_purchases
-- Date: 2025-12-10
-- Description: Add columns for logistics tracking in Branch
-- ============================================================================

-- Add delivery_status column
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'Pending';

-- Add date columns for tracking
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS date_processed date;

ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS date_return date;

ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS tarikh_bayaran date;

ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS seo text;

-- ============================================================================
-- DONE!
-- ============================================================================
