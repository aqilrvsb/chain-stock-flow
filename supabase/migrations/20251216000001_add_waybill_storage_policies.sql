-- Add storage policies for waybill uploads by Marketers
-- Marketers upload Shopee/Tiktok waybill PDFs to waybills/ folder

-- Allow Marketers to upload waybills
CREATE POLICY "Marketers can upload waybills"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'waybills'
);

-- Allow authenticated users to view waybills (needed for Branch logistics to print)
CREATE POLICY "Authenticated users can view waybills"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts' AND
  (storage.foldername(name))[1] = 'waybills'
);

-- Allow Marketers to delete their own waybills (when editing orders)
CREATE POLICY "Marketers can delete waybills"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts' AND
  (storage.foldername(name))[1] = 'waybills' AND
  auth.uid() IS NOT NULL
);
