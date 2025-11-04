-- Allow HQ to view all profiles
CREATE POLICY "HQ can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hq'::app_role));

-- Allow HQ to update all profiles (for managing active/inactive status)
CREATE POLICY "HQ can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'hq'::app_role));

-- Allow master agents to view their agents' profiles
CREATE POLICY "Master agents can view their agents profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM master_agent_relationships
    WHERE master_agent_relationships.master_agent_id = auth.uid()
    AND master_agent_relationships.agent_id = profiles.id
  )
);