-- ============================================================================
-- MIGRATION: Add Storehub API Credentials to Profiles
-- Date: 2025-12-10
-- Description: Add storehub_username and storehub_password columns for Branch users
-- ============================================================================

-- Add storehub_username column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS storehub_username text;

-- Add storehub_password column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS storehub_password text;

-- ============================================================================
-- DONE!
-- ============================================================================
