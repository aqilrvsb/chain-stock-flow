-- ============================================================================
-- MIGRATION: Add Branch Role
-- Date: 2025-12-10
-- Description: Add new Branch role with logistic capabilities
-- ============================================================================

-- ============================================================================
-- 1. ADD 'branch' TO USER ROLE ENUM
-- ============================================================================

-- Add 'branch' to the user_role enum type
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch';

-- ============================================================================
-- 2. UPDATE stock_out_hq TABLE - Add recipient tracking
-- ============================================================================

-- Add recipient_id column (Master Agent or Branch receiving stock)
ALTER TABLE public.stock_out_hq
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id);

-- Add recipient_type column (to identify if recipient is master_agent or branch)
ALTER TABLE public.stock_out_hq
ADD COLUMN IF NOT EXISTS recipient_type text CHECK (recipient_type IS NULL OR recipient_type = ANY (ARRAY['master_agent'::text, 'branch'::text]));

-- ============================================================================
-- 3. CREATE BRANCH INVENTORY TABLES
-- ============================================================================

-- Stock In Branch: Records of stock received by Branch (from HQ stock out)
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

-- Stock Out Branch: Records of stock removals from Branch (transfers to Agents)
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

-- Branch Raw Material Stock: Raw material inventory for Branch's logistic function
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

-- Branch Processed Stock: Processed/finished goods tracking for Branch
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

-- ============================================================================
-- 4. CREATE BRANCH AGENT RELATIONSHIPS TABLE
-- ============================================================================

-- Branch Agent Relationships: Links agents to their branch
CREATE TABLE IF NOT EXISTS public.branch_agent_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_agent_relationships_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 5. UPDATE agent_purchases TABLE - Add branch_id
-- ============================================================================

-- Add branch_id column (NULL if purchasing from Master Agent)
ALTER TABLE public.agent_purchases
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.profiles(id);

-- Add constraint: Agent must purchase from either Master Agent OR Branch (not both, not neither)
-- Note: This is a soft constraint - uncomment if you want to enforce it
-- ALTER TABLE public.agent_purchases
-- ADD CONSTRAINT agent_purchases_seller_check CHECK (
--   (master_agent_id IS NOT NULL AND branch_id IS NULL) OR
--   (master_agent_id IS NULL AND branch_id IS NOT NULL)
-- );

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.stock_in_branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_raw_material_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_processed_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_agent_relationships ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES FOR stock_in_branch
-- ============================================================================

-- Branch can view their own stock in records
CREATE POLICY "Branch can view own stock_in_branch" ON public.stock_in_branch
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can insert their own stock in records
CREATE POLICY "Branch can insert own stock_in_branch" ON public.stock_in_branch
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can update their own stock in records
CREATE POLICY "Branch can update own stock_in_branch" ON public.stock_in_branch
  FOR UPDATE USING (branch_id = auth.uid());

-- Branch can delete their own stock in records
CREATE POLICY "Branch can delete own stock_in_branch" ON public.stock_in_branch
  FOR DELETE USING (branch_id = auth.uid());

-- HQ can view all stock_in_branch records
CREATE POLICY "HQ can view all stock_in_branch" ON public.stock_in_branch
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- HQ can insert stock_in_branch records (when transferring stock to branch)
CREATE POLICY "HQ can insert stock_in_branch" ON public.stock_in_branch
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 8. RLS POLICIES FOR stock_out_branch
-- ============================================================================

-- Branch can view their own stock out records
CREATE POLICY "Branch can view own stock_out_branch" ON public.stock_out_branch
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can insert their own stock out records
CREATE POLICY "Branch can insert own stock_out_branch" ON public.stock_out_branch
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can update their own stock out records
CREATE POLICY "Branch can update own stock_out_branch" ON public.stock_out_branch
  FOR UPDATE USING (branch_id = auth.uid());

-- Branch can delete their own stock out records
CREATE POLICY "Branch can delete own stock_out_branch" ON public.stock_out_branch
  FOR DELETE USING (branch_id = auth.uid());

-- HQ can view all stock_out_branch records
CREATE POLICY "HQ can view all stock_out_branch" ON public.stock_out_branch
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 9. RLS POLICIES FOR branch_raw_material_stock
-- ============================================================================

-- Branch can view their own raw material stock
CREATE POLICY "Branch can view own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can insert their own raw material stock
CREATE POLICY "Branch can insert own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can update their own raw material stock
CREATE POLICY "Branch can update own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR UPDATE USING (branch_id = auth.uid());

-- Branch can delete their own raw material stock
CREATE POLICY "Branch can delete own branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR DELETE USING (branch_id = auth.uid());

-- HQ can view all branch raw material stock
CREATE POLICY "HQ can view all branch_raw_material_stock" ON public.branch_raw_material_stock
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 10. RLS POLICIES FOR branch_processed_stock
-- ============================================================================

-- Branch can view their own processed stock
CREATE POLICY "Branch can view own branch_processed_stock" ON public.branch_processed_stock
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can insert their own processed stock
CREATE POLICY "Branch can insert own branch_processed_stock" ON public.branch_processed_stock
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can update their own processed stock
CREATE POLICY "Branch can update own branch_processed_stock" ON public.branch_processed_stock
  FOR UPDATE USING (branch_id = auth.uid());

-- Branch can delete their own processed stock
CREATE POLICY "Branch can delete own branch_processed_stock" ON public.branch_processed_stock
  FOR DELETE USING (branch_id = auth.uid());

-- HQ can view all branch processed stock
CREATE POLICY "HQ can view all branch_processed_stock" ON public.branch_processed_stock
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 11. RLS POLICIES FOR branch_agent_relationships
-- ============================================================================

-- Branch can view their own agent relationships
CREATE POLICY "Branch can view own branch_agent_relationships" ON public.branch_agent_relationships
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can insert their own agent relationships
CREATE POLICY "Branch can insert own branch_agent_relationships" ON public.branch_agent_relationships
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can delete their own agent relationships
CREATE POLICY "Branch can delete own branch_agent_relationships" ON public.branch_agent_relationships
  FOR DELETE USING (branch_id = auth.uid());

-- HQ can manage all branch agent relationships
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

-- Agents can view their relationship to branch
CREATE POLICY "Agent can view own branch_agent_relationships" ON public.branch_agent_relationships
  FOR SELECT USING (agent_id = auth.uid());

-- ============================================================================
-- 12. CREATE INDEXES FOR PERFORMANCE
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
-- 13. INVENTORY TRIGGER FOR BRANCH (Auto-sync inventory)
-- ============================================================================

-- Function to recalculate Branch inventory
CREATE OR REPLACE FUNCTION public.recalculate_branch_inventory(p_branch_id UUID, p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_in INTEGER;
  v_stock_out INTEGER;
  v_final_quantity INTEGER;
BEGIN
  -- Calculate total stock in for branch
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_in
  FROM public.stock_in_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- Calculate total stock out for branch
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock_out
  FROM public.stock_out_branch
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- Calculate final quantity
  v_final_quantity := v_stock_in - v_stock_out;
  IF v_final_quantity < 0 THEN
    v_final_quantity := 0;
  END IF;

  -- Update or insert inventory record
  INSERT INTO public.inventory (user_id, product_id, quantity, updated_at)
  VALUES (p_branch_id, p_product_id, v_final_quantity, now())
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET quantity = v_final_quantity, updated_at = now();
END;
$$;

-- Trigger function for stock_in_branch changes
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

-- Trigger function for stock_out_branch changes
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

-- Create triggers
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
-- After running this migration:
-- 1. HQ can create Branch users in the user management interface
-- 2. HQ can Stock Out directly to Branch (no purchase required)
-- 3. Branch has their own dashboard with:
--    - Stock In (received from HQ)
--    - Stock Out (transfer to Agents)
--    - Raw Material Stock (logistic)
--    - Processed Stock (logistic)
--    - Agent Management
--    - Customer Management
-- ============================================================================
