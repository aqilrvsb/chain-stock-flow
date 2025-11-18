-- This SQL script will help diagnose and fix inventory sync issues
-- Run this in your Supabase SQL editor

-- 1. Check current inventory for the master agent (replace with actual user_id)
-- SELECT * FROM inventory WHERE user_id = 'YOUR_MASTER_AGENT_USER_ID';

-- 2. Check pending_orders (Stock In) for the master agent
-- SELECT
--   product_id,
--   SUM(quantity) as total_stock_in
-- FROM pending_orders
-- WHERE buyer_id = 'YOUR_MASTER_AGENT_USER_ID'
--   AND status = 'completed'
-- GROUP BY product_id;

-- 3. Check agent_purchases (Stock Out to Agents)
-- SELECT
--   product_id,
--   SUM(quantity) as total_stock_out_to_agents
-- FROM agent_purchases
-- WHERE master_agent_id = 'YOUR_MASTER_AGENT_USER_ID'
--   AND status = 'completed'
-- GROUP BY product_id;

-- 4. Check customer_purchases (Stock Out to Customers)
-- SELECT
--   product_id,
--   SUM(quantity) as total_stock_out_to_customers
-- FROM customer_purchases
-- WHERE seller_id = 'YOUR_MASTER_AGENT_USER_ID'
-- GROUP BY product_id;

-- 5. Recalculate and fix inventory for a specific master agent
-- This will update the inventory to match actual transaction history
-- WARNING: Replace 'YOUR_MASTER_AGENT_USER_ID' with the actual user ID before running

DO $$
DECLARE
  target_user_id uuid := 'YOUR_MASTER_AGENT_USER_ID'; -- REPLACE THIS
  product_record RECORD;
  stock_in INT;
  stock_out_agents INT;
  stock_out_customers INT;
  correct_quantity INT;
BEGIN
  -- Loop through all products
  FOR product_record IN
    SELECT DISTINCT product_id FROM pending_orders WHERE buyer_id = target_user_id
    UNION
    SELECT DISTINCT product_id FROM agent_purchases WHERE master_agent_id = target_user_id
    UNION
    SELECT DISTINCT product_id FROM customer_purchases WHERE seller_id = target_user_id
  LOOP
    -- Calculate Stock In
    SELECT COALESCE(SUM(quantity), 0) INTO stock_in
    FROM pending_orders
    WHERE buyer_id = target_user_id
      AND product_id = product_record.product_id
      AND status = 'completed';

    -- Calculate Stock Out to Agents
    SELECT COALESCE(SUM(quantity), 0) INTO stock_out_agents
    FROM agent_purchases
    WHERE master_agent_id = target_user_id
      AND product_id = product_record.product_id
      AND status = 'completed';

    -- Calculate Stock Out to Customers
    SELECT COALESCE(SUM(quantity), 0) INTO stock_out_customers
    FROM customer_purchases
    WHERE seller_id = target_user_id
      AND product_id = product_record.product_id;

    -- Calculate correct quantity
    correct_quantity := stock_in - stock_out_agents - stock_out_customers;

    -- Update or insert inventory record
    INSERT INTO inventory (user_id, product_id, quantity)
    VALUES (target_user_id, product_record.product_id, correct_quantity)
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET
      quantity = correct_quantity,
      updated_at = NOW();

    RAISE NOTICE 'Product %: Stock In = %, Stock Out (Agents) = %, Stock Out (Customers) = %, Final Quantity = %',
      product_record.product_id, stock_in, stock_out_agents, stock_out_customers, correct_quantity;
  END LOOP;
END $$;
