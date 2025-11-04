-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- Allow authenticated users to upload product images
CREATE POLICY "HQ can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  (SELECT has_role(auth.uid(), 'hq'::app_role))
);

-- Allow everyone to view product images
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Add image_url column to products table
ALTER TABLE products
ADD COLUMN image_url TEXT;