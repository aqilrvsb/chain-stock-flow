-- ============================================================
-- CREATE UPSERT SYSTEM SETTING FUNCTION
-- Chain Stock Flow - Helper Function
-- ============================================================
--
-- This function allows HQ to update system_settings safely
-- Used by the Settings page for Billplz configuration
--
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_system_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.system_settings (setting_key, setting_value, created_at, updated_at)
  VALUES (p_key, p_value, NOW(), NOW())
  ON CONFLICT (setting_key)
  DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_system_setting(TEXT, TEXT) TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test the function:
SELECT public.upsert_system_setting('test_key', 'test_value');

-- Verify it was created:
SELECT setting_key, setting_value
FROM public.system_settings
WHERE setting_key = 'test_key';

-- Clean up test:
DELETE FROM public.system_settings WHERE setting_key = 'test_key';

-- ============================================================
