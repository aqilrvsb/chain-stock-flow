-- Add image_url column to bundles table
-- Each bundle can have its own unique image

ALTER TABLE public.bundles
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.bundles.image_url IS 'URL to the bundle image stored in Supabase Storage';
