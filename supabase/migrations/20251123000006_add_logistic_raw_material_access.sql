-- Add RLS policies for logistic users to view raw_material_stock
-- Logistic users need read access to calculate total raw material

-- Logistic users can view all raw material stock entries
CREATE POLICY "Logistic users can view raw material stock"
  ON public.raw_material_stock FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  );
