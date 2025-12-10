-- ============================================================================
-- MIGRATION: Make product_id nullable and add storehub_product column
-- Date: 2025-12-10
-- Description: Allow customer_purchases without a matching local product
--              and store StoreHub product name for reference
-- ============================================================================

-- Make product_id nullable in customer_purchases
ALTER TABLE public.customer_purchases
ALTER COLUMN product_id DROP NOT NULL;

-- Add storehub_product column to store product name from StoreHub
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS storehub_product text;

-- ============================================================================
-- DONE!
-- ============================================================================
