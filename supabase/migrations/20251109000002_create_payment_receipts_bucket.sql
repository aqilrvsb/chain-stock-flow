-- Create payment-receipts storage bucket for Master Agent manual payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow Master Agents to upload payment receipts
CREATE POLICY "Master Agents can upload payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = 'receipts'
);

-- Allow Master Agents to view their own receipts
CREATE POLICY "Master Agents can view own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts' AND
  (storage.foldername(name))[1] = 'receipts'
);

-- Allow HQ to view all payment receipts
CREATE POLICY "HQ can view all payment receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts' AND
  (storage.foldername(name))[1] = 'receipts' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role))
);
