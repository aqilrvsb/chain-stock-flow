-- ============================================================
-- COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- Chain Stock Flow - Hierarchical Supply Chain Management
-- ============================================================
--
-- This script combines all migrations in chronological order
-- Copy and paste this entire script into Supabase SQL Editor
--
-- IMPORTANT: Safe to run multiple times - checks for existing objects
--
-- ============================================================

-- ============================================================
-- MIGRATION 1: Initial Schema Setup
-- Date: 2025-10-30 11:08:47
-- ============================================================

-- Create app role enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('hq', 'master_agent', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (separate for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create master_agent_relationships table
CREATE TABLE IF NOT EXISTS public.master_agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

ALTER TABLE public.master_agent_relationships ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
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
CREATE TABLE IF NOT EXISTS public.pricing_config (
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
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
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
CREATE TABLE IF NOT EXISTS public.rewards_config (
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

-- Trigger to create profile on auth.users insert (skip if exists)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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

-- Add updated_at triggers (skip if exist)
DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_pricing_config_updated_at
    BEFORE UPDATE ON public.pricing_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies (CREATE POLICY will skip if already exists in newer Postgres versions)

-- Profiles: Users can view their own profile
DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- User roles: Users can view their own roles
DO $$ BEGIN
  CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can view all roles
DO $$ BEGIN
  CREATE POLICY "HQ can view all roles"
    ON public.user_roles FOR SELECT
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can insert/update/delete roles
DO $$ BEGIN
  CREATE POLICY "HQ can insert roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "HQ can update roles"
    ON public.user_roles FOR UPDATE
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "HQ can delete roles"
    ON public.user_roles FOR DELETE
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agents can view their agents' roles
DO $$ BEGIN
  CREATE POLICY "Master agents can view their agents roles"
    ON public.user_roles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.master_agent_relationships
        WHERE master_agent_id = auth.uid() AND agent_id = user_roles.user_id
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agents can insert roles for their agents
DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Products: Everyone authenticated can view active products
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view active products"
    ON public.products FOR SELECT
    USING (is_active = TRUE);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can do everything with products
DO $$ BEGIN
  CREATE POLICY "HQ can manage products"
    ON public.products FOR ALL
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Pricing config: Everyone can view pricing
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view pricing"
    ON public.pricing_config FOR SELECT
    TO authenticated
    USING (TRUE);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can manage pricing
DO $$ BEGIN
  CREATE POLICY "HQ can manage pricing"
    ON public.pricing_config FOR ALL
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Inventory: Users can view their own inventory
DO $$ BEGIN
  CREATE POLICY "Users can view own inventory"
    ON public.inventory FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can view all inventory
DO $$ BEGIN
  CREATE POLICY "HQ can view all inventory"
    ON public.inventory FOR SELECT
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agents can view their agents' inventory
DO $$ BEGIN
  CREATE POLICY "Master agents can view their agents inventory"
    ON public.inventory FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.master_agent_relationships
        WHERE master_agent_id = auth.uid() AND agent_id = inventory.user_id
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users can update own inventory
DO $$ BEGIN
  CREATE POLICY "Users can update own inventory"
    ON public.inventory FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users can insert own inventory
DO $$ BEGIN
  CREATE POLICY "Users can insert own inventory"
    ON public.inventory FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Transactions: Users can view their own transactions
DO $$ BEGIN
  CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can view all transactions
DO $$ BEGIN
  CREATE POLICY "HQ can view all transactions"
    ON public.transactions FOR SELECT
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agents can view transactions involving them or their agents
DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users can insert their own transactions
DO $$ BEGIN
  CREATE POLICY "Users can insert transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Rewards config: Everyone can view active rewards
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view rewards"
    ON public.rewards_config FOR SELECT
    TO authenticated
    USING (is_active = TRUE);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can manage rewards
DO $$ BEGIN
  CREATE POLICY "HQ can manage rewards"
    ON public.rewards_config FOR ALL
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agent relationships: HQ can view all
DO $$ BEGIN
  CREATE POLICY "HQ can view all relationships"
    ON public.master_agent_relationships FOR SELECT
    USING (public.has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Master agents can view their relationships
DO $$ BEGIN
  CREATE POLICY "Master agents can view own relationships"
    ON public.master_agent_relationships FOR SELECT
    USING (auth.uid() = master_agent_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ and master agents can insert relationships
DO $$ BEGIN
  CREATE POLICY "HQ and master agents can create relationships"
    ON public.master_agent_relationships FOR INSERT
    WITH CHECK (
      public.has_role(auth.uid(), 'hq') OR
      (public.has_role(auth.uid(), 'master_agent') AND auth.uid() = master_agent_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ and master agents can delete their own relationships
DO $$ BEGIN
  CREATE POLICY "Can delete own relationships"
    ON public.master_agent_relationships FOR DELETE
    USING (
      public.has_role(auth.uid(), 'hq') OR
      (public.has_role(auth.uid(), 'master_agent') AND auth.uid() = master_agent_id)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 1B: Agent Purchases Table
-- Date: 2025-11-04
-- ============================================================

-- Create agent_purchases table for tracking agent purchase orders
CREATE TABLE IF NOT EXISTS public.agent_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  master_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_purchases ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_agent_purchases_updated_at
  BEFORE UPDATE ON public.agent_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for agent_purchases
DO $$ BEGIN
  CREATE POLICY "Agents can view own purchases"
  ON public.agent_purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "HQ can view all agent purchases"
  ON public.agent_purchases
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Master agents can view their agents purchases"
  ON public.agent_purchases
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = master_agent_id) OR
    EXISTS (
      SELECT 1 FROM master_agent_relationships
      WHERE master_agent_relationships.master_agent_id = auth.uid()
      AND master_agent_relationships.agent_id = agent_purchases.agent_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Agents can insert own purchases"
  ON public.agent_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Master agents can update their agents purchases"
  ON public.agent_purchases
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = master_agent_id) OR
    EXISTS (
      SELECT 1 FROM master_agent_relationships
      WHERE master_agent_relationships.master_agent_id = auth.uid()
      AND master_agent_relationships.agent_id = agent_purchases.agent_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 1C: System Settings Table
-- Date: 2025-11-04
-- ============================================================

-- Create system_settings table for application configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for system_settings
DO $$ BEGIN
  CREATE POLICY "Anyone can read system settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "HQ can update system settings"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 2: Storage Bucket Setup
-- Date: 2025-10-30 11:36:53
-- ============================================================

-- Create storage bucket for product images (skip if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage policies need to be created via Supabase Dashboard
-- Go to Storage > product-images > Policies and create:
-- 1. "HQ can upload product images" - INSERT for authenticated users with has_role check
-- 2. "Anyone can view product images" - SELECT for public with bucket_id check

-- ============================================================
-- MIGRATION 3: Add Image URL Column to Products
-- Date: 2025-10-30 11:38:59
-- ============================================================

-- Add image_url column to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- ============================================================
-- MIGRATION 4: Product Bundles Table
-- Date: 2025-11-02 06:31:55
-- ============================================================

-- Create bundles table for HQ to manage product bundles with pricing
CREATE TABLE IF NOT EXISTS public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units INTEGER NOT NULL DEFAULT 1,
  master_agent_price NUMERIC NOT NULL,
  agent_price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;

-- HQ can manage bundles
DO $$ BEGIN
  CREATE POLICY "HQ can manage bundles"
  ON public.bundles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Authenticated users can view active bundles
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view active bundles"
  ON public.bundles
  FOR SELECT
  TO authenticated
  USING (is_active = true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON public.bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 5: Add is_active to Profiles
-- Date: 2025-11-02 06:59:06
-- ============================================================

-- Add is_active column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- ============================================================
-- MIGRATION 6: Enhanced Profile RLS Policies
-- Date: 2025-11-02 07:08:29
-- ============================================================

-- Allow HQ to view all profiles
DO $$ BEGIN
  CREATE POLICY "HQ can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow HQ to update all profiles (for managing active/inactive status)
DO $$ BEGIN
  CREATE POLICY "HQ can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow master agents to view their agents' profiles
DO $$ BEGIN
  CREATE POLICY "Master agents can view their agents profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM master_agent_relationships
      WHERE master_agent_relationships.master_agent_id = auth.uid()
      AND master_agent_relationships.agent_id = profiles.id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 7: Stock In HQ Table
-- Date: 2025-11-02 07:36:54
-- ============================================================

-- Create stock_in_hq table for tracking HQ stock additions
CREATE TABLE IF NOT EXISTS public.stock_in_hq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_in_hq ENABLE ROW LEVEL SECURITY;

-- HQ can view all stock in records
DO $$ BEGIN
  CREATE POLICY "HQ can view all stock in records"
  ON public.stock_in_hq
  FOR SELECT
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can insert stock in records
DO $$ BEGIN
  CREATE POLICY "HQ can insert stock in records"
  ON public.stock_in_hq
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'hq'::app_role) AND auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_in_hq_date ON public.stock_in_hq(date);
CREATE INDEX IF NOT EXISTS idx_stock_in_hq_product ON public.stock_in_hq(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_hq_user ON public.stock_in_hq(user_id);

-- ============================================================
-- MIGRATION 8: Add Month and Year to Rewards Config
-- Date: 2025-11-02 07:59:32
-- ============================================================

-- Add month and year columns to rewards_config table
ALTER TABLE public.rewards_config
ADD COLUMN IF NOT EXISTS month integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

-- Add check constraints (skip if exists)
DO $$ BEGIN
  ALTER TABLE public.rewards_config
  ADD CONSTRAINT rewards_config_month_check CHECK (month >= 1 AND month <= 12);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create index for filtering by year
CREATE INDEX IF NOT EXISTS idx_rewards_config_year ON public.rewards_config(year);

-- Update the table comment
COMMENT ON COLUMN public.rewards_config.month IS 'Month of the reward (1-12)';
COMMENT ON COLUMN public.rewards_config.year IS 'Year of the reward';

-- ============================================================
-- MIGRATION 9: Add Staff ID to Profiles
-- Date: 2025-11-02 08:25:35
-- ============================================================

-- Add idstaff column to profiles table with unique constraint
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS idstaff text;

-- Add unique constraint if doesn't exist
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_idstaff_key UNIQUE (idstaff);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.idstaff IS 'Unique staff ID used for login and identification';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_idstaff ON public.profiles(idstaff);

-- ============================================================
-- MIGRATION 10: Add Contact and Delivery Fields to Profiles
-- Date: 2025-11-02 13:20:24
-- ============================================================

-- Add new fields to profiles table for contact and delivery information
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- ============================================================
-- MIGRATION 11: Pending Orders Table
-- Date: 2025-11-02 13:53:08
-- ============================================================

-- Create pending_orders table to track payment processing
CREATE TABLE IF NOT EXISTS public.pending_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending orders
DO $$ BEGIN
  CREATE POLICY "Users can view own pending orders"
  ON public.pending_orders
  FOR SELECT
  USING (auth.uid() = buyer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- HQ can view all pending orders
DO $$ BEGIN
  CREATE POLICY "HQ can view all pending orders"
  ON public.pending_orders
  FOR SELECT
  USING (has_role(auth.uid(), 'hq'::app_role));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_number ON public.pending_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON public.pending_orders(status);

-- Add trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_pending_orders_updated_at
  BEFORE UPDATE ON public.pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- MIGRATION 12: Enhanced Function Input Validation
-- Date: 2025-11-02 14:20:29
-- ============================================================

-- Add input validation to has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Input validation
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF _role IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Add input validation to get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Input validation
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  RETURN user_role;
END;
$$;

-- Add validation to handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Input validation
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  IF NEW.email IS NULL OR NEW.email = '' THEN
    RAISE EXCEPTION 'User email cannot be null or empty';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Add search_path to update_updated_at function for consistency
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- MIGRATION 13: Additional Pending Orders RLS Policies
-- Date: 2025-11-02 14:24:24
-- ============================================================

-- Add RLS policies to pending_orders table for defense-in-depth

-- Allow authenticated users to insert their own pending orders
DO $$ BEGIN
  CREATE POLICY "Users can insert own pending orders"
  ON public.pending_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow HQ to update order status
DO $$ BEGIN
  CREATE POLICY "HQ can update order status"
  ON public.pending_orders
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'hq'))
  WITH CHECK (has_role(auth.uid(), 'hq'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- No DELETE policy - maintain audit trail (no one can delete pending orders)

-- ============================================================
-- MIGRATION 14: Add Transaction ID to Pending Orders
-- Date: 2025-11-02 15:11:53
-- ============================================================

-- Add transaction_id column to pending_orders to store BayarCash payment intent ID
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_orders_transaction_id
ON public.pending_orders(transaction_id);

-- ============================================================
-- SETUP COMPLETE!
-- ============================================================
--
-- Your database is now fully configured with:
-- ✓ 13 Tables (profiles, user_roles, products, pricing_config,
--   inventory, transactions, rewards_config, bundles,
--   master_agent_relationships, stock_in_hq, pending_orders,
--   agent_purchases, system_settings)
-- ✓ 1 Storage Bucket (product-images)
-- ✓ 4 Helper Functions (has_role, get_user_role, handle_new_user,
--   update_updated_at)
-- ✓ All RLS Policies for secure access control
-- ✓ All Indexes for optimized queries
-- ✓ All Triggers for automation
--
-- This script is SAFE TO RUN MULTIPLE TIMES
-- All objects check for existence before creation
--
-- IMPORTANT: Storage Policies
-- The storage policies for product-images bucket need to be created manually
-- in the Supabase Dashboard:
-- 1. Go to Storage > product-images > Policies
-- 2. Create policy "HQ can upload product images":
--    - Operation: INSERT
--    - Target roles: authenticated
--    - Policy definition: bucket_id = 'product-images' AND (has_role(auth.uid(), 'hq'::app_role))
-- 3. Create policy "Anyone can view product images":
--    - Operation: SELECT
--    - Target roles: public
--    - Policy definition: bucket_id = 'product-images'
--
-- Next Steps:
-- 1. Create storage policies manually (see above)
-- 2. Deploy Edge Functions using the Supabase CLI
-- 3. Create your first HQ user
-- 4. Configure payment gateway credentials
--
-- ============================================================
