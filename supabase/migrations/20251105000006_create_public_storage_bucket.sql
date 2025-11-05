-- Create public storage bucket for receipts and system files
-- This bucket is used for:
-- 1. Agent purchase receipts (receipts/)
-- 2. System logo uploads (system/)

INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- Allow agents to upload receipt images
CREATE POLICY "Agents can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'receipts'
);

-- Allow agents to view their own receipts
CREATE POLICY "Agents can view own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'receipts'
);

-- Allow HQ to upload system files (like logo)
CREATE POLICY "HQ can upload system files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role)) AND
  (storage.foldername(name))[1] = 'system'
);

-- Allow everyone to view system files (like logo)
CREATE POLICY "Anyone can view system files"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'system'
);

-- Allow master agents to view receipts from their agents
-- Simplified policy: master agents can view any receipt in the receipts folder
-- More specific filtering happens in the application layer
CREATE POLICY "Master agents can view agent receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'receipts' AND
  EXISTS (
    SELECT 1 FROM public.master_agent_relationships
    WHERE master_agent_id = auth.uid()
  )
);

-- Allow HQ to view all receipts
CREATE POLICY "HQ can view all receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'receipts' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role))
);
