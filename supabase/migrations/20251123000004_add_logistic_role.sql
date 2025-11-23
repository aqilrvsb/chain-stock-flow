-- Add 'logistic' to app_role enum
-- This must be in a separate migration from using the value
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'logistic';
