-- Add alamat (address) column to customer_purchases table for marketer orders
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS alamat text;

-- Add comment
COMMENT ON COLUMN public.customer_purchases.alamat IS 'Full address for delivery (used by marketer orders)';
