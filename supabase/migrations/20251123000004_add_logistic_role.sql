-- Add 'logistic' to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'logistic'
    AND enumtypid = 'app_role'::regtype
  ) THEN
    ALTER TYPE app_role ADD VALUE 'logistic';
  END IF;
END $$;

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

-- Create logistic user
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    gen_random_uuid(),
    'ojlg@logistic.com',
    crypt('OJLG', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    'authenticated'
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO new_user_id;

  -- Only proceed if user was created
  IF new_user_id IS NOT NULL THEN
    -- Insert into profiles
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      idstaff,
      is_active
    ) VALUES (
      new_user_id,
      'ojlg@logistic.com',
      'OJLG - Logistic',
      'OJLG',
      true
    );

    -- Insert into user_roles
    INSERT INTO public.user_roles (
      user_id,
      role
    ) VALUES (
      new_user_id,
      'logistic'
    );
  END IF;
END $$;
