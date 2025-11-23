-- Create processed_stock table for packaging tracking
CREATE TABLE IF NOT EXISTS public.processed_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'reject'::text, 'damage'::text, 'lost'::text])),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT processed_stock_pkey PRIMARY KEY (id),
  CONSTRAINT processed_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT processed_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Add RLS policies for processed_stock
ALTER TABLE public.processed_stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Logistic users can view processed stock" ON public.processed_stock;
DROP POLICY IF EXISTS "Logistic users can insert processed stock" ON public.processed_stock;
DROP POLICY IF EXISTS "Logistic users can update processed stock" ON public.processed_stock;
DROP POLICY IF EXISTS "Logistic users can delete processed stock" ON public.processed_stock;

-- Logistic users can view all processed stock entries
CREATE POLICY "Logistic users can view processed stock"
  ON public.processed_stock FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  );

-- Logistic users can insert processed stock entries
CREATE POLICY "Logistic users can insert processed stock"
  ON public.processed_stock FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'logistic'
    )
  );

-- Logistic users can update processed stock entries
CREATE POLICY "Logistic users can update processed stock"
  ON public.processed_stock FOR UPDATE TO authenticated
  USING (
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

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS processed_stock_product_id_idx ON public.processed_stock(product_id);
CREATE INDEX IF NOT EXISTS processed_stock_user_id_idx ON public.processed_stock(user_id);
CREATE INDEX IF NOT EXISTS processed_stock_date_idx ON public.processed_stock(date DESC);
CREATE INDEX IF NOT EXISTS processed_stock_status_idx ON public.processed_stock(status);

-- Note: The logistic user (OJLG/OJLG) must be created manually through Supabase Auth
-- due to auth.users table restrictions in migrations.
--
-- To create the user:
-- 1. Go to Supabase Dashboard -> Authentication -> Users
-- 2. Click "Add user" -> "Create new user"
-- 3. Email: ojlg@logistic.com
-- 4. Password: OJLG
-- 5. After user is created, run this SQL in the SQL Editor:
--
-- INSERT INTO public.profiles (id, email, full_name, idstaff, is_active)
-- SELECT id, email, 'OJLG - Logistic', 'OJLG', true
-- FROM auth.users WHERE email = 'ojlg@logistic.com'
-- ON CONFLICT (id) DO NOTHING;
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'logistic'::app_role
-- FROM auth.users WHERE email = 'ojlg@logistic.com'
-- ON CONFLICT DO NOTHING;
