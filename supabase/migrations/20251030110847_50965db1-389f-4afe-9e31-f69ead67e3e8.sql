-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('hq', 'master_agent', 'agent');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create master_agent_relationships table
CREATE TABLE public.master_agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

ALTER TABLE public.master_agent_relationships ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  base_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create pricing_config table (dynamic pricing by role)
CREATE TABLE public.pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, role)
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create rewards_config table
CREATE TABLE public.rewards_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  min_quantity INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rewards_config ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Trigger function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User roles: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- HQ can view all roles
CREATE POLICY "HQ can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'hq'));

-- HQ can insert/update/delete roles
CREATE POLICY "HQ can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'hq'));

CREATE POLICY "HQ can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'hq'));

CREATE POLICY "HQ can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'hq'));

-- Master agents can view their agents' roles
CREATE POLICY "Master agents can view their agents roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND agent_id = user_roles.user_id
    )
  );

-- Master agents can insert roles for their agents
CREATE POLICY "Master agents can insert agent roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'master_agent') AND
    role = 'agent' AND
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND agent_id = user_id
    )
  );

-- Products: Everyone authenticated can view active products
CREATE POLICY "Authenticated users can view active products"
  ON public.products FOR SELECT
  USING (is_active = TRUE);

-- HQ can do everything with products
CREATE POLICY "HQ can manage products"
  ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'hq'));

-- Pricing config: Everyone can view pricing
CREATE POLICY "Authenticated users can view pricing"
  ON public.pricing_config FOR SELECT
  TO authenticated
  USING (TRUE);

-- HQ can manage pricing
CREATE POLICY "HQ can manage pricing"
  ON public.pricing_config FOR ALL
  USING (public.has_role(auth.uid(), 'hq'));

-- Inventory: Users can view their own inventory
CREATE POLICY "Users can view own inventory"
  ON public.inventory FOR SELECT
  USING (auth.uid() = user_id);

-- HQ can view all inventory
CREATE POLICY "HQ can view all inventory"
  ON public.inventory FOR SELECT
  USING (public.has_role(auth.uid(), 'hq'));

-- Master agents can view their agents' inventory
CREATE POLICY "Master agents can view their agents inventory"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND agent_id = inventory.user_id
    )
  );

-- Users can update own inventory
CREATE POLICY "Users can update own inventory"
  ON public.inventory FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert own inventory
CREATE POLICY "Users can insert own inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Transactions: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- HQ can view all transactions
CREATE POLICY "HQ can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'hq'));

-- Master agents can view transactions involving them or their agents
CREATE POLICY "Master agents can view relevant transactions"
  ON public.transactions FOR SELECT
  USING (
    auth.uid() = buyer_id OR 
    auth.uid() = seller_id OR
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND 
      (agent_id = transactions.buyer_id OR agent_id = transactions.seller_id)
    )
  );

-- Users can insert their own transactions
CREATE POLICY "Users can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Rewards config: Everyone can view active rewards
CREATE POLICY "Authenticated users can view rewards"
  ON public.rewards_config FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- HQ can manage rewards
CREATE POLICY "HQ can manage rewards"
  ON public.rewards_config FOR ALL
  USING (public.has_role(auth.uid(), 'hq'));

-- Master agent relationships: HQ can view all
CREATE POLICY "HQ can view all relationships"
  ON public.master_agent_relationships FOR SELECT
  USING (public.has_role(auth.uid(), 'hq'));

-- Master agents can view their relationships
CREATE POLICY "Master agents can view own relationships"
  ON public.master_agent_relationships FOR SELECT
  USING (auth.uid() = master_agent_id);

-- HQ and master agents can insert relationships
CREATE POLICY "HQ and master agents can create relationships"
  ON public.master_agent_relationships FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'hq') OR
    (public.has_role(auth.uid(), 'master_agent') AND auth.uid() = master_agent_id)
  );

-- HQ and master agents can delete their own relationships
CREATE POLICY "Can delete own relationships"
  ON public.master_agent_relationships FOR DELETE
  USING (
    public.has_role(auth.uid(), 'hq') OR
    (public.has_role(auth.uid(), 'master_agent') AND auth.uid() = master_agent_id)
  );