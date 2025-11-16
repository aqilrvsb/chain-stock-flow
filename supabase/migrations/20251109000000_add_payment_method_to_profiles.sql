-- Add payment_method column to profiles table for Master Agents
-- Values: 'fpx_only' (default) or 'fpx_manual'
ALTER TABLE public.profiles
ADD COLUMN payment_method text DEFAULT 'fpx_only' CHECK (payment_method IN ('fpx_only', 'fpx_manual'));

COMMENT ON COLUMN public.profiles.payment_method IS 'Payment method for Master Agent purchases: fpx_only or fpx_manual';
