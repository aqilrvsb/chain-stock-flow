-- =====================================================
-- Migration: Add WooCommerce Webhook Support
-- Date: 2025-12-15
-- Description: Add webhook logs and woo_order_id column
-- Note: No woo_config table needed - idstaff is used as webhook secret
-- =====================================================

-- Add webhook_logs table to track all webhook requests (for debugging)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type TEXT NOT NULL, -- 'woocommerce', 'ninjavan', etc.
  request_method TEXT,
  request_body JSONB,
  request_headers JSONB,
  profile_id UUID REFERENCES public.profiles(id),
  order_id UUID REFERENCES public.customer_purchases(id),
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own webhook_logs" ON public.webhook_logs
  FOR SELECT USING (profile_id = auth.uid());

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_profile_id ON public.webhook_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_type ON public.webhook_logs(webhook_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Add woo_order_id column to customer_purchases for tracking WooCommerce orders
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS woo_order_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_customer_purchases_woo_order_id ON public.customer_purchases(woo_order_id);

-- Comment on tables
COMMENT ON TABLE public.webhook_logs IS 'Log all webhook requests for debugging';
COMMENT ON COLUMN public.customer_purchases.woo_order_id IS 'WooCommerce order ID for orders created via webhook';
