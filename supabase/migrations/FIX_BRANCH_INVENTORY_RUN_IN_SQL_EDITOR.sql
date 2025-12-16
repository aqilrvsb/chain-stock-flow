-- ============================================================================
-- FIX: Branch Inventory Triggers
-- Run this SQL in Supabase SQL Editor to fix branch inventory sync
-- This will make stock_in_branch automatically update the inventory table
-- ============================================================================

-- Step 1: Create/Replace the recalculate function
CREATE OR REPLACE FUNCTION public.recalculate_branch_inventory(p_branch_id UUID, p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_in INTEGER;
  v_stock_out_branch INTEGER;
  v_return_in INTEGER;
  v_shipped_orders INTEGER;
  v_final_quantity INTEGER;
  v_existing_id UUID;
BEGIN
  -- 1) Calculate total stock in for branch (from HQ approval)
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
  FROM public.stock_in_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- 2) Calculate total stock out from stock_out_branch table
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out_branch
  FROM public.stock_out_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- 3) Calculate Return In (delivery_status = 'Return') - adds back to inventory
  SELECT COALESCE(SUM(quantity), 0) INTO v_return_in
  FROM public.customer_purchases
  WHERE seller_id = p_branch_id
    AND product_id = p_product_id
    AND delivery_status = 'Return';

  -- 4) Calculate Shipped orders (all types: marketer, branch, agent)
  SELECT COALESCE(SUM(quantity), 0) INTO v_shipped_orders
  FROM public.customer_purchases
  WHERE seller_id = p_branch_id
    AND product_id = p_product_id
    AND delivery_status = 'Shipped';

  -- Calculate final quantity:
  -- Stock In + Return In - Stock Out Branch - Shipped Orders
  v_final_quantity := v_stock_in + v_return_in - v_stock_out_branch - v_shipped_orders;

  IF v_final_quantity < 0 THEN
    v_final_quantity := 0;
  END IF;

  -- Check if inventory record exists
  SELECT id INTO v_existing_id
  FROM public.inventory
  WHERE user_id = p_branch_id AND product_id = p_product_id;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing record
    UPDATE public.inventory
    SET quantity = v_final_quantity, updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- Insert new record only if there's inventory to track
    IF v_final_quantity > 0 OR v_stock_in > 0 THEN
      INSERT INTO public.inventory (user_id, product_id, quantity, updated_at)
      VALUES (p_branch_id, p_product_id, v_final_quantity, now());
    END IF;
  END IF;
END;
$$;

-- Step 2: Create trigger function for stock_in_branch
CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_stock_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_branch_inventory(OLD.branch_id, OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_branch_inventory(NEW.branch_id, NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Step 3: Create trigger function for stock_out_branch
CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_stock_out()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_branch_inventory(OLD.branch_id, OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_branch_inventory(NEW.branch_id, NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Step 4: Create trigger function for customer_purchases
CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_customer_purchases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id UUID;
  v_product_id UUID;
  v_is_branch BOOLEAN;
BEGIN
  -- Determine which record to use (NEW for INSERT/UPDATE, OLD for DELETE)
  IF TG_OP = 'DELETE' THEN
    v_branch_id := OLD.seller_id;
    v_product_id := OLD.product_id;
  ELSE
    v_branch_id := NEW.seller_id;
    v_product_id := NEW.product_id;
  END IF;

  -- Skip if no product_id
  IF v_product_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Check if seller is a branch
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_branch_id AND role = 'branch'
  ) INTO v_is_branch;

  -- Only process if seller is a branch
  IF v_is_branch THEN
    PERFORM public.recalculate_branch_inventory(v_branch_id, v_product_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Step 5: Create/Replace triggers
DROP TRIGGER IF EXISTS auto_sync_inventory_stock_in_branch ON public.stock_in_branch;
CREATE TRIGGER auto_sync_inventory_stock_in_branch
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_in_branch
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_stock_in();

DROP TRIGGER IF EXISTS auto_sync_inventory_stock_out_branch ON public.stock_out_branch;
CREATE TRIGGER auto_sync_inventory_stock_out_branch
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_out_branch
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_stock_out();

DROP TRIGGER IF EXISTS auto_sync_branch_inventory_customer_purchases ON public.customer_purchases;
CREATE TRIGGER auto_sync_branch_inventory_customer_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_customer_purchases();

-- Step 6: Sync ALL existing stock_in_branch records to inventory table
-- This recalculates inventory for all branches with stock
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Get all unique branch_id + product_id combinations
  FOR rec IN
    SELECT DISTINCT branch_id, product_id
    FROM public.stock_in_branch
  LOOP
    PERFORM public.recalculate_branch_inventory(rec.branch_id, rec.product_id);
  END LOOP;

  RAISE NOTICE 'Branch inventory sync completed!';
END;
$$;

-- Verify: Check inventory table has been updated
SELECT
  p.name as product_name,
  p.sku,
  i.quantity,
  i.updated_at
FROM public.inventory i
JOIN public.products p ON p.id = i.product_id
JOIN public.user_roles ur ON ur.user_id = i.user_id AND ur.role = 'branch'
ORDER BY i.updated_at DESC
LIMIT 20;
