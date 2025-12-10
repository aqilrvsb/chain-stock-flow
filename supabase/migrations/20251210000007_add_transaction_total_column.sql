-- ============================================================================
-- MIGRATION: Add transaction_total column for StoreHub invoice totals
-- Date: 2025-12-10
-- Description: Store the full transaction/invoice total to match StoreHub totals
-- ============================================================================

-- Add transaction_total column to store the full invoice total from StoreHub
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS transaction_total numeric(10,2);

-- Add storehub_invoice column to store the invoice number for grouping
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS storehub_invoice text;

-- ============================================================================
-- DONE!
-- ============================================================================
