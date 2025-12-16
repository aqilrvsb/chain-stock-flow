-- Add company/invoice information fields to profiles table for Branch users
-- These fields will be used to display dynamic invoice headers

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_reg text,
ADD COLUMN IF NOT EXISTS business_address text,
ADD COLUMN IF NOT EXISTS business_phone text,
ADD COLUMN IF NOT EXISTS business_email text,
ADD COLUMN IF NOT EXISTS business_website text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.company_name IS 'Company/business name for invoice header';
COMMENT ON COLUMN public.profiles.company_reg IS 'Company registration number (e.g., 1579025-U)';
COMMENT ON COLUMN public.profiles.business_address IS 'Full business address for invoice';
COMMENT ON COLUMN public.profiles.business_phone IS 'Business phone number(s) for invoice';
COMMENT ON COLUMN public.profiles.business_email IS 'Business email for invoice';
COMMENT ON COLUMN public.profiles.business_website IS 'Business website URL for invoice';
