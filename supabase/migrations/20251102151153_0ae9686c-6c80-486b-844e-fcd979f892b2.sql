-- Add transaction_id column to pending_orders to store BayarCash payment intent ID
ALTER TABLE public.pending_orders 
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_orders_transaction_id 
ON public.pending_orders(transaction_id);