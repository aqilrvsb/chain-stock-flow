-- Add remarks column to pending_orders table
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS remarks text;

-- Add comment
COMMENT ON COLUMN public.pending_orders.remarks IS 'Admin remarks/notes for the order';
