-- ============================================================
-- FIX PENDING_ORDERS FOREIGN KEY CONSTRAINTS
-- Chain Stock Flow - Complete Fix
-- ============================================================
--
-- Problem 1: product_id has no foreign key constraint to products table
-- Problem 2: bundle_id column doesn't exist
--
-- This causes PostgREST to fail when trying to join tables
--
-- ============================================================

-- Step 1: Add foreign key constraint for product_id (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'pending_orders_product_id_fkey'
          AND table_name = 'pending_orders'
    ) THEN
        ALTER TABLE public.pending_orders
        ADD CONSTRAINT pending_orders_product_id_fkey
        FOREIGN KEY (product_id)
        REFERENCES public.products(id)
        ON DELETE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: pending_orders_product_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint pending_orders_product_id_fkey already exists';
    END IF;
END $$;

-- Step 2: Add bundle_id column (if not exists)
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS bundle_id UUID;

-- Step 3: Add foreign key constraint for bundle_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'pending_orders_bundle_id_fkey'
          AND table_name = 'pending_orders'
    ) THEN
        ALTER TABLE public.pending_orders
        ADD CONSTRAINT pending_orders_bundle_id_fkey
        FOREIGN KEY (bundle_id)
        REFERENCES public.bundles(id)
        ON DELETE SET NULL;

        RAISE NOTICE 'Added foreign key constraint: pending_orders_bundle_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint pending_orders_bundle_id_fkey already exists';
    END IF;
END $$;

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_orders_product_id
ON public.pending_orders(product_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_bundle_id
ON public.pending_orders(bundle_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_buyer_id
ON public.pending_orders(buyer_id);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show all foreign key constraints
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'pending_orders';

-- Show all columns
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_orders'
ORDER BY ordinal_position;

-- Show all indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'pending_orders';

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Foreign key constraints fixed!';
    RAISE NOTICE '✅ PostgREST joins will now work correctly';
    RAISE NOTICE '✅ You can now deploy the updated edge function';
END $$;
