-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  state text NOT NULL,
  created_by uuid NOT NULL, -- Master Agent or Agent who created this customer
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Create customer_purchases table
CREATE TABLE IF NOT EXISTS public.customer_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  seller_id uuid NOT NULL, -- Master Agent or Agent who sold to customer
  bundle_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['Online Transfer'::text, 'COD'::text, 'Cash'::text])),
  remarks text DEFAULT 'Customer purchase',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT customer_purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_purchases_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT customer_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id),
  CONSTRAINT customer_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS customers_created_by_idx ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS customer_purchases_customer_id_idx ON public.customer_purchases(customer_id);
CREATE INDEX IF NOT EXISTS customer_purchases_seller_id_idx ON public.customer_purchases(seller_id);
CREATE INDEX IF NOT EXISTS customer_purchases_created_at_idx ON public.customer_purchases(created_at);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
-- Master Agents can view their own customers
CREATE POLICY "Master agents can view own customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR
  -- Also allow agents to view customers they created
  created_by = auth.uid()
);

-- Master Agents and Agents can create customers
CREATE POLICY "Master agents and agents can create customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- Master Agents and Agents can update their own customers
CREATE POLICY "Master agents and agents can update own customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- HQ can view all customers
CREATE POLICY "HQ can view all customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hq'::app_role
  )
);

-- RLS Policies for customer_purchases table
-- Master Agents and Agents can view their own customer purchases
CREATE POLICY "Users can view own customer purchases"
ON public.customer_purchases
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid()
);

-- Master Agents and Agents can create customer purchases
CREATE POLICY "Users can create customer purchases"
ON public.customer_purchases
FOR INSERT
TO authenticated
WITH CHECK (
  seller_id = auth.uid()
);

-- HQ can view all customer purchases
CREATE POLICY "HQ can view all customer purchases"
ON public.customer_purchases
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hq'::app_role
  )
);

-- Grant permissions
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.customer_purchases TO authenticated;
