-- Add is_active column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);