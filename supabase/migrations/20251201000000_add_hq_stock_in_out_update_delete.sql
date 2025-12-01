-- Add UPDATE and DELETE RLS policies for HQ users on stock_in_hq and stock_out_hq tables

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HQ users can update stock in" ON public.stock_in_hq;
DROP POLICY IF EXISTS "HQ users can delete stock in" ON public.stock_in_hq;
DROP POLICY IF EXISTS "HQ users can update stock out" ON public.stock_out_hq;
DROP POLICY IF EXISTS "HQ users can delete stock out" ON public.stock_out_hq;

-- HQ users can update stock_in_hq entries
CREATE POLICY "HQ users can update stock in"
  ON public.stock_in_hq FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can delete stock_in_hq entries
CREATE POLICY "HQ users can delete stock in"
  ON public.stock_in_hq FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can update stock_out_hq entries
CREATE POLICY "HQ users can update stock out"
  ON public.stock_out_hq FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can delete stock_out_hq entries
CREATE POLICY "HQ users can delete stock out"
  ON public.stock_out_hq FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );
