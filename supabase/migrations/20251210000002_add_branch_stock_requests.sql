-- ============================================================================
-- MIGRATION: Add Branch Stock Requests
-- Date: 2025-12-10
-- Description: Branch can request stock from HQ, HQ can approve/reject
-- ============================================================================

-- ============================================================================
-- 1. CREATE BRANCH STOCK REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.branch_stock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.profiles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  processed_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_stock_requests_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.branch_stock_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES FOR branch_stock_requests
-- ============================================================================

-- Branch can view their own requests
CREATE POLICY "Branch can view own branch_stock_requests" ON public.branch_stock_requests
  FOR SELECT USING (branch_id = auth.uid());

-- Branch can create requests
CREATE POLICY "Branch can insert own branch_stock_requests" ON public.branch_stock_requests
  FOR INSERT WITH CHECK (branch_id = auth.uid());

-- Branch can update their own pending requests (e.g., cancel)
CREATE POLICY "Branch can update own pending branch_stock_requests" ON public.branch_stock_requests
  FOR UPDATE USING (branch_id = auth.uid() AND status = 'pending');

-- Branch can delete their own pending requests
CREATE POLICY "Branch can delete own pending branch_stock_requests" ON public.branch_stock_requests
  FOR DELETE USING (branch_id = auth.uid() AND status = 'pending');

-- HQ can view all requests
CREATE POLICY "HQ can view all branch_stock_requests" ON public.branch_stock_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- HQ can update requests (approve/reject)
CREATE POLICY "HQ can update branch_stock_requests" ON public.branch_stock_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_branch_id ON public.branch_stock_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_product_id ON public.branch_stock_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_status ON public.branch_stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_requested_at ON public.branch_stock_requests(requested_at);

-- ============================================================================
-- DONE!
-- ============================================================================
