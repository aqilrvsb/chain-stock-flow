-- ============================================================
-- INSERT BILLPLZ CONFIGURATION
-- Chain Stock Flow - Payment Gateway Setup
-- ============================================================
--
-- This script adds Billplz payment gateway configuration
-- to your system_settings table
--
-- ============================================================

-- Replace these values with your actual Billplz credentials:
-- 1. Get your API Key from: https://www.billplz.com/enterprise/setting
-- 2. Get your Collection ID from: https://www.billplz.com/collections

INSERT INTO public.system_settings (id, setting_key, setting_value, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'billplz_api_key', 'YOUR_BILLPLZ_API_KEY_HERE', 'Billplz API Secret Key for payment processing', NOW(), NOW()),
  (gen_random_uuid(), 'billplz_collection_id', 'YOUR_BILLPLZ_COLLECTION_ID_HERE', 'Billplz Collection ID for receiving payments', NOW(), NOW())
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

-- Run this to verify the settings were inserted:
SELECT setting_key, setting_value, description
FROM public.system_settings
WHERE setting_key IN ('billplz_api_key', 'billplz_collection_id');

-- ============================================================
-- INSTRUCTIONS:
-- ============================================================
--
-- 1. Go to Billplz Dashboard: https://www.billplz.com/enterprise/setting
-- 2. Copy your API Secret Key
-- 3. Copy your Collection ID from: https://www.billplz.com/collections
-- 4. Replace 'YOUR_BILLPLZ_API_KEY_HERE' with your actual API key
-- 5. Replace 'YOUR_BILLPLZ_COLLECTION_ID_HERE' with your Collection ID
-- 6. Run this script in Supabase SQL Editor
--
-- ============================================================

-- Alternative: You can also set these as Supabase Edge Function secrets
-- via the Supabase Dashboard:
--
-- Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/settings/functions
--
-- Add these secrets:
-- - BILLPLZ_API_KEY = your_api_key
-- - BILLPLZ_COLLECTION_ID = your_collection_id
--
-- ============================================================
