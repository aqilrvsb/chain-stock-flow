-- ============================================================
-- ADD STATE COLUMN TO PROFILES TABLE
-- Chain Stock Flow - Add Malaysia State Selection
-- ============================================================

-- Add state column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS state TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.state IS 'State/region in Malaysia where the user is located';

-- Verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'state';

-- Show sample of profiles with state
SELECT id, full_name, email, idstaff, state
FROM public.profiles
LIMIT 5;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ State column added to profiles table';
    RAISE NOTICE '✅ You can now store Malaysia state information for users';
END $$;
