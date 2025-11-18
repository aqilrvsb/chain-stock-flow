-- Migration to add inventory recalculation function
-- This ensures inventory quantities stay in sync with transaction history

-- Function to recalculate inventory for a specific user and product
CREATE OR REPLACE FUNCTION public.recalculate_inventory(p_user_id UUID, p_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_in INTEGER := 0;
  v_stock_out_agents INTEGER := 0;
  v_stock_out_customers INTEGER := 0;
  v_correct_quantity INTEGER;
  v_user_role TEXT;
BEGIN
  -- Get user role
  SELECT role::TEXT INTO v_user_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_user_role = 'master_agent' THEN
    -- For Master Agents:
    -- Stock In = completed purchases from HQ
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
    FROM pending_orders
    WHERE buyer_id = p_user_id
      AND product_id = p_product_id
      AND status = 'completed';

    -- Stock Out to Agents
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out_agents
    FROM agent_purchases
    WHERE master_agent_id = p_user_id
      AND product_id = p_product_id
      AND status = 'completed';

    -- Stock Out to Customers
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out_customers
    FROM customer_purchases
    WHERE seller_id = p_user_id
      AND product_id = p_product_id;

    v_correct_quantity := v_stock_in - v_stock_out_agents - v_stock_out_customers;

  ELSIF v_user_role = 'agent' THEN
    -- For Agents:
    -- Stock In = completed purchases from Master Agent
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
    FROM agent_purchases
    WHERE agent_id = p_user_id
      AND product_id = p_product_id
      AND status = 'completed';

    -- Stock Out to Customers
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out_customers
    FROM customer_purchases
    WHERE seller_id = p_user_id
      AND product_id = p_product_id;

    v_correct_quantity := v_stock_in - v_stock_out_customers;

  ELSIF v_user_role = 'hq' THEN
    -- For HQ:
    -- Stock In = stock_in_hq records
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
    FROM stock_in_hq
    WHERE user_id = p_user_id
      AND product_id = p_product_id;

    -- Stock Out = completed orders to master agents
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out_agents
    FROM pending_orders
    WHERE product_id = p_product_id
      AND status = 'completed';

    v_correct_quantity := v_stock_in - v_stock_out_agents;

  ELSE
    v_correct_quantity := 0;
  END IF;

  -- Update or insert the inventory record
  INSERT INTO inventory (user_id, product_id, quantity, updated_at)
  VALUES (p_user_id, p_product_id, v_correct_quantity, NOW())
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET
    quantity = v_correct_quantity,
    updated_at = NOW();

  RETURN v_correct_quantity;
END;
$$;

-- Function to recalculate ALL inventory for a user
CREATE OR REPLACE FUNCTION public.recalculate_all_inventory_for_user(p_user_id UUID)
RETURNS TABLE(product_id UUID, new_quantity INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_record RECORD;
  v_new_quantity INTEGER;
BEGIN
  -- Get all products this user has ever transacted with
  FOR v_product_record IN
    SELECT DISTINCT po.product_id
    FROM pending_orders po
    WHERE po.buyer_id = p_user_id
    UNION
    SELECT DISTINCT ap.product_id
    FROM agent_purchases ap
    WHERE ap.agent_id = p_user_id OR ap.master_agent_id = p_user_id
    UNION
    SELECT DISTINCT cp.product_id
    FROM customer_purchases cp
    WHERE cp.seller_id = p_user_id
    UNION
    SELECT DISTINCT si.product_id
    FROM stock_in_hq si
    WHERE si.user_id = p_user_id
  LOOP
    v_new_quantity := public.recalculate_inventory(p_user_id, v_product_record.product_id);
    product_id := v_product_record.product_id;
    new_quantity := v_new_quantity;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.recalculate_inventory(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_inventory_for_user(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.recalculate_inventory IS 'Recalculates inventory quantity based on transaction history for a specific user and product';
COMMENT ON FUNCTION public.recalculate_all_inventory_for_user IS 'Recalculates all inventory records for a specific user';
