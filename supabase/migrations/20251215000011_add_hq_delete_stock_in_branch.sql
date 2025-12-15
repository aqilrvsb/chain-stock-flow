-- Add HQ delete policy for stock_in_branch table
-- This allows HQ to delete stock_in_branch records when deleting related stock_out_hq records

DROP POLICY IF EXISTS "HQ can delete stock_in_branch" ON public.stock_in_branch;

CREATE POLICY "HQ can delete stock_in_branch" ON public.stock_in_branch
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hq')
  );
