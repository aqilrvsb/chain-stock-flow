-- Add missing columns to agent_purchases table
-- These columns are used by the agent purchase flow but were missing from the schema

-- Add bundle_id to track which bundle was purchased
ALTER TABLE public.agent_purchases
ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE;

-- Add bank/payment information columns
ALTER TABLE public.agent_purchases
ADD COLUMN IF NOT EXISTS bank_holder_name TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS receipt_date DATE,
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN public.agent_purchases.bundle_id IS 'Reference to the bundle being purchased';
COMMENT ON COLUMN public.agent_purchases.bank_holder_name IS 'Name on the bank account used for payment';
COMMENT ON COLUMN public.agent_purchases.bank_name IS 'Name of the bank used for payment';
COMMENT ON COLUMN public.agent_purchases.receipt_date IS 'Date shown on the payment receipt';
COMMENT ON COLUMN public.agent_purchases.receipt_image_url IS 'URL to the uploaded payment receipt image in storage';
