-- ============================================================================
-- MIGRATION: Add Closing Type (Jenis Closing) to Customer Purchases
-- Date: 2025-12-10
-- Description: Add closing_type column to track how the sale was closed
-- ============================================================================

-- Add closing_type column to customer_purchases table
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS closing_type text CHECK (
  closing_type IS NULL OR closing_type = ANY (ARRAY[
    'Website'::text,
    'WhatsappBot'::text,
    'Call'::text,
    'Manual'::text,
    'Live'::text,
    'Shop'::text,
    'Walk In'::text
  ])
);

-- Create index for filtering by closing_type
CREATE INDEX IF NOT EXISTS idx_customer_purchases_closing_type ON public.customer_purchases(closing_type);

-- ============================================================================
-- DONE!
-- ============================================================================
