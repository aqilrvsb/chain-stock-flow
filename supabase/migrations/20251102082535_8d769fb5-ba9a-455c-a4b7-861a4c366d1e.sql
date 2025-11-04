-- Add idstaff column to profiles table with unique constraint
ALTER TABLE public.profiles 
ADD COLUMN idstaff text UNIQUE;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.idstaff IS 'Unique staff ID used for login and identification';

-- Create index for faster lookups
CREATE INDEX idx_profiles_idstaff ON public.profiles(idstaff);
