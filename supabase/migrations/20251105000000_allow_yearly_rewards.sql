-- Allow month = 0 for yearly rewards
-- Drop the existing check constraint
ALTER TABLE public.rewards_config
DROP CONSTRAINT IF EXISTS rewards_config_month_check;

-- Add updated check constraint that allows month = 0 for yearly rewards
ALTER TABLE public.rewards_config
ADD CONSTRAINT rewards_config_month_check CHECK (month >= 0 AND month <= 12);

-- Update the table comment to reflect new behavior
COMMENT ON COLUMN public.rewards_config.month IS 'Month of the reward (1-12 for monthly, 0 for yearly)';
