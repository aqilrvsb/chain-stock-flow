-- Fix storage policies to allow HQ to update and delete system files
-- This is needed for favicon uploads which use a fixed filename and need to overwrite

-- Allow HQ to update system files
CREATE POLICY "HQ can update system files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role)) AND
  (storage.foldername(name))[1] = 'system'
)
WITH CHECK (
  bucket_id = 'public' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role)) AND
  (storage.foldername(name))[1] = 'system'
);

-- Allow HQ to delete system files
CREATE POLICY "HQ can delete system files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role)) AND
  (storage.foldername(name))[1] = 'system'
);

-- Add comment
COMMENT ON POLICY "HQ can update system files" ON storage.objects IS 'Allows HQ to overwrite system files like favicon';
COMMENT ON POLICY "HQ can delete system files" ON storage.objects IS 'Allows HQ to delete old system files before uploading new ones';
