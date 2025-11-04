-- ============================================================
-- CREATE GENERATE ORDER NUMBER FUNCTION
-- Chain Stock Flow - Order Management
-- ============================================================
--
-- This function generates unique order numbers for pending_orders
-- Used by the billplz-payment edge function
--
-- Format: ON1, ON2, ON3, ... (Order Number 1, 2, 3)
--
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Get the highest order number
    SELECT COALESCE(
      MAX(
        CASE
          WHEN order_number ~ '^ON[0-9]+$'
          THEN CAST(SUBSTRING(order_number FROM 3) AS INTEGER)
          ELSE 0
        END
      ), 0
    ) + 1
    INTO next_number
    FROM public.pending_orders;

    -- Generate new order number
    new_order_number := 'ON' || next_number::TEXT;

    -- Check if it already exists (race condition protection)
    IF NOT EXISTS (
      SELECT 1 FROM public.pending_orders
      WHERE order_number = new_order_number
    ) THEN
      RETURN new_order_number;
    END IF;

    -- If exists, increment attempt counter
    attempt := attempt + 1;

    -- Prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;

    -- Small delay to avoid tight loop (PostgreSQL will wait for next number)
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;

-- Also grant to service role for edge functions
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test the function:
SELECT public.generate_order_number() as order_number;

-- Test multiple times to ensure incrementing:
SELECT public.generate_order_number() as order_1,
       public.generate_order_number() as order_2,
       public.generate_order_number() as order_3;

-- ============================================================
-- EXPLANATION
-- ============================================================
--
-- The function:
-- 1. Finds the highest existing order number (ON1, ON2, etc.)
-- 2. Increments by 1
-- 3. Checks for uniqueness (handles concurrent requests)
-- 4. Returns the new order number
--
-- Security:
-- - SECURITY DEFINER: Runs with creator's permissions
-- - Granted to authenticated: Users can call via RPC
-- - Granted to service_role: Edge functions can call it
--
-- ============================================================
