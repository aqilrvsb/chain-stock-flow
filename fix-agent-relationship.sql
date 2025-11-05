-- Fix existing agents that don't have master_agent_relationships
-- This script finds agents created by master agents and creates the missing relationships

-- First, let's see which agents are missing relationships
-- SELECT
--   ur.user_id as agent_id,
--   ur.created_by as master_agent_id,
--   p.email as agent_email,
--   p.idstaff as agent_idstaff
-- FROM user_roles ur
-- LEFT JOIN master_agent_relationships mar ON mar.agent_id = ur.user_id
-- LEFT JOIN profiles p ON p.id = ur.user_id
-- WHERE ur.role = 'agent'
--   AND mar.id IS NULL
--   AND ur.created_by IS NOT NULL;

-- Insert missing relationships
-- This will automatically create relationships for agents that were created by master agents
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
