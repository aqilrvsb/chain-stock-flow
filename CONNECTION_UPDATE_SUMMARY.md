# Supabase Connection Update Summary

## ✅ Configuration Updated

Your project has been successfully configured to connect to the new Supabase instance.

---

## Changes Made

### 1. Environment Variables Updated ✅
**File**: [.env](.env)

```
OLD: https://rfjcdvaentqmpnuqymmz.supabase.co
NEW: https://nzjolxsloobsoqltkpmi.supabase.co
```

- `VITE_SUPABASE_PROJECT_ID`: Updated to `nzjolxsloobsoqltkpmi`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Updated to new anon key
- `VITE_SUPABASE_URL`: Updated to new URL

### 2. Supabase Config Updated ✅
**File**: [supabase/config.toml](supabase/config.toml)

- `project_id`: Updated to `nzjolxsloobsoqltkpmi`

---

## New Instance Details

| Item | Value |
|------|-------|
| **Project URL** | https://nzjolxsloobsoqltkpmi.supabase.co |
| **Project ID** | nzjolxsloobsoqltkpmi |
| **Dashboard** | https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi |
| **Anon Key** | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| **Service Role Key** | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (keep secure!) |

---

## Next Steps

### 1. Run Database Setup Script ⏳

**IMPORTANT**: You need to run the complete database setup on your new instance!

1. Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/sql
2. Copy entire [COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql](COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql)
3. Paste into SQL Editor
4. Run (Ctrl+Enter)

This will create:
- ✅ All 13 tables
- ✅ All 46 RLS policies
- ✅ All functions, triggers, indexes
- ✅ Storage bucket

### 2. Create Storage Policies Manually ⏳

Go to: **Storage** > **product-images** > **Policies**

Create 2 policies (see [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql)):

**Policy 1: HQ can upload product images**
```sql
bucket_id = 'product-images' AND (SELECT has_role(auth.uid(), 'hq'::app_role))
```

**Policy 2: Anyone can view product images**
```sql
bucket_id = 'product-images'
```

### 3. Create Your First HQ User ⏳

1. Go to: **Authentication** > **Users** > **Add user**
2. Create admin user
3. Assign HQ role:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'hq');
```

### 4. Test Locally ⏳

```bash
npm install
npm run dev
```

Login with your HQ user!

### 5. Update Vercel (Production) ⏳

Update these environment variables in Vercel:

```
VITE_SUPABASE_PROJECT_ID=nzjolxsloobsoqltkpmi
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjg1MDYsImV4cCI6MjA3Nzg0NDUwNn0.YECuzY93-TW03PZEoz5hDvsdUCCSygIZTlcYmNL_pMk
VITE_SUPABASE_URL=https://nzjolxsloobsoqltkpmi.supabase.co
```

Then redeploy.

---

## Instance Comparison

| Feature | Old (Lovable) | New (Your Supabase) |
|---------|--------------|---------------------|
| URL | lwhdvkrdwdmuauxxhxsg | **nzjolxsloobsoqltkpmi** |
| Status | ❌ Old/Deprecated | ✅ **Active** |
| Database | Needs migration | ⏳ **Ready to setup** |
| Control | Limited | ✅ **Full control** |

---

## Migration Checklist

- [x] Update .env file
- [x] Update config.toml
- [ ] Run database setup script
- [ ] Create storage policies
- [ ] Create HQ user
- [ ] Test locally
- [ ] Update Vercel environment
- [ ] Deploy to production

---

## Important Notes

### Service Role Key Security ⚠️
Your service role key:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56am9seHNsb29ic29xbHRrcG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2ODUwNiwiZXhwIjoyMDc3ODQ0NTA2fQ.A8DPl2DCsTmrdtBB-UZgX9J-0Czr1r3kfw1hW0O6IKc
```

**NEVER expose this key in:**
- Frontend code
- Git repositories
- Public documentation
- Browser console

**Only use in:**
- Backend/server code
- Edge Functions
- Secure environment variables

### Database State
Your new instance is **completely empty**. You must:
1. Run the setup script first
2. Then create users and data

### Previous Instance
The old Lovable Cloud instance (`lwhdvkrdwdmuauxxhxsg`) is no longer connected. You can safely ignore or delete it.

---

## Quick Reference

### Dashboard Links
- **Main Dashboard**: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi
- **SQL Editor**: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/sql
- **Storage**: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/storage
- **Authentication**: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/auth
- **Database**: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/database

### Setup Files
- **Main Setup**: [COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql](COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql)
- **Storage Policies**: [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **Full Instructions**: [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

---

## Summary

✅ **Configuration**: Complete
⏳ **Database Setup**: Pending (run SQL script)
⏳ **Testing**: Pending
⏳ **Production Deploy**: Pending

Your application is now pointing to the new Supabase instance. Complete the database setup and you're ready to go!

---

**Ready to proceed!** Follow the checklist above to complete the migration. 🚀
