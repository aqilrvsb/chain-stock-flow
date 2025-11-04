-- Add image_url column to products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'HQ can upload product images'
    ) THEN
        CREATE POLICY "HQ can upload product images"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'product-images' AND
          (SELECT has_role(auth.uid(), 'hq'::app_role))
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can view product images'
    ) THEN
        CREATE POLICY "Anyone can view product images"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'product-images');
    END IF;
END $$;