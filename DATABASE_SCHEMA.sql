-- ============================================================================
-- OLIVE JARDIN HUB - DATABASE SCHEMA
-- ============================================================================
-- WARNING: This schema is for context/reference only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Last Updated: 2025-12-15
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
  storehub_username text,
  storehub_password text,
  branch_id uuid,
  password_hash text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id)
);

-- User Roles: Role assignments for users
-- Roles: hq, master_agent, agent, logistic, branch, marketer
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,  -- ENUM: 'hq', 'master_agent', 'agent', 'logistic', 'branch', 'marketer'
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

-- Stock Out HQ: Records of stock removals from HQ (transfers to Master Agents or Branches)
CREATE TABLE public.stock_out_hq (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  recipient_id uuid,  -- Master Agent or Branch receiving the stock
  recipient_type text CHECK (recipient_type IS NULL OR (recipient_type = ANY (ARRAY['master_agent'::text, 'branch'::text]))),
  CONSTRAINT stock_out_hq_pkey PRIMARY KEY (id),
  CONSTRAINT stock_out_hq_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_out_hq_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT stock_out_hq_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- BRANCH INVENTORY MANAGEMENT
-- ============================================================================

-- Stock In Branch: Records of stock received by Branch (from HQ stock out)
CREATE TABLE public.stock_in_branch (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,  -- The branch user receiving stock
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  source_type text NOT NULL DEFAULT 'hq'::text CHECK (source_type = ANY (ARRAY['hq'::text, 'transfer'::text])),
  hq_stock_out_id uuid,  -- Reference to stock_out_hq record if from HQ
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_in_branch_pkey PRIMARY KEY (id),
  CONSTRAINT stock_in_branch_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT stock_in_branch_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_in_branch_hq_stock_out_id_fkey FOREIGN KEY (hq_stock_out_id) REFERENCES public.stock_out_hq(id)
);

-- Stock Out Branch: Records of stock removals from Branch (transfers to Agents)
CREATE TABLE public.stock_out_branch (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,  -- The branch user sending stock
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  recipient_id uuid,  -- Agent receiving the stock
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_out_branch_pkey PRIMARY KEY (id),
  CONSTRAINT stock_out_branch_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT stock_out_branch_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stock_out_branch_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id)
);

-- Branch Stock Requests: Stock requests from Branch to HQ
CREATE TABLE public.branch_stock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  processed_by uuid,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_stock_requests_pkey PRIMARY KEY (id),
  CONSTRAINT branch_stock_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT branch_stock_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT branch_stock_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.profiles(id)
);

-- Branch Raw Material Stock: Raw material inventory for Branch's logistic function
CREATE TABLE public.branch_raw_material_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_raw_material_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_raw_material_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT branch_raw_material_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Branch Processed Stock: Processed/finished goods tracking for Branch
CREATE TABLE public.branch_processed_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'reject'::text, 'damage'::text, 'lost'::text])),
  description text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_processed_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_processed_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT branch_processed_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- ============================================================================
-- HQ LOGISTIC INVENTORY
-- ============================================================================

-- Raw Material Stock: Raw material inventory tracking (HQ Logistic)
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

-- Processed Stock: Processed/finished goods tracking (HQ Logistic)
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

-- PnL Config: Commission and bonus configuration for Marketers
CREATE TABLE public.pnl_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'marketer'::text,
  min_sales numeric NOT NULL DEFAULT 0,
  max_sales numeric,
  roas_min numeric NOT NULL DEFAULT 0,
  roas_max numeric NOT NULL DEFAULT 99,
  commission_percent numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pnl_config_pkey PRIMARY KEY (id),
  CONSTRAINT pnl_config_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id)
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

-- Branch Agent Relationships: Links agents to their branch
CREATE TABLE public.branch_agent_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  agent_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_agent_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT branch_agent_relationships_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id),
  CONSTRAINT branch_agent_relationships_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- ORDERS & TRANSACTIONS
-- ============================================================================

-- Pending Orders: Master Agent orders from HQ (FPX/Manual payment)
-- Note: Branch does NOT use this table - they receive stock via stock_out_hq
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

-- Agent Purchases: Agent orders from Master Agents or Branch
CREATE TABLE public.agent_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  master_agent_id uuid,  -- NULL if purchasing from Branch
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
  branch_id uuid,  -- NULL if purchasing from Master Agent
  CONSTRAINT agent_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT agent_purchases_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id),
  CONSTRAINT agent_purchases_master_agent_id_fkey FOREIGN KEY (master_agent_id) REFERENCES public.profiles(id),
  CONSTRAINT agent_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT agent_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id),
  CONSTRAINT agent_purchases_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id)
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
-- CUSTOMERS & PROSPECTS
-- ============================================================================

-- Customers: End customer records (can be created by Master Agent, Agent, Branch, or Marketer)
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  state text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  postcode text,
  city text,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Prospects: Lead/prospect tracking for Marketers
CREATE TABLE public.prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama_prospek text NOT NULL,
  no_telefon text NOT NULL,
  niche text NOT NULL,
  jenis_prospek text NOT NULL,  -- NP (New Prospect), EP (Existing Prospect), EC (Existing Customer)
  tarikh_phone_number date,
  marketer_id_staff text,
  created_by uuid,
  status_closed text,
  price_closed numeric,
  count_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prospects_pkey PRIMARY KEY (id),
  CONSTRAINT prospects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Customer Purchases: Sales to end customers (by Master Agent, Agent, Branch, or Marketer)
CREATE TABLE public.customer_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  bundle_id uuid,
  product_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['Online Transfer'::text, 'COD'::text, 'Cash'::text])),
  remarks text DEFAULT 'Customer purchase'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Closing & Platform tracking
  closing_type text CHECK (closing_type IS NULL OR (closing_type = ANY (ARRAY['Website'::text, 'WhatsappBot'::text, 'Call'::text, 'Manual'::text, 'Live'::text, 'Shop'::text, 'Walk In'::text]))),
  platform text DEFAULT 'Manual'::text,
  -- Shipping & Delivery
  tracking_number text,
  ninjavan_order_id text,
  delivery_status text DEFAULT 'Pending'::text,
  -- StoreHub Integration
  storehub_product text,
  storehub_invoice text,
  transaction_total numeric,
  -- Dates
  date_order date DEFAULT CURRENT_DATE,
  date_processed date,
  date_return date,
  tarikh_bayaran date,
  -- Marketer fields
  marketer_id uuid,
  marketer_id_staff text,
  marketer_name text,
  jenis_platform text,
  jenis_customer text,  -- NP, EP, EC
  jenis_closing text,
  -- Pricing & Profit
  harga_jualan_produk numeric,
  kos_pos numeric DEFAULT 0,
  kos_produk numeric DEFAULT 0,
  profit numeric DEFAULT 0,
  -- Payment details
  jenis_bayaran text,
  bank text,
  receipt_image_url text,
  waybill_url text,
  -- Other
  seo text,
  order_from text,
  attachment_url text,
  alamat text,  -- Full delivery address (used by marketer orders)
  bandar text,  -- City/district for delivery (used by marketer orders)
  poskod text,  -- Postcode for delivery (used by marketer orders)
  negeri text,  -- State for delivery (used by marketer orders)
  no_phone text,  -- Customer phone number (used by marketer orders)
  produk text,  -- Product name (used by marketer orders)
  sku text,  -- Product SKU (used by marketer orders)
  kurier text,  -- Courier service name (used by marketer orders)
  no_tracking text,  -- Tracking number alias (used by marketer orders)
  cara_bayaran text,  -- Payment method type: CASH or COD (used by marketer orders)
  nota_staff text,  -- Staff notes (used by marketer orders)
  id_sale text,  -- Unique sale ID (e.g., OJ00001) for NinjaVan tracking
  woo_order_id integer,  -- WooCommerce order ID for orders created via webhook
  CONSTRAINT customer_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT customer_purchases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_purchases_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT customer_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.bundles(id),
  CONSTRAINT customer_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT customer_purchases_marketer_id_fkey FOREIGN KEY (marketer_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- MARKETER & SPEND TRACKING
-- ============================================================================

-- Spends: Ad spend tracking for Marketers
CREATE TABLE public.spends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product text NOT NULL,
  jenis_platform text NOT NULL,  -- Facebook, TikTok, Google, etc.
  jenis_closing text,  -- Website, WhatsappBot, Manual, Call, Live, Shop
  total_spend numeric NOT NULL DEFAULT 0,
  tarikh_spend date NOT NULL DEFAULT CURRENT_DATE,
  marketer_id_staff text,
  branch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT spends_pkey PRIMARY KEY (id),
  CONSTRAINT spends_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- NINJAVAN INTEGRATION
-- ============================================================================

-- NinjaVan Config: Seller configuration for NinjaVan shipping
CREATE TABLE public.ninjavan_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  sender_email text NOT NULL,
  sender_address1 text NOT NULL,
  sender_address2 text,
  sender_postcode text NOT NULL,
  sender_city text NOT NULL,
  sender_state text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ninjavan_config_pkey PRIMARY KEY (id),
  CONSTRAINT ninjavan_config_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

-- NinjaVan Tokens: OAuth tokens for NinjaVan API
CREATE TABLE public.ninjavan_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  access_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ninjavan_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT ninjavan_tokens_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

-- ============================================================================
-- WOOCOMMERCE INTEGRATION
-- ============================================================================

-- Webhook Logs: Track all webhook requests for debugging
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  webhook_type text NOT NULL,  -- 'woocommerce', 'ninjavan', etc.
  request_method text,
  request_body jsonb,
  request_headers jsonb,
  profile_id uuid,
  order_id uuid,
  response_status integer,
  response_body jsonb,
  error_message text,
  processing_time_ms integer,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT webhook_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_purchases(id)
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

-- Trigger: auto_sync_inventory_pending_orders
-- Description: Auto-sync inventory when pending_orders change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.pending_orders

-- Trigger: auto_sync_inventory_agent_purchases
-- Description: Auto-sync inventory when agent_purchases change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.agent_purchases

-- Trigger: auto_sync_inventory_customer_purchases
-- Description: Auto-sync inventory when customer_purchases change
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.customer_purchases

-- Trigger: auto_sync_inventory_stock_in_branch
-- Description: Auto-sync Branch inventory when stock_in_branch records are modified
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.stock_in_branch

-- Trigger: auto_sync_inventory_stock_out_branch
-- Description: Auto-sync Branch/Agent inventory when stock_out_branch records are modified
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON public.stock_out_branch

-- ============================================================================
-- USER ROLES HIERARCHY
-- ============================================================================

-- 1. HQ - Headquarters
--    - Manages all inventory, products, bundles
--    - Creates Master Agents and Branches
--    - Stock Out to Master Agents (via pending_orders/purchase)
--    - Stock Out to Branches (direct transfer, no purchase required)

-- 2. MASTER AGENT
--    - Buys from HQ (via pending_orders with payment)
--    - Sells to Agents under them
--    - Can manage Customers
--    - Sub-roles: dealer_1, dealer_2

-- 3. BRANCH
--    - Similar to Master Agent but with differences:
--    - Does NOT purchase from HQ (receives stock via stock_out_hq)
--    - Has own Logistic function (raw materials & processed stock)
--    - Can manage Agents under them
--    - Can manage Customers directly
--    - Can manage Marketers under them
--    - Sub-roles: dealer_1, dealer_2

-- 4. AGENT
--    - Buys from Master Agent OR Branch
--    - Sells to Customers
--    - Sub-roles: platinum, gold

-- 5. LOGISTIC (HQ only)
--    - Manages raw materials and processed stock for HQ

-- 6. MARKETER
--    - Works under Branch
--    - Handles sales via various platforms (Facebook, TikTok, Shopee, etc.)
--    - Tracks leads/prospects
--    - Records customer purchases with detailed tracking
--    - Manages ad spend and ROAS

-- ============================================================================
-- SUB-ROLES AND PRICING
-- ============================================================================

-- Master Agents & Branch:
--   - dealer_1: Uses Dealer 1 Price
--   - dealer_2: Uses Dealer 2 Price

-- Agents:
--   - platinum: Uses Platinum Price
--   - gold: Uses Gold Price

-- ============================================================================
-- MARKETER FIELDS REFERENCE
-- ============================================================================

-- Jenis Platform (Platform Types):
--   - Facebook, TikTok, Shopee, Google, Database, Manual

-- Jenis Customer (Customer Types):
--   - NP: New Prospect
--   - EP: Existing Prospect
--   - EC: Existing Customer

-- Jenis Closing (Closing Types):
--   - Manual, WhatsappBot, Website, Call, Live, Shop, Walk In

-- Payment Methods:
--   - Online Transfer, COD, Cash

-- ============================================================================
-- STOREHUB INTEGRATION
-- ============================================================================

-- profiles.storehub_username: StoreHub account username
-- profiles.storehub_password: StoreHub API token/password
-- customer_purchases.storehub_product: Product name from StoreHub
-- customer_purchases.storehub_invoice: Invoice number from StoreHub
-- customer_purchases.transaction_total: Transaction total from StoreHub

-- ============================================================================
-- NINJAVAN INTEGRATION
-- ============================================================================

-- ninjavan_config: Stores seller configuration for NinjaVan shipping
-- ninjavan_tokens: Stores OAuth access tokens for NinjaVan API calls
-- customer_purchases.ninjavan_order_id: Order tracking ID from NinjaVan
-- customer_purchases.delivery_status: Current delivery status
-- customer_purchases.tracking_number: Shipping tracking number

-- RLS Policy: Allow marketers to read their branch's NinjaVan config
-- Marketers need this to create orders via NinjaVan
-- Policy: "Marketers can view their branch ninjavan config" ON ninjavan_config
-- Condition: profile_id = profiles.branch_id OR profile_id = user_roles.created_by

-- RLS Policies for customer_purchases:
-- Policy: "Marketers can delete their own orders" ON customer_purchases FOR DELETE
-- Condition: marketer_id = auth.uid()
-- Policy: "Marketers can update their own orders" ON customer_purchases FOR UPDATE
-- Condition: marketer_id = auth.uid()
-- Policy: "Branch can delete orders under their branch" ON customer_purchases FOR DELETE
-- Condition: seller_id = auth.uid()
-- Policy: "Branch can update orders under their branch" ON customer_purchases FOR UPDATE
-- Condition: seller_id = auth.uid()

-- ============================================================================
-- WOOCOMMERCE INTEGRATION
-- ============================================================================

-- Webhook URL: https://[project-ref].supabase.co/functions/v1/woocommerce-webhook?marketer_id=[IDSTAFF]
-- Example: https://nzjolxsloobsoqltkpmi.supabase.co/functions/v1/woocommerce-webhook?marketer_id=BRKB-001

-- WooCommerce Webhook Settings:
--   - Topic: Action -> woocommerce_order_status_processing
--   - Delivery URL: [Webhook URL above]
--   - Secret: Use marketer's idstaff (e.g., BRKB-001)
--   - API Version: WP REST API Integration v3

-- The webhook:
--   1. Accepts marketer_id (idstaff) as URL query parameter
--   2. Verifies signature using idstaff as the secret
--   3. Only processes orders with status 'processing' (payment confirmed)
--   4. Creates NinjaVan shipping order (for both COD and CASH)
--   5. Inserts order into customer_purchases with:
--      - seller_id = branch_id (so Branch sees it in logistics)
--      - marketer_id = marketer's UUID
--      - woo_order_id = WooCommerce order ID
--      - id_sale = Generated sale ID (OJ00001, OJ00002, etc.)
--      - For CASH orders: payment is already done (tarikh_bayaran set)

-- webhook_logs table stores all webhook requests for debugging
-- RLS Policy: Users can view their own webhook logs
