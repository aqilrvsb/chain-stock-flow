-- ============================================================================
-- MIGRATION: Add NinjaVan configuration tables
-- Date: 2025-12-10
-- Description: Tables for NinjaVan API configuration and OAuth tokens
-- ============================================================================

-- Create ninjavan_config table (stores API credentials and sender info per branch)
CREATE TABLE IF NOT EXISTS public.ninjavan_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  sender_email text NOT NULL,
  sender_address1 text NOT NULL,
  sender_address2 text,
  sender_postcode text NOT NULL,
  sender_city text NOT NULL,
  sender_state text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ninjavan_config_pkey PRIMARY KEY (id),
  CONSTRAINT ninjavan_config_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT ninjavan_config_profile_id_unique UNIQUE (profile_id)
);

-- Create ninjavan_tokens table (stores OAuth tokens for reuse)
CREATE TABLE IF NOT EXISTS public.ninjavan_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  access_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ninjavan_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT ninjavan_tokens_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_ninjavan_tokens_profile_expires
ON public.ninjavan_tokens(profile_id, expires_at DESC);

-- Add RLS policies for ninjavan_config
ALTER TABLE public.ninjavan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ninjavan config"
ON public.ninjavan_config FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own ninjavan config"
ON public.ninjavan_config FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own ninjavan config"
ON public.ninjavan_config FOR UPDATE
USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own ninjavan config"
ON public.ninjavan_config FOR DELETE
USING (auth.uid() = profile_id);

-- Add RLS policies for ninjavan_tokens
ALTER TABLE public.ninjavan_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ninjavan tokens"
ON public.ninjavan_tokens FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own ninjavan tokens"
ON public.ninjavan_tokens FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own ninjavan tokens"
ON public.ninjavan_tokens FOR DELETE
USING (auth.uid() = profile_id);

-- Add ninjavan_tracking_id column to customer_purchases for tracking NinjaVan orders
ALTER TABLE public.customer_purchases
ADD COLUMN IF NOT EXISTS ninjavan_order_id text;

-- ============================================================================
-- DONE!
-- ============================================================================
