-- Create branch_bundles table for combo bundles
CREATE TABLE IF NOT EXISTS public.branch_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sku text, -- Auto-generated SKU: SKU_A-unit + SKU_B-unit format
  total_price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_bundles_pkey PRIMARY KEY (id),
  CONSTRAINT branch_bundles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create branch_bundle_items table for bundle items (products and quantities)
CREATE TABLE IF NOT EXISTS public.branch_bundle_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_bundle_items_pkey PRIMARY KEY (id),
  CONSTRAINT branch_bundle_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.branch_bundles(id) ON DELETE CASCADE,
  CONSTRAINT branch_bundle_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT branch_bundle_items_unique UNIQUE (bundle_id, product_id)
);

-- Enable RLS
ALTER TABLE public.branch_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_bundle_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for branch_bundles
CREATE POLICY "Branch can manage own bundles"
  ON public.branch_bundles
  FOR ALL
  USING (branch_id = auth.uid())
  WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can view own bundles"
  ON public.branch_bundles
  FOR SELECT
  USING (branch_id = auth.uid());

-- RLS policies for branch_bundle_items
CREATE POLICY "Branch can manage bundle items"
  ON public.branch_bundle_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.branch_bundles bb
      WHERE bb.id = bundle_id AND bb.branch_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.branch_bundles bb
      WHERE bb.id = bundle_id AND bb.branch_id = auth.uid()
    )
  );

CREATE POLICY "Branch can view bundle items"
  ON public.branch_bundle_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.branch_bundles bb
      WHERE bb.id = bundle_id AND bb.branch_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_bundles_branch_id ON public.branch_bundles(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_bundle_items_bundle_id ON public.branch_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_branch_bundle_items_product_id ON public.branch_bundle_items(product_id);

-- Add branch_bundle_id to customer_purchases for tracking which bundle was purchased
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS branch_bundle_id uuid;
ALTER TABLE public.customer_purchases ADD CONSTRAINT customer_purchases_branch_bundle_id_fkey
  FOREIGN KEY (branch_bundle_id) REFERENCES public.branch_bundles(id) ON DELETE SET NULL;
