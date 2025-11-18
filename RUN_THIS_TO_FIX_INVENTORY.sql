-- ========================================
-- RUN THIS SQL IN SUPABASE SQL EDITOR
-- ========================================
-- This will fix the inventory quantities to match transaction history
--
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Copy and paste this entire script
-- 4. Click "Run" button
-- 5. Refresh your inventory page
--
-- ========================================

-- First, apply the migration (if not already done)
-- The migration creates the recalculate_inventory functions

-- Then, recalculate inventory for ALL users
DO $$
DECLARE
  user_record RECORD;
  result_record RECORD;
  total_users INTEGER := 0;
  total_products INTEGER := 0;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Starting inventory recalculation for all users...';
  RAISE NOTICE '==================================================';

  -- Loop through all users
  FOR user_record IN
    SELECT DISTINCT p.id, p.full_name, p.idstaff, ur.role
    FROM profiles p
    INNER JOIN user_roles ur ON p.id = ur.user_id
    WHERE ur.role IN ('hq', 'master_agent', 'agent')
    ORDER BY ur.role, p.full_name
  LOOP
    total_users := total_users + 1;
    RAISE NOTICE '';
    RAISE NOTICE 'Processing: % (%) - Role: %',
      COALESCE(user_record.full_name, 'Unnamed'),
      COALESCE(user_record.idstaff, user_record.id::TEXT),
      user_record.role;
    RAISE NOTICE '---';

    -- Recalculate all inventory for this user
    FOR result_record IN
      SELECT * FROM public.recalculate_all_inventory_for_user(user_record.id)
    LOOP
      total_products := total_products + 1;
      RAISE NOTICE '  Product ID: % -> New Quantity: %',
        result_record.product_id,
        result_record.new_quantity;
    END LOOP;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'COMPLETED!';
  RAISE NOTICE 'Processed % users and recalculated % inventory records',
    total_users,
    total_products;
  RAISE NOTICE '==================================================';
END $$;

-- Verify the results by checking a sample of inventory
SELECT
  p.full_name,
  p.idstaff,
  pr.name as product_name,
  pr.sku,
  i.quantity as current_inventory
FROM inventory i
INNER JOIN profiles p ON i.user_id = p.id
INNER JOIN products pr ON i.product_id = pr.id
ORDER BY p.full_name, pr.name;
