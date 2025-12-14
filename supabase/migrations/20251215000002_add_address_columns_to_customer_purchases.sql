-- Add address columns to customer_purchases table for marketer orders
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS bandar text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS poskod text;
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS negeri text;

-- Add comments
COMMENT ON COLUMN public.customer_purchases.bandar IS 'City/district for delivery (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.poskod IS 'Postcode for delivery (used by marketer orders)';
COMMENT ON COLUMN public.customer_purchases.negeri IS 'State for delivery (used by marketer orders)';
