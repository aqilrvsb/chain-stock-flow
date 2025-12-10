-- ============================================================================
-- OLIVE JARDIN HUB - DATABASE SCHEMA
-- ============================================================================
-- WARNING: This schema is for context/reference only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Last Updated: 2025-12-10
-- ============================================================================

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Products: Main product catalog
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text UNIQUE,
  base_cost numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  image_url text,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- Profiles: User profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  idstaff text UNIQUE,
  phone_number text,
  whatsapp_number text,
  delivery_address text,
  state text,
  payment_method text DEFAULT 'fpx_only'::text CHECK (payment_method = ANY (ARRAY['fpx_only'::text, 'fpx_manual'::text])),
  sub_role text CHECK (sub_role IS NULL OR (sub_role = ANY (ARRAY['dealer_1'::text, 'dealer_2'::text, 'platinum'::text, 'gold'::text]))),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- User Roles: Role assignments for users
-- Roles: hq, master_agent, agent, logistic
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

-- Inventory: Current stock levels per user per product
CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Stock In HQ: Records of stock additions to HQ
-- Note: Database trigger auto-updates inventory table
CREATE TABLE public.stock_in_hq (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_in_hq_pkey PRIMARY KEY (id),
  CONSTRAINT stock_in_hq_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_in_hq_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Stock Out HQ: Records of stock removals from HQ (transfers to Master Agents)
CREATE TABLE public.stock_out_hq (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_out_hq_pkey PRIMARY KEY (id),
  CONSTRAINT stock_out_hq_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_out_hq_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Raw Material Stock: Raw material inventory tracking
CREATE TABLE public.raw_material_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT raw_material_stock_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT raw_material_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Processed Stock: Processed/finished goods tracking
CREATE TABLE public.processed_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'reject'::text, 'damage'::text, 'lost'::text])),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT processed_stock_pkey PRIMARY KEY (id),
  CONSTRAINT processed_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT processed_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- PRICING & BUNDLES
-- ============================================================================

-- Bundles: Product bundles with tiered pricing
CREATE TABLE public.bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  product_id uuid NOT NULL,
  units integer NOT NULL DEFAULT 1,
  master_agent_price numeric NOT NULL,
  agent_price numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  dealer_1_price numeric NOT NULL DEFAULT 0,
  dealer_2_price numeric NOT NULL DEFAULT 0,
  platinum_price numeric NOT NULL DEFAULT 0,
  gold_price numeric NOT NULL DEFAULT 0,
  CONSTRAINT bundles_pkey PRIMARY KEY (id),
  CONSTRAINT bundles_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Pricing Config: Role-based pricing configuration
CREATE TABLE public.pricing_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pricing_config_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_config_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- ============================================================================
-- AGENT RELATIONSHIPS
-- ============================================================================

-- Master Agent Relationships: Links agents to their master agents
CREATE TABLE public.master_agent_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  master_agent_id uuid NOT NULL,
  agent_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT master_agent_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT master_agent_relationships_master_agent_id_fkey FOREIGN KEY (master_agent_id) REFERENCES public.profiles(id),
  CONSTRAINT master_agent_relationships_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- ORDERS & TRANSACTIONS
-- ============================================================================

-- Pending Orders: Master Agent orders from HQ (FPX/Manual payment)
CREATE TABLE public.pending_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  buyer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  transaction_id text,
  billplz_bill_id text,
  bundle_id uuid,
  remarks text,
  payment_type text CHECK (payment_type = ANY (ARRAY['Online Transfer'::text, 'Cheque'::text, 'CDM'::text, 'Cash'::text])),
  payment_date date,
  bank_name text,
  receipt_image_url text,
  payment_method text DEFAULT 'fpx'::text CHECK (payment_method = ANY (ARRAY['fpx'::text, 'manual'::text])),
  CONSTRAINT pending_orders_pkey PRIMARY KEY (id),
  CONSTRAINT pending_orders_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id),
  CONSTRAINT pending_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Agent Purchases: Agent orders from Master Agents
CREATE TABLE public.agent_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  master_agent_id uuid,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  bundle_id uuid,
  bank_holder_name text,
  bank_name text,
  receipt_date date,
  receipt_image_url text,
  remarks text,
  CONSTRAINT agent_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT agent_purchases_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id),
  CONSTRAINT agent_purchases_master_agent_id_fkey FOREIGN KEY (master_agent_id) REFERENCES public.profiles(id),
  CONSTRAINT agent_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT agent_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id)
);

-- Transactions: General transaction records
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  transaction_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

-- Customers: End customer records
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  state text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Customer Purchases: Sales to end customers
CREATE TABLE public.customer_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  bundle_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['Online Transfer'::text, 'COD'::text, 'Cash'::text])),
  remarks text DEFAULT 'Customer purchase'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT customer_purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_purchases_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT customer_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id),
  CONSTRAINT customer_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- ============================================================================
-- REWARDS & SETTINGS
-- ============================================================================

-- Rewards Config: Reward tiers configuration
CREATE TABLE public.rewards_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role USER-DEFINED NOT NULL,
  min_quantity integer NOT NULL,
  reward_description text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  month integer NOT NULL DEFAULT 1 CHECK (month >= 0 AND month <= 12),
  year integer NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer,
  role_subrole USER-DEFINED,
  CONSTRAINT rewards_config_pkey PRIMARY KEY (id)
);

-- System Settings: Application configuration
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- DATABASE TRIGGERS (Reference Only)
-- ============================================================================

-- Trigger: auto_sync_inventory_stock_in_hq
-- Description: Automatically recalculates HQ inventory when stock_in_hq records are modified
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.stock_in_hq
-- Function: public.auto_recalc_inventory_after_transaction()

-- Trigger: auto_sync_inventory_pending_orders
-- Description: Auto-sync inventory when pending_orders change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.pending_orders

-- Trigger: auto_sync_inventory_agent_purchases
-- Description: Auto-sync inventory when agent_purchases change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.agent_purchases

-- Trigger: auto_sync_inventory_customer_purchases
-- Description: Auto-sync inventory when customer_purchases change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.customer_purchases

-- ============================================================================
-- NOTES
-- ============================================================================

-- HQ Inventory Calculation:
-- Displayed Quantity = inventory.quantity (managed by database triggers)
-- Stock In HQ adds to inventory via trigger
-- Stock Out HQ / Pending Orders (completed) deducts from inventory via trigger

-- User Roles Hierarchy:
-- 1. HQ - Headquarters (manages all inventory, products, bundles)
-- 2. Master Agent - Buys from HQ, sells to Agents (sub_role: dealer_1, dealer_2)
-- 3. Agent - Buys from Master Agent, sells to Customers (sub_role: platinum, gold)
-- 4. Logistic - Manages raw materials and processed stock

-- Sub-roles and Pricing:
-- Master Agents: dealer_1 (Dealer 1 Price), dealer_2 (Dealer 2 Price)
-- Agents: platinum (Platinum Price), gold (Gold Price)
