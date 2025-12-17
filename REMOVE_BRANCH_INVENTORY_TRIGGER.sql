-- ============================================================================
-- REMOVE: Branch Inventory Trigger for Customer Purchases
-- Run this SQL in Supabase SQL Editor
--
-- This removes the trigger that auto-recalculates inventory when customer_purchases
-- are inserted/updated/deleted. The code will handle inventory deduction directly.
-- ============================================================================

-- Drop the trigger
DROP TRIGGER IF EXISTS auto_sync_branch_inventory_customer_purchases ON public.customer_purchases;

-- Optionally drop the function (only if not used elsewhere)
DROP FUNCTION IF EXISTS public.auto_sync_branch_inventory_customer_purchases();

-- Verify trigger is removed
SELECT
  tgname as trigger_name,
  relname as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE relname = 'customer_purchases'
  AND tgname LIKE '%inventory%';

-- Should return empty result if trigger is removed successfully
