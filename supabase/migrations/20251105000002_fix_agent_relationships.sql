-- Fix existing agents that don't have master_agent_relationships
-- This will automatically create relationships for agents based on who created them

-- First, let's check the current state (run this first to see what's missing)
-- SELECT
--   p.id as agent_id,
--   p.email as agent_email,
--   p.idstaff as agent_idstaff,
--   ur.created_by as master_agent_id,
--   mar.id as existing_relationship
-- FROM profiles p
-- INNER JOIN user_roles ur ON ur.user_id = p.id
-- LEFT JOIN master_agent_relationships mar ON mar.agent_id = p.id
-- WHERE ur.role = 'agent';

-- Insert missing relationships
-- This creates relationships for agents that were created by master agents
-- but don't have a relationship record yet
INSERT INTO master_agent_relationships (agent_id, master_agent_id, created_at)
SELECT
  ur.user_id as agent_id,
  ur.created_by as master_agent_id,
  NOW() as created_at
FROM user_roles ur
LEFT JOIN master_agent_relationships mar ON mar.agent_id = ur.user_id
INNER JOIN user_roles creator_role ON creator_role.user_id = ur.created_by
WHERE ur.role = 'agent'
  AND mar.id IS NULL
  AND ur.created_by IS NOT NULL
  AND creator_role.role = 'master_agent'
ON CONFLICT (agent_id) DO NOTHING;

-- Verify the fix
SELECT
  p.email as agent_email,
  p.idstaff as agent_idstaff,
  p2.email as master_agent_email,
  p2.idstaff as master_agent_idstaff,
  mar.created_at
FROM master_agent_relationships mar
INNER JOIN profiles p ON p.id = mar.agent_id
INNER JOIN profiles p2 ON p2.id = mar.master_agent_id
ORDER BY mar.created_at DESC;
