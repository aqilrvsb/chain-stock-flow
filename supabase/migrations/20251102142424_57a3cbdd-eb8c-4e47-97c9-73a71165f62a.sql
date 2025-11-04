-- Add RLS policies to pending_orders table for defense-in-depth

-- Allow authenticated users to insert their own pending orders
CREATE POLICY "Users can insert own pending orders"
ON public.pending_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

-- Allow HQ to update order status
CREATE POLICY "HQ can update order status"
ON public.pending_orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'hq'))
WITH CHECK (has_role(auth.uid(), 'hq'));

-- No DELETE policy - maintain audit trail (no one can delete pending orders)