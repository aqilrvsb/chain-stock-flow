-- Create raw_material_stock table for non-processed products
CREATE TABLE IF NOT EXISTS public.raw_material_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT raw_material_stock_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT raw_material_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Add RLS policies for raw_material_stock
ALTER TABLE public.raw_material_stock ENABLE ROW LEVEL SECURITY;

-- HQ users can view all raw material stock entries
CREATE POLICY "HQ users can view raw material stock"
  ON public.raw_material_stock
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can insert raw material stock entries
CREATE POLICY "HQ users can insert raw material stock"
  ON public.raw_material_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can update raw material stock entries
CREATE POLICY "HQ users can update raw material stock"
  ON public.raw_material_stock
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- HQ users can delete raw material stock entries
CREATE POLICY "HQ users can delete raw material stock"
  ON public.raw_material_stock
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'hq'
    )
  );

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS raw_material_stock_product_id_idx ON public.raw_material_stock(product_id);
CREATE INDEX IF NOT EXISTS raw_material_stock_user_id_idx ON public.raw_material_stock(user_id);
CREATE INDEX IF NOT EXISTS raw_material_stock_date_idx ON public.raw_material_stock(date DESC);
