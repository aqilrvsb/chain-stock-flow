-- Create stock_out_hq table for tracking HQ stock removals
CREATE TABLE public.stock_out_hq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_out_hq ENABLE ROW LEVEL SECURITY;

-- HQ can view all stock out records
CREATE POLICY "HQ can view all stock out records"
ON public.stock_out_hq
FOR SELECT
USING (has_role(auth.uid(), 'hq'::app_role));

-- HQ can insert stock out records
CREATE POLICY "HQ can insert stock out records"
ON public.stock_out_hq
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'hq'::app_role) AND auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_stock_out_hq_date ON public.stock_out_hq(date);
CREATE INDEX idx_stock_out_hq_product ON public.stock_out_hq(product_id);
CREATE INDEX idx_stock_out_hq_user ON public.stock_out_hq(user_id);
