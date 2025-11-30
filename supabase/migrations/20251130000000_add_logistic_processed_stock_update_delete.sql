-- Add UPDATE and DELETE RLS policies for logistic users on processed_stock table

-- Logistic users can update processed stock entries
CREATE POLICY "Logistic users can update processed stock"
  ON public.processed_stock FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  );

-- Logistic users can delete processed stock entries
CREATE POLICY "Logistic users can delete processed stock"
  ON public.processed_stock FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  );
