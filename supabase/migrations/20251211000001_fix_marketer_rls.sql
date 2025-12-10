-- =====================================================
-- Migration: Fix Marketer RLS Policies
-- =====================================================
-- Add policy for Branch to view their marketers' profiles
-- =====================================================

-- Allow Branch users to view marketers under their branch
CREATE POLICY "Branch can view marketers under their branch" ON profiles
  FOR SELECT USING (
    branch_id = auth.uid()
  );

-- Allow Branch users to update marketers under their branch (for is_active toggle)
CREATE POLICY "Branch can update marketers under their branch" ON profiles
  FOR UPDATE USING (
    branch_id = auth.uid()
  );
