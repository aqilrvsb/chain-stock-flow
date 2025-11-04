-- ============================================================
-- CHECK EXISTING USERS AND INSERT DATA
-- Chain Stock Flow - Data Migration
-- ============================================================
--
-- STEP 1: First, run this query to see what users exist in auth.users:
-- ============================================================

SELECT
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
ORDER BY email;

-- ============================================================
-- INSTRUCTIONS:
-- ============================================================
-- 1. Run the query above to see the actual UUIDs of your users
-- 2. Copy the UUIDs for:
--    - hq@gmail.com
--    - aqil@gmail.com
--    - em@gmail.com
-- 3. Replace the UUIDs in the INSERT script below with the ACTUAL UUIDs
-- 4. Then run the entire INSERT script
-- ============================================================

-- ============================================================
-- STEP 2: INSERT DATA (Replace UUIDs with actual values from Step 1)
-- ============================================================

-- IMPORTANT: Replace these placeholder UUIDs with the ACTUAL UUIDs from Step 1!
-- HQ UUID: Replace 'YOUR_HQ_UUID_HERE' with actual UUID
-- MA UUID: Replace 'YOUR_MA_UUID_HERE' with actual UUID
-- Agent UUID: Replace 'YOUR_AGENT_UUID_HERE' with actual UUID

-- ============================================================
-- INSERT PRODUCTS
-- ============================================================

INSERT INTO public.products (id, name, description, sku, base_cost, created_at, updated_at, is_active, image_url)
VALUES
  ('8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 'Olive Oil', '', 'OLO', 25.00, '2025-11-02 06:40:50.891521+00', '2025-11-02 06:40:50.891521+00', true, 'https://lwhdvkrdwdmuauxxhxsg.supabase.co/storage/v1/object/public/product-images/1762065647830-s9ll4i.jpg')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sku = EXCLUDED.sku,
  base_cost = EXCLUDED.base_cost,
  is_active = EXCLUDED.is_active,
  image_url = EXCLUDED.image_url;

-- ============================================================
-- INSERT/UPDATE PROFILES
-- ============================================================
-- Replace the UUIDs below with actual UUIDs from auth.users!

INSERT INTO public.profiles (id, email, full_name, phone, is_active, idstaff, phone_number, whatsapp_number, delivery_address, created_at, updated_at)
VALUES
  ('53bbc555-6d42-4c94-862b-5a448b77aeec', 'hq@gmail.com', '', NULL, true, 'OJHQ', NULL, NULL, NULL, NOW(), NOW()),
  ('6cd9af45-2483-4211-a224-d881c2aabf65', 'aqil@gmail.com', 'MA-aqil', '', true, 'MA-001', '60108924904', '60108924904', 'Lot 34 Taman SEDC Kampung Raja 22200 Besut Terengganu', NOW(), NOW()),
  ('2f4b81f0-dddb-430e-b262-41e2aef22110', 'em@gmail.com', 'em', '', true, NULL, NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  idstaff = EXCLUDED.idstaff,
  phone_number = EXCLUDED.phone_number,
  whatsapp_number = EXCLUDED.whatsapp_number,
  delivery_address = EXCLUDED.delivery_address,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- INSERT USER ROLES
-- ============================================================

INSERT INTO public.user_roles (id, user_id, role, created_by, created_at)
VALUES
  (gen_random_uuid(), '53bbc555-6d42-4c94-862b-5a448b77aeec', 'hq', NULL, NOW()),
  (gen_random_uuid(), '6cd9af45-2483-4211-a224-d881c2aabf65', 'master_agent', '53bbc555-6d42-4c94-862b-5a448b77aeec', NOW()),
  (gen_random_uuid(), '2f4b81f0-dddb-430e-b262-41e2aef22110', 'agent', '53bbc555-6d42-4c94-862b-5a448b77aeec', NOW())
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- INSERT MASTER AGENT RELATIONSHIPS
-- ============================================================

INSERT INTO public.master_agent_relationships (id, master_agent_id, agent_id, created_at)
VALUES
  (gen_random_uuid(), '6cd9af45-2483-4211-a224-d881c2aabf65', '2f4b81f0-dddb-430e-b262-41e2aef22110', NOW())
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================================
-- INSERT BUNDLES
-- ============================================================

INSERT INTO public.bundles (id, name, product_id, units, master_agent_price, agent_price, is_active, created_at, updated_at)
VALUES
  ('0259cbe1-2562-42c9-a3f6-4fe517be0e99', '1 Caton Olive Oil', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 70, true, '2025-11-02 06:41:22.588956+00', '2025-11-02 06:41:22.588956+00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  product_id = EXCLUDED.product_id,
  units = EXCLUDED.units,
  master_agent_price = EXCLUDED.master_agent_price,
  agent_price = EXCLUDED.agent_price,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- INSERT INVENTORY
-- ============================================================

INSERT INTO public.inventory (id, user_id, product_id, quantity, updated_at)
VALUES
  (gen_random_uuid(), '53bbc555-6d42-4c94-862b-5a448b77aeec', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 400, '2025-11-02 07:39:04.521345+00'),
  (gen_random_uuid(), '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 324, '2025-11-02 12:55:11.474573+00')
ON CONFLICT (user_id, product_id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- INSERT STOCK IN HQ
-- ============================================================

INSERT INTO public.stock_in_hq (id, product_id, quantity, description, date, user_id, created_at)
VALUES
  (gen_random_uuid(), '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 100, '', '2025-11-02 00:00:00+00', '53bbc555-6d42-4c94-862b-5a448b77aeec', '2025-11-02 07:39:03.887621+00')
ON CONFLICT (id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  description = EXCLUDED.description;

-- ============================================================
-- INSERT TRANSACTIONS
-- ============================================================

INSERT INTO public.transactions (id, buyer_id, seller_id, product_id, quantity, unit_price, total_price, transaction_type, created_at)
VALUES
  (gen_random_uuid(), '6cd9af45-2483-4211-a224-d881c2aabf65', NULL, '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 324, 60.00, 19440.00, 'purchase', '2025-11-02 12:55:10.838874+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT PENDING ORDERS
-- ============================================================

ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS billplz_bill_id TEXT;

INSERT INTO public.pending_orders (id, order_number, buyer_id, product_id, quantity, unit_price, total_price, status, created_at, updated_at, transaction_id, billplz_bill_id)
VALUES
  (gen_random_uuid(), '1000', '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 720, 'pending', '2025-11-02 16:15:51.573946+00', '2025-11-02 16:15:51.573946+00', NULL, NULL),
  (gen_random_uuid(), 'ON1', '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 720, 'pending', '2025-11-03 14:46:09.329877+00', '2025-11-03 14:46:09.329877+00', 'c5221ab5fdaf7e43', NULL),
  (gen_random_uuid(), 'ON2', '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 720, 'pending', '2025-11-03 14:46:46.915572+00', '2025-11-03 14:46:46.915572+00', '55b3779b3f3d952d', NULL),
  (gen_random_uuid(), 'ON3', '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 720, 'failed', '2025-11-03 14:47:14.228142+00', '2025-11-03 14:47:41.625564+00', '512e50033ce097ed', NULL),
  (gen_random_uuid(), 'ON4', '6cd9af45-2483-4211-a224-d881c2aabf65', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 720, 'failed', '2025-11-03 15:01:46.129551+00', '2025-11-03 15:02:06.777454+00', '251320f705aa4022', '251320f705aa4022')
ON CONFLICT (order_number) DO UPDATE SET
  status = EXCLUDED.status,
  transaction_id = EXCLUDED.transaction_id,
  billplz_bill_id = EXCLUDED.billplz_bill_id,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- INSERT REWARDS CONFIG
-- ============================================================

INSERT INTO public.rewards_config (id, role, min_quantity, reward_description, is_active, created_at, updated_at, month, year)
VALUES
  (gen_random_uuid(), 'master_agent', 30, 'testastast', true, '2025-11-02 08:03:52.444428+00', '2025-11-02 08:03:52.444428+00', 11, 2025)
ON CONFLICT (id) DO UPDATE SET
  min_quantity = EXCLUDED.min_quantity,
  reward_description = EXCLUDED.reward_description,
  is_active = EXCLUDED.is_active,
  month = EXCLUDED.month,
  year = EXCLUDED.year;

-- ============================================================
-- INSERT SYSTEM SETTINGS
-- ============================================================

INSERT INTO public.system_settings (id, setting_key, setting_value, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'logo_url', '/logo.png', NOW(), NOW())
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'master_agent_relationships', COUNT(*) FROM master_agent_relationships
UNION ALL
SELECT 'bundles', COUNT(*) FROM bundles
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'stock_in_hq', COUNT(*) FROM stock_in_hq
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'pending_orders', COUNT(*) FROM pending_orders
UNION ALL
SELECT 'rewards_config', COUNT(*) FROM rewards_config
UNION ALL
SELECT 'system_settings', COUNT(*) FROM system_settings
ORDER BY table_name;
