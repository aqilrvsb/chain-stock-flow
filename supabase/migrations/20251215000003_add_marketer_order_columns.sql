-- Add missing columns for marketer orders in customer_purchases table
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS no_phone text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS produk text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS kurier text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS no_tracking text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS cara_bayaran text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS nota_staff text;

-- Add comments
COMMENT ON COLUMN public.customer_purchases.no_phone IS 'Customer phone number (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.produk IS 'Product name (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.sku IS 'Product SKU (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.kurier IS 'Courier service name (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.no_tracking IS 'Tracking number alias (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.cara_bayaran IS 'Payment method type: CASH or COD (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.nota_staff IS 'Staff notes (used by marketer orders)';
