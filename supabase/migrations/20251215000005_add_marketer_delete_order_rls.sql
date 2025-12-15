-- =====================================================
-- Migration: Add RLS policy for marketers to delete their orders
-- Date: 2025-12-15
-- Description: Marketers can delete orders they created (marketer_id = auth.uid())
-- =====================================================

-- Allow marketers to delete their own orders
CREATE POLICY "Marketers can delete their own orders"
ON public.customer_purchases
FOR DELETE
TO authenticated
USING (
  marketer_id = auth.uid()
);

-- Also add UPDATE policy for marketers to update their orders (for edit functionality)
CREATE POLICY "Marketers can update their own orders"
ON public.customer_purchases
FOR UPDATE
TO authenticated
USING (
  marketer_id = auth.uid()
)
WITH CHECK (
  marketer_id = auth.uid()
);

-- Allow Branch to delete orders under their branch (seller_id = branch user id)
CREATE POLICY "Branch can delete orders under their branch"
ON public.customer_purchases
FOR DELETE
TO authenticated
USING (
  seller_id = auth.uid()
);

-- Allow Branch to update orders under their branch
CREATE POLICY "Branch can update orders under their branch"
ON public.customer_purchases
FOR UPDATE
TO authenticated
USING (
  seller_id = auth.uid()
)
WITH CHECK (
  seller_id = auth.uid()
);
