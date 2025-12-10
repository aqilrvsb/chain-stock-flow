-- ============================================================================
-- MIGRATION: Add Branch Role (Clean version - drops existing policies first)
-- Date: 2025-12-10
-- ============================================================================

-- ============================================================================
-- 0. ADD 'branch' TO app_role ENUM
-- ============================================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'branch';

-- ============================================================================
-- 1. DROP EXISTING POLICIES (if they exist)
-- ============================================================================

DROP POLICY IF EXISTS "Branch can view own stock_in_branch" ON public.stock_in_branch;
DROP POLICY IF EXISTS "Branch can insert own stock_in_branch" ON public.stock_in_branch;
DROP POLICY IF EXISTS "Branch can update own stock_in_branch" ON public.stock_in_branch;
DROP POLICY IF EXISTS "Branch can delete own stock_in_branch" ON public.stock_in_branch;
DROP POLICY IF EXISTS "HQ can view all stock_in_branch" ON public.stock_in_branch;
DROP POLICY IF EXISTS "HQ can insert stock_in_branch" ON public.stock_in_branch;

DROP POLICY IF EXISTS "Branch can view own stock_out_branch" ON public.stock_out_branch;
DROP POLICY IF EXISTS "Branch can insert own stock_out_branch" ON public.stock_out_branch;
DROP POLICY IF EXISTS "Branch can update own stock_out_branch" ON public.stock_out_branch;
DROP POLICY IF EXISTS "Branch can delete own stock_out_branch" ON public.stock_out_branch;
DROP POLICY IF EXISTS "HQ can view all stock_out_branch" ON public.stock_out_branch;

DROP POLICY IF EXISTS "Branch can view own branch_raw_material_stock" ON public.branch_raw_material_stock;
DROP POLICY IF EXISTS "Branch can insert own branch_raw_material_stock" ON public.branch_raw_material_stock;
DROP POLICY IF EXISTS "Branch can update own branch_raw_material_stock" ON public.branch_raw_material_stock;
DROP POLICY IF EXISTS "Branch can delete own branch_raw_material_stock" ON public.branch_raw_material_stock;
DROP POLICY IF EXISTS "HQ can view all branch_raw_material_stock" ON public.branch_raw_material_stock;

DROP POLICY IF EXISTS "Branch can view own branch_processed_stock" ON public.branch_processed_stock;
DROP POLICY IF EXISTS "Branch can insert own branch_processed_stock" ON public.branch_processed_stock;
DROP POLICY IF EXISTS "Branch can update own branch_processed_stock" ON public.branch_processed_stock;
DROP POLICY IF EXISTS "Branch can delete own branch_processed_stock" ON public.branch_processed_stock;
DROP POLICY IF EXISTS "HQ can view all branch_processed_stock" ON public.branch_processed_stock;

DROP POLICY IF EXISTS "Branch can view own branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "Branch can insert own branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "Branch can delete own branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "HQ can view all branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "HQ can insert branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "HQ can delete branch_agent_relationships" ON public.branch_agent_relationships;
DROP POLICY IF EXISTS "Agent can view own branch_agent_relationships" ON public.branch_agent_relationships;

-- ============================================================================
-- 2. UPDATE stock_out_hq TABLE - Add recipient tracking
-- ============================================================================

ALTER TABLE public.stock_out_hq
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.stock_out_hq
ADD COLUMN IF NOT EXISTS recipient_type text CHECK (recipient_type IS NULL OR recipient_type = ANY (ARRAY['master_agent'::text, 'branch'::text]));

-- ============================================================================
-- 3. CREATE BRANCH INVENTORY TABLES (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_in_branch (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  source_type text NOT NULL DEFAULT 'hq'::text CHECK (source_type = ANY (ARRAY['hq'::text, 'transfer'::text])),
  hq_stock_out_id uuid REFERENCES public.stock_out_hq(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_in_branch_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.stock_out_branch (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  recipient_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_out_branch_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.branch_raw_material_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_raw_material_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.branch_processed_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'reject'::text, 'damage'::text, 'lost'::text])),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_processed_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.branch_agent_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_agent_relationships_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 4. UPDATE agent_purchases TABLE - Add branch_id
-- ============================================================================

ALTER TABLE public.agent_purchases
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.profiles(id);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.stock_in_branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_raw_material_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_processed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_agent_relationships ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES FOR stock_in_branch
-- ============================================================================

CREATE POLICY "Branch can view own stock_in_branch" ON public.stock_in_branch
  FOR SELECT USING (branch_id = auth.uid());

CREATE POLICY "Branch can insert own stock_in_branch" ON public.stock_in_branch
  FOR INSERT WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can update own stock_in_branch" ON public.stock_in_branch
  FOR UPDATE USING (branch_id = auth.uid());

CREATE POLICY "Branch can delete own stock_in_branch" ON public.stock_in_branch
  FOR DELETE USING (branch_id = auth.uid());

CREATE POLICY "HQ can view all stock_in_branch" ON public.stock_in_branch
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

CREATE POLICY "HQ can insert stock_in_branch" ON public.stock_in_branch
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 7. RLS POLICIES FOR stock_out_branch
-- ============================================================================

CREATE POLICY "Branch can view own stock_out_branch" ON public.stock_out_branch
  FOR SELECT USING (branch_id = auth.uid());

CREATE POLICY "Branch can insert own stock_out_branch" ON public.stock_out_branch
  FOR INSERT WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can update own stock_out_branch" ON public.stock_out_branch
  FOR UPDATE USING (branch_id = auth.uid());

CREATE POLICY "Branch can delete own stock_out_branch" ON public.stock_out_branch
  FOR DELETE USING (branch_id = auth.uid());

CREATE POLICY "HQ can view all stock_out_branch" ON public.stock_out_branch
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 8. RLS POLICIES FOR branch_raw_material_stock
-- ============================================================================

CREATE POLICY "Branch can view own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR SELECT USING (branch_id = auth.uid());

CREATE POLICY "Branch can insert own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR INSERT WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can update own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR UPDATE USING (branch_id = auth.uid());

CREATE POLICY "Branch can delete own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR DELETE USING (branch_id = auth.uid());

CREATE POLICY "HQ can view all branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 9. RLS POLICIES FOR branch_processed_stock
-- ============================================================================

CREATE POLICY "Branch can view own branch_processed_stock" ON public.branch_processed_stock
  FOR SELECT USING (branch_id = auth.uid());

CREATE POLICY "Branch can insert own branch_processed_stock" ON public.branch_processed_stock
  FOR INSERT WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can update own branch_processed_stock" ON public.branch_processed_stock
  FOR UPDATE USING (branch_id = auth.uid());

CREATE POLICY "Branch can delete own branch_processed_stock" ON public.branch_processed_stock
  FOR DELETE USING (branch_id = auth.uid());

CREATE POLICY "HQ can view all branch_processed_stock" ON public.branch_processed_stock
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 10. RLS POLICIES FOR branch_agent_relationships
-- ============================================================================

CREATE POLICY "Branch can view own branch_agent_relationships" ON public.branch_agent_relationships
  FOR SELECT USING (branch_id = auth.uid());

CREATE POLICY "Branch can insert own branch_agent_relationships" ON public.branch_agent_relationships
  FOR INSERT WITH CHECK (branch_id = auth.uid());

CREATE POLICY "Branch can delete own branch_agent_relationships" ON public.branch_agent_relationships
  FOR DELETE USING (branch_id = auth.uid());

CREATE POLICY "HQ can view all branch_agent_relationships" ON public.branch_agent_relationships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

CREATE POLICY "HQ can insert branch_agent_relationships" ON public.branch_agent_relationships
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

CREATE POLICY "HQ can delete branch_agent_relationships" ON public.branch_agent_relationships
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

CREATE POLICY "Agent can view own branch_agent_relationships" ON public.branch_agent_relationships
  FOR SELECT USING (agent_id = auth.uid());

-- ============================================================================
-- 11. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_in_branch_branch_id ON public.stock_in_branch(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_branch_product_id ON public.stock_in_branch(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_branch_date ON public.stock_in_branch(date);

CREATE INDEX IF NOT EXISTS idx_stock_out_branch_branch_id ON public.stock_out_branch(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_branch_product_id ON public.stock_out_branch(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_branch_recipient_id ON public.stock_out_branch(recipient_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_branch_date ON public.stock_out_branch(date);

CREATE INDEX IF NOT EXISTS idx_branch_raw_material_stock_branch_id ON public.branch_raw_material_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_raw_material_stock_product_id ON public.branch_raw_material_stock(product_id);

CREATE INDEX IF NOT EXISTS idx_branch_processed_stock_branch_id ON public.branch_processed_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_processed_stock_product_id ON public.branch_processed_stock(product_id);

CREATE INDEX IF NOT EXISTS idx_branch_agent_relationships_branch_id ON public.branch_agent_relationships(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_agent_relationships_agent_id ON public.branch_agent_relationships(agent_id);

CREATE INDEX IF NOT EXISTS idx_stock_out_hq_recipient_id ON public.stock_out_hq(recipient_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_hq_recipient_type ON public.stock_out_hq(recipient_type);

CREATE INDEX IF NOT EXISTS idx_agent_purchases_branch_id ON public.agent_purchases(branch_id);

-- ============================================================================
-- 12. INVENTORY TRIGGER FOR BRANCH (Auto-sync inventory)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_branch_inventory(p_branch_id UUID, p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_in INTEGER;
  v_stock_out INTEGER;
  v_final_quantity INTEGER;
  v_existing_id UUID;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
  FROM public.stock_in_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out
  FROM public.stock_out_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  v_final_quantity := v_stock_in - v_stock_out;
  IF v_final_quantity < 0 THEN
    v_final_quantity := 0;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.inventory
  WHERE user_id = p_branch_id AND product_id = p_product_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.inventory
    SET quantity = v_final_quantity, updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.inventory (user_id, product_id, quantity, updated_at)
    VALUES (p_branch_id, p_product_id, v_final_quantity, now());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_stock_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_branch_inventory(OLD.branch_id, OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_branch_inventory(NEW.branch_id, NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_sync_branch_inventory_stock_out()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_branch_inventory(OLD.branch_id, OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_branch_inventory(NEW.branch_id, NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS auto_sync_inventory_stock_in_branch ON public.stock_in_branch;
CREATE TRIGGER auto_sync_inventory_stock_in_branch
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_in_branch
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_stock_in();

DROP TRIGGER IF EXISTS auto_sync_inventory_stock_out_branch ON public.stock_out_branch;
CREATE TRIGGER auto_sync_inventory_stock_out_branch
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_out_branch
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_branch_inventory_stock_out();

-- ============================================================================
-- DONE!
-- ============================================================================
