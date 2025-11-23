-- Add customer segment toggle setting
-- This allows HQ to enable/disable customer-related features across the entire platform

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'customer_segment_enabled',
  'true',
  'Enable or disable customer segment features across all roles'
)
ON CONFLICT (setting_key) DO NOTHING;
