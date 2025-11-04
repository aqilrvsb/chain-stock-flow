# Quick Start - 3 Steps to Setup

## ⚡ Fast Track Setup (10 Minutes)

### Step 1️⃣: Run Database Script
1. Open: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz/sql
2. Copy ALL of [COMPLETE_DATABASE_SETUP.sql](COMPLETE_DATABASE_SETUP.sql)
3. Paste & Run (Ctrl+Enter)
4. ✅ Wait for "Success"

### Step 2️⃣: Create Storage Policies (Manual)
Go to: **Storage** > **product-images** > **Policies** > **New Policy**

**Policy 1:**
```
Name: HQ can upload product images
Operation: INSERT
Roles: authenticated
Definition: bucket_id = 'product-images' AND (SELECT has_role(auth.uid(), 'hq'::app_role))
```

**Policy 2:**
```
Name: Anyone can view product images
Operation: SELECT
Roles: public
Definition: bucket_id = 'product-images'
```

### Step 3️⃣: Create HQ User
1. Go to: **Authentication** > **Users** > **Add user**
2. Enter email & password
3. Enable "Auto Confirm User"
4. Copy the User ID
5. Go to SQL Editor and run:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('PASTE_USER_ID_HERE', 'hq');
```

---

## ✅ Verification

Test your setup:
```bash
cd c:\Users\aqilz\Documents\chain-stock-flow-main
npm install
npm run dev
```

Login with your HQ user credentials!

---

## 📋 What You Get

- ✅ 13 Database Tables
- ✅ 46 RLS Security Policies
- ✅ 4 Helper Functions
- ✅ All Triggers & Indexes
- ✅ Storage Bucket
- ✅ Complete Role-Based Access Control

---

## 🔗 Important Links

- **Dashboard**: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz
- **SQL Editor**: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz/sql
- **Storage**: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz/storage
- **Auth**: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz/auth

---

## 📚 Full Documentation

- [COMPLETE_DATABASE_SETUP.sql](COMPLETE_DATABASE_SETUP.sql) - Complete SQL script
- [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) - Detailed guide
- [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - Full migration details
- [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql) - Storage policy guide

---

## 🆘 Need Help?

**Common Issue**: Storage policy error in SQL
**Solution**: Storage policies MUST be created via Dashboard (not SQL)

**Common Issue**: Can't login
**Solution**: Make sure you assigned 'hq' role to your user

**Common Issue**: "type already exists"
**Solution**: This is OK! Script is safe to re-run

---

That's it! Your Supabase is ready! 🎉
