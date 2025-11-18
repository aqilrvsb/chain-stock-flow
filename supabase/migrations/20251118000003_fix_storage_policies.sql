-- Fix storage policies to allow HQ to update and delete system files
-- This is needed for favicon uploads which use a fixed filename and need to overwrite

-- Drop existing policies if they exist (in case of re-run)
DROP POLICY IF EXISTS "HQ can update system files" ON storage.objects;
DROP POLICY IF EXISTS "HQ can delete system files" ON storage.objects;

-- Allow HQ to update system files
CREATE POLICY "HQ can update system files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'system' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hq'
  )
)
WITH CHECK (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'system' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hq'
  )
);

-- Allow HQ to delete system files
CREATE POLICY "HQ can delete system files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'system' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hq'
  )
);
