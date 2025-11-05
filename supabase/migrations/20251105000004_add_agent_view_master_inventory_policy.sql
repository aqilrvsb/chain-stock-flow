-- Add RLS policy to allow agents to view their master agent's inventory
-- This is needed so agents can check if their master agent has stock before purchasing

CREATE POLICY "Agents can view their master agent inventory"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE agent_id = auth.uid() AND master_agent_id = inventory.user_id
    )
  );

-- Verify all policies on inventory
-- SELECT * FROM pg_policies WHERE tablename = 'inventory';
