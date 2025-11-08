-- Allow master agents to insert inventory for their agents when approving purchases
CREATE POLICY "Master agents can insert inventory for their agents"
  ON public.inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND agent_id = inventory.user_id
    )
  );

-- Allow master agents to update inventory for their agents when approving purchases
CREATE POLICY "Master agents can update their agents inventory"
  ON public.inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.master_agent_relationships
      WHERE master_agent_id = auth.uid() AND agent_id = inventory.user_id
    )
  );
