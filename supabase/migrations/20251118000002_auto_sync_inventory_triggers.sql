-- Migration to add automatic inventory synchronization triggers
-- This prevents inventory from getting out of sync by automatically
-- recalculating it whenever transactions are modified

-- Trigger function that recalculates inventory after transaction changes
CREATE OR REPLACE FUNCTION public.auto_recalc_inventory_after_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_user_id UUID;
  affected_product_id UUID;
BEGIN
  -- Determine which user and product were affected
  IF TG_TABLE_NAME = 'pending_orders' THEN
    -- For pending_orders, buyer's inventory is affected
    affected_user_id := COALESCE(NEW.buyer_id, OLD.buyer_id);
    affected_product_id := COALESCE(NEW.product_id, OLD.product_id);

    -- Also need to update HQ inventory if status changed to/from completed
    IF (NEW.status = 'completed' AND OLD.status != 'completed') OR
       (OLD.status = 'completed' AND NEW.status != 'completed') OR
       TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
      -- Get HQ user and recalculate their inventory
      DECLARE
        hq_user_id UUID;
      BEGIN
        SELECT user_id INTO hq_user_id
        FROM user_roles
        WHERE role = 'hq'
        LIMIT 1;

        IF hq_user_id IS NOT NULL THEN
          PERFORM public.recalculate_inventory(hq_user_id, affected_product_id);
        END IF;
      END;
    END IF;

  ELSIF TG_TABLE_NAME = 'agent_purchases' THEN
    -- For agent_purchases, both agent and master agent are affected
    -- Recalculate agent inventory
    affected_user_id := COALESCE(NEW.agent_id, OLD.agent_id);
    affected_product_id := COALESCE(NEW.product_id, OLD.product_id);
    PERFORM public.recalculate_inventory(affected_user_id, affected_product_id);

    -- Recalculate master agent inventory
    affected_user_id := COALESCE(NEW.master_agent_id, OLD.master_agent_id);
    IF affected_user_id IS NOT NULL THEN
      PERFORM public.recalculate_inventory(affected_user_id, affected_product_id);
    END IF;

    RETURN COALESCE(NEW, OLD);

  ELSIF TG_TABLE_NAME = 'customer_purchases' THEN
    -- For customer_purchases, seller's inventory is affected
    affected_user_id := COALESCE(NEW.seller_id, OLD.seller_id);
    affected_product_id := COALESCE(NEW.product_id, OLD.product_id);

  ELSIF TG_TABLE_NAME = 'stock_in_hq' THEN
    -- For stock_in_hq, HQ inventory is affected
    affected_user_id := COALESCE(NEW.user_id, OLD.user_id);
    affected_product_id := COALESCE(NEW.product_id, OLD.product_id);
  END IF;

  -- Recalculate inventory for the affected user and product
  IF affected_user_id IS NOT NULL AND affected_product_id IS NOT NULL THEN
    PERFORM public.recalculate_inventory(affected_user_id, affected_product_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add triggers to all transaction tables

-- Trigger for pending_orders (Master Agent purchases from HQ)
DROP TRIGGER IF EXISTS auto_sync_inventory_pending_orders ON public.pending_orders;
CREATE TRIGGER auto_sync_inventory_pending_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_inventory_after_transaction();

-- Trigger for agent_purchases (Agent purchases from Master Agent)
DROP TRIGGER IF EXISTS auto_sync_inventory_agent_purchases ON public.agent_purchases;
CREATE TRIGGER auto_sync_inventory_agent_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_inventory_after_transaction();

-- Trigger for customer_purchases (Customer purchases from Agent/MA)
DROP TRIGGER IF EXISTS auto_sync_inventory_customer_purchases ON public.customer_purchases;
CREATE TRIGGER auto_sync_inventory_customer_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_inventory_after_transaction();

-- Trigger for stock_in_hq (HQ receiving stock)
DROP TRIGGER IF EXISTS auto_sync_inventory_stock_in_hq ON public.stock_in_hq;
CREATE TRIGGER auto_sync_inventory_stock_in_hq
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_in_hq
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_inventory_after_transaction();

-- Add comments
COMMENT ON FUNCTION public.auto_recalc_inventory_after_transaction IS 'Automatically recalculates inventory whenever transaction records are modified';
COMMENT ON TRIGGER auto_sync_inventory_pending_orders ON public.pending_orders IS 'Auto-sync inventory when pending_orders change';
COMMENT ON TRIGGER auto_sync_inventory_agent_purchases ON public.agent_purchases IS 'Auto-sync inventory when agent_purchases change';
COMMENT ON TRIGGER auto_sync_inventory_customer_purchases ON public.customer_purchases IS 'Auto-sync inventory when customer_purchases change';
COMMENT ON TRIGGER auto_sync_inventory_stock_in_hq ON public.stock_in_hq IS 'Auto-sync inventory when stock_in_hq change';
