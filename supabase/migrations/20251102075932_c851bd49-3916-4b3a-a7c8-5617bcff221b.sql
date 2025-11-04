-- Add month and year columns to rewards_config table
ALTER TABLE public.rewards_config
ADD COLUMN month integer NOT NULL DEFAULT 1,
ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;

-- Add check constraints
ALTER TABLE public.rewards_config
ADD CONSTRAINT rewards_config_month_check CHECK (month >= 1 AND month <= 12);

-- Create index for filtering by year
CREATE INDEX idx_rewards_config_year ON public.rewards_config(year);

-- Update the table comment
COMMENT ON COLUMN public.rewards_config.month IS 'Month of the reward (1-12)';
COMMENT ON COLUMN public.rewards_config.year IS 'Year of the reward';