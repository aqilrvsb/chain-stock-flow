-- Create pending_orders table to track payment processing
CREATE TABLE IF NOT EXISTS public.pending_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending orders
CREATE POLICY "Users can view own pending orders"
ON public.pending_orders
FOR SELECT
USING (auth.uid() = buyer_id);

-- HQ can view all pending orders
CREATE POLICY "HQ can view all pending orders"
ON public.pending_orders
FOR SELECT
USING (has_role(auth.uid(), 'hq'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_pending_orders_order_number ON public.pending_orders(order_number);
CREATE INDEX idx_pending_orders_status ON public.pending_orders(status);

-- Add trigger for updated_at
CREATE TRIGGER update_pending_orders_updated_at
BEFORE UPDATE ON public.pending_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();