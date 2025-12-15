-- Fix Branch inventory sync - ensure stock_in_branch records update inventory table
-- This migration ensures the trigger and function exist and syncs existing data

-- Step 1: Recreate the function to recalculate Branch inventory
CREATE OR REPLACE FUNCTION public.recalculate_branch_inventory(p_branch_id UUID, p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_in INTEGER;
  v_stock_out INTEGER;
  v_final_quantity INTEGER;
  v_existing_id UUID;
BEGIN
  -- Calculate total stock in for branch
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
  FROM public.stock_in_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- Calculate total stock out for branch
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out
  FROM public.stock_out_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- Calculate final quantity
  v_final_quantity := v_stock_in - v_stock_out;
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
    -- Insert new record
    INSERT INTO public.inventory (user_id, product_id, quantity, updated_at)
    VALUES (p_branch_id, p_product_id, v_final_quantity, now());
  END IF;
END;
$$;

-- Step 2: Recreate trigger function for stock_in_branch
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

-- Step 3: Recreate trigger function for stock_out_branch
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

-- Step 4: Create triggers
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

-- Step 5: Sync all existing stock_in_branch records to inventory
-- This ensures any existing data is properly reflected in the inventory table
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Get all unique branch_id + product_id combinations from stock_in_branch
  FOR rec IN
    SELECT DISTINCT branch_id, product_id
    FROM public.stock_in_branch
  LOOP
    PERFORM public.recalculate_branch_inventory(rec.branch_id, rec.product_id);
  END LOOP;
END;
$$;
