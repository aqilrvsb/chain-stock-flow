-- Create bundles table for HQ to manage product bundles with pricing
CREATE TABLE IF NOT EXISTS public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units INTEGER NOT NULL DEFAULT 1,
  master_agent_price NUMERIC NOT NULL,
  agent_price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;

-- HQ can manage bundles
CREATE POLICY "HQ can manage bundles"
ON public.bundles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'hq'::app_role));

-- Authenticated users can view active bundles
CREATE POLICY "Authenticated users can view active bundles"
ON public.bundles
FOR SELECT
TO authenticated
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_bundles_updated_at
BEFORE UPDATE ON public.bundles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();