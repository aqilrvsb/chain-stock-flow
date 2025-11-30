-- Add UPDATE and DELETE RLS policies for HQ users on raw_material_stock table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HQ users can update raw material stock" ON public.raw_material_stock;
DROP POLICY IF EXISTS "HQ users can delete raw material stock" ON public.raw_material_stock;

-- HQ users can update raw material stock entries
CREATE POLICY "HQ users can update raw material stock"
  ON public.raw_material_stock FOR UPDATE TO authenticated
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

-- HQ users can delete raw material stock entries
CREATE POLICY "HQ users can delete raw material stock"
  ON public.raw_material_stock FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );
