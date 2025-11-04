-- ============================================================
-- CREATE USERS WITH SPECIFIC UUIDs
-- Using Supabase Admin API
-- ============================================================
--
-- IMPORTANT: This script must be run with SERVICE ROLE privileges
-- You need to use the service role key, not the anon key
--
-- Run this via API or Edge Function, NOT via SQL Editor
-- ============================================================

-- This is a REFERENCE for creating users via API
-- You'll need to use curl, Postman, or similar tool

-- ============================================================
-- METHOD 1: Using curl (Command Line)
-- ============================================================

-- User 1: HQ (hq@gmail.com)
curl -X POST 'https://nzjolxsloobsoqltkpmi.supabase.co/auth/v1/admin/users' \
-H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Content-Type: application/json" \
-d '{
  "id": "455f37a3-9596-4812-bc26-be12345b9ffd",
  "email": "hq@gmail.com",
  "password": "YourSecurePassword123!",
  "email_confirm": true,
  "user_metadata": {
    "full_name": ""
  }
}'

-- User 2: Master Agent (aqil@gmail.com)
curl -X POST 'https://nzjolxsloobsoqltkpmi.supabase.co/auth/v1/admin/users' \
-H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Content-Type: application/json" \
-d '{
  "id": "3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923",
  "email": "aqil@gmail.com",
  "password": "YourSecurePassword123!",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "MA-aqil"
  }
}'

-- User 3: Agent (em@gmail.com)
curl -X POST 'https://nzjolxsloobsoqltkpmi.supabase.co/auth/v1/admin/users' \
-H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc" \
-H "Content-Type: application/json" \
-d '{
  "id": "657c9f0b-6f3f-4ff0-874f-e7fd50810528",
  "email": "em@gmail.com",
  "password": "YourSecurePassword123!",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "em"
  }
}'

-- ============================================================
-- After running the above curl commands, run this SQL to verify:
-- ============================================================

SELECT id, email, created_at
FROM auth.users
WHERE email IN ('hq@gmail.com', 'aqil@gmail.com', 'em@gmail.com')
ORDER BY email;

-- ============================================================
