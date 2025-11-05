-- Add RLS policy to allow agents to view their own master_agent_relationship
-- This is needed so agents can find out which master agent they belong to

CREATE POLICY "Agents can view own relationship"
  ON public.master_agent_relationships FOR SELECT
  USING (auth.uid() = agent_id);

-- Verify all policies on master_agent_relationships
-- SELECT * FROM pg_policies WHERE tablename = 'master_agent_relationships';
