-- ============================================================
-- INSERT DATA FROM LOVABLE CLOUD
-- Chain Stock Flow - Data Migration
-- ============================================================
--
-- This script inserts all data exported from Lovable Cloud
-- Run this AFTER running COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql
--
-- Order of insertion respects foreign key constraints:
-- 1. Products (no dependencies)
-- 2. Profiles (from auth.users)
-- 3. User Roles (depends on profiles)
-- 4. Master Agent Relationships (depends on profiles)
-- 5. Bundles (depends on products)
-- 6. Inventory (depends on profiles, products)
-- 7. Stock in HQ (depends on profiles, products)
-- 8. Transactions (depends on profiles, products)
-- 9. Pending Orders (depends on profiles, products)
-- 10. Rewards Config (no dependencies)
-- 11. System Settings (no dependencies)
--
-- ============================================================

-- ============================================================
-- STEP 1: INSERT PRODUCTS
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
-- STEP 2: INSERT PROFILES
-- ============================================================

-- First, create auth.users entries (these will auto-create profiles via trigger)
-- Note: You need to create these users via Supabase Dashboard > Authentication > Users
-- with the following emails and UUIDs:
--
-- 1. Email: hq@gmail.com, UUID: 455f37a3-9596-4812-bc26-be12345b9ffd
-- 2. Email: aqil@gmail.com, UUID: 3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923
-- 3. Email: em@gmail.com, UUID: 657c9f0b-6f3f-4ff0-874f-e7fd50810528
--
-- After creating users, update their profiles:

INSERT INTO public.profiles (id, email, full_name, phone, created_at, updated_at, is_active, idstaff, phone_number, whatsapp_number, delivery_address)
VALUES
  ('455f37a3-9596-4812-bc26-be12345b9ffd', 'hq@gmail.com', '', NULL, '2025-10-30 11:23:50.161382+00', '2025-11-03 13:36:52.092251+00', true, 'OJHQ', NULL, NULL, NULL),
  ('3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', 'aqil@gmail.com', 'MA-aqil', '', '2025-11-02 06:55:29.767042+00', '2025-11-02 13:43:28.067973+00', true, 'MA-001', '60108924904', '60108924904', 'Lot 34 Taman SEDC Kampung Raja 22200 Besut Terengganu'),
  ('657c9f0b-6f3f-4ff0-874f-e7fd50810528', 'em@gmail.com', 'em', '', '2025-11-02 07:12:37.592424+00', '2025-11-02 07:14:05.515702+00', true, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  idstaff = EXCLUDED.idstaff,
  phone_number = EXCLUDED.phone_number,
  whatsapp_number = EXCLUDED.whatsapp_number,
  delivery_address = EXCLUDED.delivery_address;

-- ============================================================
-- STEP 3: INSERT USER ROLES
-- ============================================================

INSERT INTO public.user_roles (id, user_id, role, created_by, created_at)
VALUES
  ('ac9c95b0-705d-4e27-af24-769e10d01cad', '455f37a3-9596-4812-bc26-be12345b9ffd', 'hq', NULL, '2025-10-30 11:23:50.570154+00'),
  ('1586eeb0-caaa-42ce-9f03-3e6de42da2bd', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', 'master_agent', '455f37a3-9596-4812-bc26-be12345b9ffd', '2025-11-02 06:55:30.110489+00'),
  ('debccfc3-13d1-4302-bdfc-491d72e37ca5', '657c9f0b-6f3f-4ff0-874f-e7fd50810528', 'agent', '455f37a3-9596-4812-bc26-be12345b9ffd', '2025-11-02 07:12:37.936027+00')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- STEP 4: INSERT MASTER AGENT RELATIONSHIPS
-- ============================================================

INSERT INTO public.master_agent_relationships (id, master_agent_id, agent_id, created_at)
VALUES
  ('9da482e6-1c9c-4062-b8f0-6967314ad083', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '657c9f0b-6f3f-4ff0-874f-e7fd50810528', '2025-11-02 07:12:38.222008+00')
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================================
-- STEP 5: INSERT BUNDLES
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
-- STEP 6: INSERT INVENTORY
-- ============================================================

INSERT INTO public.inventory (id, user_id, product_id, quantity, updated_at)
VALUES
  ('719bd355-931e-41a0-854a-358fbb70d247', '455f37a3-9596-4812-bc26-be12345b9ffd', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 400, '2025-11-02 07:39:04.521345+00'),
  ('9d8c54be-2124-4fef-b33f-c23b1023ee7a', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 324, '2025-11-02 12:55:11.474573+00')
ON CONFLICT (user_id, product_id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- STEP 7: INSERT STOCK IN HQ
-- ============================================================

INSERT INTO public.stock_in_hq (id, product_id, quantity, description, date, user_id, created_at)
VALUES
  ('2fea4243-e831-4eed-a7f2-1a24a2e82b80', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 100, '', '2025-11-02 00:00:00+00', '455f37a3-9596-4812-bc26-be12345b9ffd', '2025-11-02 07:39:03.887621+00')
ON CONFLICT (id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  description = EXCLUDED.description;

-- ============================================================
-- STEP 8: INSERT TRANSACTIONS
-- ============================================================

INSERT INTO public.transactions (id, buyer_id, seller_id, product_id, quantity, unit_price, total_price, transaction_type, created_at)
VALUES
  ('9a1b7423-5add-4ba4-8d22-471a12b7bb7c', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', NULL, '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 324, 60.00, 1620.00, 'purchase', '2025-11-02 12:55:10.838874+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 9: INSERT PENDING ORDERS
-- ============================================================

-- Note: pending_orders table needs transaction_id and billplz_bill_id columns
-- Let's add billplz_bill_id if it doesn't exist
ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS billplz_bill_id TEXT;

INSERT INTO public.pending_orders (id, order_number, buyer_id, product_id, quantity, unit_price, total_price, status, created_at, updated_at, transaction_id, billplz_bill_id)
VALUES
  ('2eb72282-f414-4b1f-9dcf-f1a79963b596', '1000', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 60, 'pending', '2025-11-02 16:15:51.573946+00', '2025-11-02 16:15:51.573946+00', NULL, NULL),
  ('d4ba60a3-1232-415f-8232-d78e48585efc', 'ON1', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 60, 'pending', '2025-11-03 14:46:09.329877+00', '2025-11-03 14:46:09.329877+00', 'c5221ab5fdaf7e43', NULL),
  ('02f867d8-8ca9-4a61-a05f-001e50e49931', 'ON2', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 60, 'pending', '2025-11-03 14:46:46.915572+00', '2025-11-03 14:46:46.915572+00', '55b3779b3f3d952d', NULL),
  ('661d8ba1-94c6-4486-b4e9-cb16e1e63ba8', 'ON3', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 60, 'failed', '2025-11-03 14:47:14.228142+00', '2025-11-03 14:47:41.625564+00', '512e50033ce097ed', NULL),
  ('018cbc28-9b4f-42a2-8686-8d8a37bf0cd1', 'ON4', '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923', '8b08ef3c-ab8b-4fcd-95f4-f1058a073acc', 12, 60, 60, 'failed', '2025-11-03 15:01:46.129551+00', '2025-11-03 15:02:06.777454+00', '251320f705aa4022', '251320f705aa4022')
ON CONFLICT (order_number) DO UPDATE SET
  status = EXCLUDED.status,
  transaction_id = EXCLUDED.transaction_id,
  billplz_bill_id = EXCLUDED.billplz_bill_id,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- STEP 10: INSERT REWARDS CONFIG
-- ============================================================

INSERT INTO public.rewards_config (id, role, min_quantity, reward_description, is_active, created_at, updated_at, month, year)
VALUES
  ('6823dcab-dedf-47b2-9622-1325cc4225a6', 'master_agent', 30, 'testastast', true, '2025-11-02 08:03:52.444428+00', '2025-11-02 08:03:52.444428+00', 11, 2025)
ON CONFLICT (id) DO UPDATE SET
  min_quantity = EXCLUDED.min_quantity,
  reward_description = EXCLUDED.reward_description,
  is_active = EXCLUDED.is_active,
  month = EXCLUDED.month,
  year = EXCLUDED.year;

-- ============================================================
-- STEP 11: INSERT SYSTEM SETTINGS
-- ============================================================

INSERT INTO public.system_settings (id, setting_key, setting_value, created_at, updated_at)
VALUES
  ('17408f80-dd7d-401d-b0fd-acc9bd0912fa', 'logo_url', '/logo.png', '2025-11-03 13:36:52.092251+00', '2025-11-03 13:36:52.092251+00')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = EXCLUDED.updated_at;

-- ============================================================
-- DATA INSERTION COMPLETE!
-- ============================================================
--
-- Summary of inserted data:
-- ✓ 1 Product (Olive Oil)
-- ✓ 3 Profiles (HQ, Master Agent, Agent)
-- ✓ 3 User Roles
-- ✓ 1 Master Agent Relationship
-- ✓ 1 Bundle
-- ✓ 2 Inventory Records
-- ✓ 1 Stock in HQ Record
-- ✓ 1 Transaction
-- ✓ 5 Pending Orders
-- ✓ 1 Reward Config
-- ✓ 1 System Setting
--
-- IMPORTANT NOTE:
-- You need to create the 3 users in Supabase Authentication first:
-- 1. hq@gmail.com (UUID: 455f37a3-9596-4812-bc26-be12345b9ffd)
-- 2. aqil@gmail.com (UUID: 3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923)
-- 3. em@gmail.com (UUID: 657c9f0b-6f3f-4ff0-874f-e7fd50810528)
--
-- After creating users, run this script again to update profiles.
--
-- ============================================================
