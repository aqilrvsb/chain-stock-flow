-- Add order_from column to customer_purchases table
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS order_from TEXT;

-- Add attachment_url column for PDF attachments (Tiktok/Shopee orders)
ALTER TABLE customer_purchases ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Add comment for order_from options
COMMENT ON COLUMN customer_purchases.order_from IS 'Order source: Tiktok HQ, Shopee HQ, Online HQ, SYAHIR, AFIF';
