-- =====================================================
-- Migration: Add Sale ID Sequence and Function
-- Date: 2025-12-15
-- Description: Generate incremental Sale IDs (OJ00001, OJ00002, etc.)
-- Similar to marketerpro-suite's DFR00001 pattern
-- =====================================================

-- Create sequence for Sale IDs (starting from 1)
CREATE SEQUENCE IF NOT EXISTS public.sale_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Grant usage on sequence to authenticated users
GRANT USAGE ON SEQUENCE public.sale_id_seq TO authenticated;

-- Add id_sale column to customer_purchases
ALTER TABLE public.customer_purchases ADD COLUMN IF NOT EXISTS id_sale text;

-- Create index on id_sale
CREATE INDEX IF NOT EXISTS idx_customer_purchases_id_sale ON public.customer_purchases(id_sale);

-- Comment on column
COMMENT ON COLUMN public.customer_purchases.id_sale IS 'Unique Sale ID for NinjaVan tracking (OJ00001, OJ00002, etc.)';

-- Create function to generate Sale ID
-- Pattern: OJ + 5 digit padded number (e.g., OJ00001, OJ00002)
-- Max 9 characters for NinjaVan API compatibility
CREATE OR REPLACE FUNCTION public.generate_sale_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  SELECT nextval('public.sale_id_seq') INTO next_val;
  RETURN 'OJ' || LPAD(next_val::TEXT, 5, '0');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_sale_id() TO authenticated;
