-- =====================================================
-- Migration: Add Marketer Role System
-- =====================================================
-- This migration adds the Marketer role under Branch
-- Marketers can be registered by Branch users
-- Based on marketerpro-suite-main schema
-- =====================================================

-- 1. Add 'marketer' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'marketer';

-- 2. Add branch_id to profiles for Marketer -> Branch relationship
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES profiles(id);

-- 3. Add password_hash to profiles for Marketer custom auth (Staff ID login)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;

-- 4. Create prospects table for Marketer leads management
CREATE TABLE IF NOT EXISTS prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama_prospek text NOT NULL,                -- Prospect name
  no_telefon text NOT NULL,                  -- Phone number
  niche text NOT NULL,                       -- Niche/category (product name)
  jenis_prospek text NOT NULL,               -- Prospect type: NP, EP, EC
  tarikh_phone_number date,                  -- Date of phone number entry
  marketer_id_staff text,                    -- Marketer Staff ID who owns this prospect
  created_by uuid REFERENCES profiles(id),   -- Reference to profiles.id
  status_closed text,                        -- Closed status
  price_closed numeric,                      -- Closed price
  count_order integer NOT NULL DEFAULT 0,    -- Count of orders made by this lead
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prospects_pkey PRIMARY KEY (id)
);

-- 5. Create spends table for marketing spend tracking
CREATE TABLE IF NOT EXISTS spends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product text NOT NULL,                     -- Product/campaign name
  jenis_platform text NOT NULL,              -- Platform: Facebook, Tiktok, etc.
  total_spend numeric NOT NULL DEFAULT 0,    -- Spend amount
  tarikh_spend date NOT NULL DEFAULT CURRENT_DATE, -- Spend date
  marketer_id_staff text,                    -- Marketer staff ID
  branch_id uuid REFERENCES profiles(id),    -- Branch reference
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT spends_pkey PRIMARY KEY (id)
);

-- 6. Create pnl_config table for salary tier configuration
CREATE TABLE IF NOT EXISTS pnl_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'marketer',     -- 'marketer'
  min_sales numeric NOT NULL DEFAULT 0,      -- Minimum sales threshold
  max_sales numeric,                         -- Maximum sales threshold (null = no limit)
  roas_min numeric NOT NULL DEFAULT 0,       -- Minimum ROAS requirement
  roas_max numeric NOT NULL DEFAULT 99,      -- Maximum ROAS range
  commission_percent numeric NOT NULL DEFAULT 0,  -- Commission % of net sales
  bonus_amount numeric NOT NULL DEFAULT 0,   -- Fixed bonus amount
  branch_id uuid REFERENCES profiles(id),    -- Branch reference
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pnl_config_pkey PRIMARY KEY (id)
);

-- 7. Add marketer-specific columns to customer_purchases
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS marketer_id uuid REFERENCES profiles(id);
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS marketer_id_staff text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS marketer_name text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS jenis_platform text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS jenis_customer text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS jenis_closing text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS harga_jualan_produk numeric;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS kos_pos numeric DEFAULT 0;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS kos_produk numeric DEFAULT 0;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS profit numeric DEFAULT 0;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS date_order date DEFAULT CURRENT_DATE;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS date_processed date;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS date_return date;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS receipt_image_url text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS waybill_url text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS tarikh_bayaran date;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS jenis_bayaran text;
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS bank text;

-- 8. Create login_marketer function for Staff ID authentication
CREATE OR REPLACE FUNCTION login_marketer(p_idstaff text, p_password text)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  idstaff text,
  role text,
  branch_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as user_id,
    COALESCE(p.email, '') as username,
    p.full_name,
    p.idstaff,
    ur.role::text,
    p.branch_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.idstaff = p_idstaff
    AND p.password_hash = UPPER(p_password)
    AND p.is_active = true
    AND ur.role = 'marketer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create register_marketer function for Branch to register marketers
CREATE OR REPLACE FUNCTION register_marketer(
  p_idstaff text,
  p_password text,
  p_full_name text,
  p_branch_id uuid
)
RETURNS TABLE (
  user_id uuid,
  idstaff text,
  full_name text,
  role text,
  branch_id uuid
) AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if idstaff already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE idstaff = p_idstaff) THEN
    RAISE EXCEPTION 'Staff ID already exists';
  END IF;

  -- Create profile with generated UUID
  INSERT INTO profiles (id, email, full_name, idstaff, password_hash, branch_id, is_active)
  VALUES (
    gen_random_uuid(),
    p_idstaff || '@marketer.local',  -- Placeholder email
    p_full_name,
    p_idstaff,
    UPPER(p_password),
    p_branch_id,
    true
  )
  RETURNING id INTO v_user_id;

  -- Assign marketer role
  INSERT INTO user_roles (user_id, role, created_by)
  VALUES (v_user_id, 'marketer', p_branch_id);

  -- Return the created user
  RETURN QUERY
  SELECT
    v_user_id as user_id,
    p_idstaff as idstaff,
    p_full_name as full_name,
    'marketer'::text as role,
    p_branch_id as branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RLS Policies for prospects
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketers can view own prospects" ON prospects
  FOR SELECT USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Marketers can insert own prospects" ON prospects
  FOR INSERT WITH CHECK (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Marketers can update own prospects" ON prospects
  FOR UPDATE USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Marketers can delete own prospects" ON prospects
  FOR DELETE USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Branch can view all prospects under their marketers" ON prospects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.idstaff = prospects.marketer_id_staff
      AND p.branch_id = auth.uid()
    )
  );

-- 11. RLS Policies for spends
ALTER TABLE spends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketers can view own spends" ON spends
  FOR SELECT USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Marketers can insert own spends" ON spends
  FOR INSERT WITH CHECK (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Marketers can update own spends" ON spends
  FOR UPDATE USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Marketers can delete own spends" ON spends
  FOR DELETE USING (
    marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Branch can view all spends under their marketers" ON spends
  FOR SELECT USING (
    branch_id = auth.uid()
  );

-- 12. RLS Policies for pnl_config
ALTER TABLE pnl_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch can manage own pnl_config" ON pnl_config
  FOR ALL USING (branch_id = auth.uid());

CREATE POLICY "Marketers can view pnl_config" ON pnl_config
  FOR SELECT USING (
    branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

-- 13. Update customer_purchases policies for Marketer access
CREATE POLICY "Marketers can view own customer_purchases" ON customer_purchases
  FOR SELECT USING (
    marketer_id = auth.uid()
    OR marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Marketers can insert own customer_purchases" ON customer_purchases
  FOR INSERT WITH CHECK (
    marketer_id = auth.uid()
    OR marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Marketers can update own customer_purchases" ON customer_purchases
  FOR UPDATE USING (
    marketer_id = auth.uid()
    OR marketer_id_staff = (SELECT idstaff FROM profiles WHERE id = auth.uid())
  );

-- 14. Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_idstaff ON profiles(idstaff);
CREATE INDEX IF NOT EXISTS idx_prospects_marketer_id_staff ON prospects(marketer_id_staff);
CREATE INDEX IF NOT EXISTS idx_spends_marketer_id_staff ON spends(marketer_id_staff);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_marketer_id_staff ON customer_purchases(marketer_id_staff);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_date_order ON customer_purchases(date_order);

-- Comments
COMMENT ON COLUMN profiles.branch_id IS 'Branch ID for marketers (references Branch profile)';
COMMENT ON COLUMN profiles.password_hash IS 'Password hash for Staff ID login (uppercase)';
COMMENT ON TABLE prospects IS 'Marketer leads management';
COMMENT ON TABLE spends IS 'Marketing spend tracking';
COMMENT ON TABLE pnl_config IS 'PNL salary tier configuration by Branch';
