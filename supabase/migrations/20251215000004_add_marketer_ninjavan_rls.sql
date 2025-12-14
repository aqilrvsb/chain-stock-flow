-- Allow marketers to read their branch's NinjaVan config
-- Marketers need this to create orders via NinjaVan

CREATE POLICY "Marketers can view their branch ninjavan config"
ON public.ninjavan_config FOR SELECT
USING (
  -- Allow if the profile_id matches the marketer's branch_id
  profile_id IN (
    SELECT branch_id FROM public.profiles WHERE id = auth.uid() AND branch_id IS NOT NULL
  )
  OR
  -- Also allow if created_by in user_roles points to this profile
  profile_id IN (
    SELECT created_by FROM public.user_roles WHERE user_id = auth.uid() AND role = 'marketer'
  )
);
