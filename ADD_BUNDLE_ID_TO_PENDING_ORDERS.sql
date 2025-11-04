-- ============================================================
-- ADD BUNDLE_ID TO PENDING_ORDERS TABLE
-- Chain Stock Flow - Fix Bundle Display Issue
-- ============================================================
--
-- Problem: Transaction History shows order numbers (ON5, ON4)
--          instead of bundle names in the "Bundle" column
--
-- Solution: Add bundle_id foreign key to pending_orders table
--
-- ============================================================

-- Add bundle_id column to pending_orders
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.bundles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_orders_bundle_id
ON public.pending_orders(bundle_id);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_orders'
  AND column_name = 'bundle_id';

-- Show all pending_orders columns (alternative to \d)
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pending_orders'
ORDER BY ordinal_position;

-- ============================================================
-- NOTES
-- ============================================================
--
-- After running this script, you also need to:
-- 1. Update billplz-payment edge function to save bundle_id
-- 2. Update TransactionHistory.tsx to join with bundles table
-- 3. Update display to show bundle.name instead of order_number
--
-- ============================================================
