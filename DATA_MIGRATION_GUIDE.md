# Data Migration Guide - From Lovable Cloud

## Overview
This guide will help you migrate all your data from Lovable Cloud to your new Supabase instance.

---

## Prerequisites ✅

Before running the data migration, ensure:
1. [x] Database schema is created ([COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql](COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql) has been run)
2. [x] Storage policies are created manually
3. [ ] Users are created in Authentication

---

## Step-by-Step Migration

### Step 1: Create Users in Authentication

**IMPORTANT**: You must create these 3 users via Supabase Dashboard first!

Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/auth/users

Click "Add user" for each:

#### User 1: HQ Admin
- **Email**: `hq@gmail.com`
- **Password**: (set a secure password)
- **User UID**: `455f37a3-9596-4812-bc26-be12345b9ffd`
- Auto Confirm User: ✓ (checked)

#### User 2: Master Agent
- **Email**: `aqil@gmail.com`
- **Password**: (set a secure password)
- **User UID**: `3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923`
- Auto Confirm User: ✓ (checked)

#### User 3: Agent
- **Email**: `em@gmail.com`
- **Password**: (set a secure password)
- **User UID**: `657c9f0b-6f3f-4ff0-874f-e7fd50810528`
- Auto Confirm User: ✓ (checked)

**How to set specific UUID:**
When creating user in Dashboard, you may not be able to set custom UUID. In that case:
1. Create users with any UUID
2. Note down the generated UUIDs
3. Edit [INSERT_DATA_FROM_LOVABLE.sql](INSERT_DATA_FROM_LOVABLE.sql) to replace all instances of the old UUIDs with new ones

---

### Step 2: Run Data Migration Script

After creating all 3 users:

1. Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/sql
2. Copy entire contents of [INSERT_DATA_FROM_LOVABLE.sql](INSERT_DATA_FROM_LOVABLE.sql)
3. Paste into SQL Editor
4. Run (Ctrl+Enter)

This will insert:
- ✓ 1 Product (Olive Oil)
- ✓ 3 User Profiles
- ✓ 3 User Roles
- ✓ 1 Master Agent → Agent relationship
- ✓ 1 Bundle
- ✓ 2 Inventory records
- ✓ 1 Stock in HQ
- ✓ 1 Transaction
- ✓ 5 Pending Orders
- ✓ 1 Reward Config
- ✓ 1 System Setting

---

### Step 3: Verify Data Migration

Run this verification query in SQL Editor:

```sql
-- Check all tables have data
SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'master_agent_relationships', COUNT(*) FROM master_agent_relationships
UNION ALL
SELECT 'bundles', COUNT(*) FROM bundles
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'stock_in_hq', COUNT(*) FROM stock_in_hq
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'pending_orders', COUNT(*) FROM pending_orders
UNION ALL
SELECT 'rewards_config', COUNT(*) FROM rewards_config
UNION ALL
SELECT 'system_settings', COUNT(*) FROM system_settings;
```

**Expected Results:**
```
products: 1
profiles: 3
user_roles: 3
master_agent_relationships: 1
bundles: 1
inventory: 2
stock_in_hq: 1
transactions: 1
pending_orders: 5
rewards_config: 1
system_settings: 1
```

---

### Step 4: Test Login

Test that you can login with each user:

1. **HQ User**: `hq@gmail.com`
   - Should see HQ dashboard
   - Can manage products, users, etc.

2. **Master Agent**: `aqil@gmail.com`
   - Should see Master Agent dashboard
   - Can see agent "em"
   - Has inventory of 324 units

3. **Agent**: `em@gmail.com`
   - Should see Agent dashboard
   - Assigned to Master Agent "aqil"

---

## Alternative: If You Can't Set Custom UUIDs

If Supabase doesn't allow custom UUIDs during user creation:

### Option A: Create Users and Update Script

1. Create the 3 users (Supabase will generate UUIDs)
2. Note down the generated UUIDs from Authentication page
3. Use Find & Replace in [INSERT_DATA_FROM_LOVABLE.sql](INSERT_DATA_FROM_LOVABLE.sql):

```
Find: 455f37a3-9596-4812-bc26-be12345b9ffd
Replace: [NEW_HQ_UUID]

Find: 3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923
Replace: [NEW_MASTER_AGENT_UUID]

Find: 657c9f0b-6f3f-4ff0-874f-e7fd50810528
Replace: [NEW_AGENT_UUID]
```

4. Save and run the modified script

### Option B: Use API to Create Users with Specific UUIDs

Use this SQL to create users with specific UUIDs (requires service role key):

```sql
-- This needs to be run with service role privileges
-- Use Supabase CLI or API, not SQL Editor

-- HQ User
SELECT auth.admin_create_user(
  '{"email":"hq@gmail.com","password":"YourPassword123!","email_confirm":true}',
  '455f37a3-9596-4812-bc26-be12345b9ffd'::uuid
);

-- Master Agent
SELECT auth.admin_create_user(
  '{"email":"aqil@gmail.com","password":"YourPassword123!","email_confirm":true}',
  '3fe50999-ecc2-4ba9-b1f2-c6b4b1fb3923'::uuid
);

-- Agent
SELECT auth.admin_create_user(
  '{"email":"em@gmail.com","password":"YourPassword123!","email_confirm":true}',
  '657c9f0b-6f3f-4ff0-874f-e7fd50810528'::uuid
);
```

---

## Data Summary

### Products
| Name | SKU | Base Cost | Stock (HQ) |
|------|-----|-----------|------------|
| Olive Oil | OLO | RM 25.00 | 400 units |

### Users
| Email | Role | Staff ID | Inventory |
|-------|------|----------|-----------|
| hq@gmail.com | HQ | OJHQ | 400 units |
| aqil@gmail.com | Master Agent | MA-001 | 324 units |
| em@gmail.com | Agent | - | 0 units |

### Relationships
- **Master Agent** (aqil@gmail.com) manages **Agent** (em@gmail.com)

### Bundles
- **1 Caton Olive Oil**: 12 units
  - Master Agent Price: RM 60
  - Agent Price: RM 70

### Pending Orders
- 5 orders from Master Agent (aqil@gmail.com)
- Total: RM 300 (5 × 12 units × RM 60)
- 2 failed, 3 pending

---

## Troubleshooting

### Error: "violates foreign key constraint"
**Solution**: Make sure users are created in Authentication first

### Error: "duplicate key value violates unique constraint"
**Solution**: Data already exists. Script uses `ON CONFLICT` so it should update, but you can manually delete and re-run

### Error: "relation does not exist"
**Solution**: Run [COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql](COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql) first

### Users can't login
**Solution**:
1. Check users exist in Authentication
2. Check user_roles are assigned
3. Check "Auto Confirm User" was enabled

---

## Migration Checklist

- [ ] Database schema created
- [ ] Storage policies created
- [ ] Created user: hq@gmail.com
- [ ] Created user: aqil@gmail.com
- [ ] Created user: em@gmail.com
- [ ] Ran data migration script
- [ ] Verified data counts
- [ ] Tested login with HQ user
- [ ] Tested login with Master Agent
- [ ] Tested login with Agent
- [ ] Checked inventory displays correctly
- [ ] Checked relationships work

---

## Next Steps After Migration

1. **Upload Product Images**
   - Current image URL points to old Supabase
   - Re-upload to new instance's storage

2. **Update System Settings**
   - Logo and other configurations

3. **Test All Features**
   - Create new product
   - Create new order
   - Process transaction
   - Check reports

4. **Deploy to Production**
   - Update Vercel environment variables
   - Redeploy application

---

## Files Reference

- [INSERT_DATA_FROM_LOVABLE.sql](INSERT_DATA_FROM_LOVABLE.sql) - Main data migration script
- [COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql](COMPLETE_DATABASE_SETUP_WITH_ALL_POLICIES.sql) - Database schema
- [CONNECTION_UPDATE_SUMMARY.md](CONNECTION_UPDATE_SUMMARY.md) - Connection details

---

**Ready to migrate!** Follow the steps above carefully. 🚀
