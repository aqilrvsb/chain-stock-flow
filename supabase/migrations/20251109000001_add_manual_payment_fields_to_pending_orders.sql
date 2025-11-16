-- Add manual payment fields to pending_orders table
ALTER TABLE public.pending_orders
ADD COLUMN payment_type text CHECK (payment_type IN ('Online Transfer', 'Cheque', 'CDM', 'Cash')),
ADD COLUMN payment_date date,
ADD COLUMN bank_name text,
ADD COLUMN receipt_image_url text,
ADD COLUMN payment_method text DEFAULT 'fpx' CHECK (payment_method IN ('fpx', 'manual'));

COMMENT ON COLUMN public.pending_orders.payment_type IS 'Manual payment type: Online Transfer, Cheque, CDM, or Cash';
COMMENT ON COLUMN public.pending_orders.payment_date IS 'Date of manual payment';
COMMENT ON COLUMN public.pending_orders.bank_name IS 'Bank name for manual payment';
COMMENT ON COLUMN public.pending_orders.receipt_image_url IS 'Receipt image URL for manual payment';
COMMENT ON COLUMN public.pending_orders.payment_method IS 'Payment method used: fpx or manual';
