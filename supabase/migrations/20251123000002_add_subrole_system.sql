-- Add sub-role system for Master Agent and Agent tiers
-- Master Agent: Dealer 1, Dealer 2
-- Agent: Platinum, Gold

-- Step 1: Add sub_role column to profiles table
ALTER TABLE public.profiles
ADD COLUMN sub_role TEXT;

-- Add check constraint for valid sub_role values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_sub_role_check
CHECK (sub_role IS NULL OR sub_role IN ('dealer_1', 'dealer_2', 'platinum', 'gold'));

-- Step 2: Update bundles table - Add 4 new price columns
ALTER TABLE public.bundles
ADD COLUMN dealer_1_price NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN dealer_2_price NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN platinum_price NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN gold_price NUMERIC NOT NULL DEFAULT 0;

-- Step 3: Drop old price columns from bundles (will be deleted by user)
-- User will delete existing bundles, so we can safely drop these columns later
-- For now, keep them for reference
-- ALTER TABLE public.bundles DROP COLUMN master_agent_price;
-- ALTER TABLE public.bundles DROP COLUMN agent_price;

-- Step 4: Create new enum type for rewards with sub-roles
-- First, create the new type
DO $$ BEGIN
  CREATE TYPE app_role_subrole AS ENUM ('hq', 'dealer_1', 'dealer_2', 'platinum', 'gold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 5: Add new role_subrole column to rewards_config
ALTER TABLE public.rewards_config
ADD COLUMN role_subrole app_role_subrole;

-- Step 6: Set default sub_roles for existing users based on their main role
-- All existing master_agents get dealer_1
UPDATE public.profiles p
SET sub_role = 'dealer_1'
FROM public.user_roles ur
WHERE p.id = ur.user_id
AND ur.role = 'master_agent'
AND p.sub_role IS NULL;

-- All existing agents get platinum
UPDATE public.profiles p
SET sub_role = 'platinum'
FROM public.user_roles ur
WHERE p.id = ur.user_id
AND ur.role = 'agent'
AND p.sub_role IS NULL;

-- Step 7: Create index on sub_role for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_sub_role ON public.profiles(sub_role);

-- Step 8: Add comment to document the sub_role system
COMMENT ON COLUMN public.profiles.sub_role IS 'Sub-role tier: dealer_1/dealer_2 for master_agent, platinum/gold for agent';
COMMENT ON COLUMN public.bundles.dealer_1_price IS 'Price for Master Agent Dealer 1 tier';
COMMENT ON COLUMN public.bundles.dealer_2_price IS 'Price for Master Agent Dealer 2 tier';
COMMENT ON COLUMN public.bundles.platinum_price IS 'Price for Agent Platinum tier';
COMMENT ON COLUMN public.bundles.gold_price IS 'Price for Agent Gold tier';
