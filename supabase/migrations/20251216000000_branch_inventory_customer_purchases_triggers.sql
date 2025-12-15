-- Branch Inventory Auto-Update Triggers for customer_purchases
-- This migration adds triggers to automatically update branch inventory when:
-- 1) Return status → +Increase inventory
-- 2) Shipped status (marketer orders) → -Decrease inventory
-- 3) Shipped status (branch orders) → -Decrease inventory
-- 4) Agent purchases → -Decrease inventory

-- =====================================================
-- STEP 1: Update recalculate_branch_inventory function
-- Now includes customer_purchases for shipped/return orders
-- =====================================================

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
  -- This includes:
  -- - Orders with marketer_id (Stock Out Marketer)
  -- - Orders without marketer_id (Stock Out Branch)
  -- - Agent purchases (buyer_id is agent)
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

-- =====================================================
-- STEP 2: Create trigger function for customer_purchases
-- Handles: Shipped, Return status changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_customer_purchases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id UUID;
  v_product_id UUID;
  v_old_status TEXT;
  v_new_status TEXT;
  v_is_branch BOOLEAN;
BEGIN
  -- Determine which record to use (NEW for INSERT/UPDATE, OLD for DELETE)
  IF TG_OP = 'DELETE' THEN
    v_branch_id := OLD.seller_id;
    v_product_id := OLD.product_id;
    v_old_status := OLD.delivery_status;
    v_new_status := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_branch_id := NEW.seller_id;
    v_product_id := NEW.product_id;
    v_old_status := NULL;
    v_new_status := NEW.delivery_status;
  ELSE -- UPDATE
    v_branch_id := NEW.seller_id;
    v_product_id := NEW.product_id;
    v_old_status := OLD.delivery_status;
    v_new_status := NEW.delivery_status;
  END IF;

  -- Skip if no product_id (e.g., StoreHub orders without product mapping)
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
    -- Recalculate inventory for this branch + product
    PERFORM public.recalculate_branch_inventory(v_branch_id, v_product_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =====================================================
-- STEP 3: Create trigger on customer_purchases
-- Fires on INSERT, UPDATE, DELETE
-- =====================================================

DROP TRIGGER IF EXISTS auto_sync_branch_inventory_customer_purchases ON public.customer_purchases;
CREATE TRIGGER auto_sync_branch_inventory_customer_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_customer_purchases();

-- =====================================================
-- STEP 4: Sync existing customer_purchases to inventory
-- This ensures existing Shipped/Return orders are reflected
-- =====================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Get all unique branch + product combinations from customer_purchases
  -- where seller is a branch and has Shipped or Return status
  FOR rec IN
    SELECT DISTINCT cp.seller_id, cp.product_id
    FROM public.customer_purchases cp
    INNER JOIN public.user_roles ur ON ur.user_id = cp.seller_id AND ur.role = 'branch'
    WHERE cp.product_id IS NOT NULL
      AND cp.delivery_status IN ('Shipped', 'Return')
  LOOP
    PERFORM public.recalculate_branch_inventory(rec.seller_id, rec.product_id);
  END LOOP;
END;
$$;

-- =====================================================
-- SUMMARY OF INVENTORY FORMULA:
-- Quantity = Stock In + Return In - Stock Out Branch - Shipped Orders
--
-- Where:
-- - Stock In = sum of stock_in_branch.quantity
-- - Return In = sum of customer_purchases.quantity where delivery_status = 'Return'
-- - Stock Out Branch = sum of stock_out_branch.quantity (to agents + others)
-- - Shipped Orders = sum of customer_purchases.quantity where delivery_status = 'Shipped'
--   (includes marketer orders, branch orders, agent purchases)
-- =====================================================
