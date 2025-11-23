-- Add RLS policy for HQ users to view processed stock
-- HQ users need read access to view processed stock data

-- HQ users can view all processed stock entries
CREATE POLICY "HQ users can view processed stock"
  ON public.processed_stock FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );
