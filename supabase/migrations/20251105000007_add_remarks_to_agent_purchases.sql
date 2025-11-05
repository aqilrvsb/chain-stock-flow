-- Add remarks column to agent_purchases table
-- This column is used to store additional notes or remarks about the purchase

ALTER TABLE public.agent_purchases
ADD COLUMN IF NOT EXISTS remarks TEXT;

COMMENT ON COLUMN public.agent_purchases.remarks IS 'Additional remarks or notes about the agent purchase';
