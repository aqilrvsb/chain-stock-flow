# Migration Summary - New Supabase Instance Setup

## Overview
This document summarizes the complete migration from Lovable Cloud to your new Supabase instance.

---

## What Was Done

### 1. Environment Configuration ✅
- Updated [.env](.env) with new Supabase credentials
- Updated [supabase/config.toml](supabase/config.toml) with new project ID

### 2. Database Schema ✅
Created comprehensive SQL setup script: [COMPLETE_DATABASE_SETUP.sql](COMPLETE_DATABASE_SETUP.sql)

**Features:**
- ✅ Safe to run multiple times (idempotent)
- ✅ Checks for existing objects before creating
- ✅ All 13 tables from Lovable Cloud
- ✅ All RLS policies exactly as in Lovable
- ✅ All triggers, functions, and indexes

### 3. Tables Migrated (13 Total)

| Table Name | Purpose | Policies |
|------------|---------|----------|
| **profiles** | User information & contact details | 5 |
| **user_roles** | Role assignments (HQ/Master/Agent) | 7 |
| **products** | Product catalog | 2 |
| **pricing_config** | Dynamic role-based pricing | 2 |
| **inventory** | User stock levels | 5 |
| **bundles** | Product bundle definitions | 2 |
| **transactions** | Transaction history | 4 |
| **pending_orders** | Payment processing queue | 4 |
| **agent_purchases** | Agent purchase orders | 5 |
| **master_agent_relationships** | Agent hierarchy | 4 |
| **stock_in_hq** | HQ stock receipt tracking | 2 |
| **rewards_config** | Monthly rewards config | 2 |
| **system_settings** | Application configuration | 2 |

### 4. Functions Created (4 Total)
- `has_role(user_id, role)` - Check if user has specific role
- `get_user_role(user_id)` - Get user's primary role
- `handle_new_user()` - Auto-create profile on signup
- `update_updated_at()` - Auto-update timestamps

### 5. Storage Setup
- **Bucket**: `product-images` (public)
- **Policies**: Manual setup required (see below)

---

## Files Created

| File | Purpose |
|------|---------|
| [COMPLETE_DATABASE_SETUP.sql](COMPLETE_DATABASE_SETUP.sql) | Complete database schema (run this first!) |
| [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql) | Storage policy instructions |
| [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) | Step-by-step setup guide |
| [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) | This file |

---

## Quick Start Guide

### Step 1: Run Database Setup (5 minutes)
1. Go to: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz/sql
2. Copy entire contents of [COMPLETE_DATABASE_SETUP.sql](COMPLETE_DATABASE_SETUP.sql)
3. Paste into SQL Editor
4. Run (Ctrl+Enter)
5. Wait for "Success"

### Step 2: Create Storage Policies (2 minutes)
**IMPORTANT:** Storage policies must be created manually via Dashboard

1. Go to: **Storage** > **product-images** > **Policies**
2. Create 2 policies (see [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql))

### Step 3: Create HQ User (1 minute)
1. Go to: **Authentication** > **Users**
2. Create new user
3. Assign HQ role via SQL:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'hq');
```

### Step 4: Test Locally
```bash
npm install
npm run dev
```

### Step 5: Deploy to Vercel
Update environment variables in Vercel dashboard and redeploy.

---

## Differences from Lovable Cloud

### What's the Same ✅
- All 13 tables with exact same structure
- All RLS policies matching Lovable
- All triggers and functions
- Role-based access control
- Payment integration structure

### What's Different ⚠️
- **Storage Policies**: Must be created manually (Lovable did this automatically)
- **Edge Functions**: Not deployed yet (optional, for payments)
- **Initial Data**: No seed data (you start fresh)

---

## RLS Policy Coverage

All tables have Row Level Security enabled with appropriate policies:

- **Profiles**: Users see own, HQ sees all, Masters see their agents
- **User Roles**: Role-based viewing and management
- **Products**: Public viewing, HQ management
- **Inventory**: Users see own, HQ and Masters see their scope
- **Transactions**: Users see own, visibility based on relationships
- **Bundles**: Public viewing, HQ management
- **Pending Orders**: Users see own, HQ sees all
- **Agent Purchases**: Agents see own, Masters manage their agents
- **Stock in HQ**: HQ only
- **Rewards**: Public viewing, HQ management
- **System Settings**: Public read, HQ write

---

## Missing from Migration (Optional)

These are NOT included but can be added if needed:

### Edge Functions
Located in `supabase/functions/`:
- create-user
- get-email-from-idstaff
- update-user-password
- bayarcash-payment
- bayarcash-callback
- billplz-payment
- check-payment-status

**Deploy with:**
```bash
npx supabase login
npx supabase link --project-ref rfjcdvaentqmpnuqymmz
npx supabase functions deploy [function-name]
```

### Seed Data
No initial products, users, or configuration data is included. Add via:
- Supabase Dashboard (manual entry)
- SQL INSERT statements
- Your application's admin interface

---

## Validation Checklist

After running the setup, verify:

- [ ] All 13 tables exist
- [ ] Can create HQ user
- [ ] Can assign roles
- [ ] Storage bucket exists
- [ ] Storage policies created
- [ ] Local app connects successfully
- [ ] Can login with HQ user
- [ ] HQ dashboard accessible
- [ ] Can create products
- [ ] Can create agents/master agents

---

## Support & Troubleshooting

### Common Issues

**Issue**: "type app_role already exists"
**Solution**: Script is idempotent - this is OK, it will skip and continue

**Issue**: "permission denied for table objects"
**Solution**: Storage policies need manual creation via Dashboard

**Issue**: "relation does not exist"
**Solution**: Ensure complete SQL script ran successfully

**Issue**: Edge Functions not working
**Solution**: These are optional - only needed for payment processing

---

## Next Steps After Setup

1. **Create Users**:
   - HQ admin account
   - Test master agent
   - Test agent

2. **Add Products**:
   - Create product catalog
   - Set pricing per role
   - Upload product images

3. **Configure Settings**:
   - System settings table
   - Payment gateway credentials (if using)
   - Rewards configuration

4. **Test Workflows**:
   - HQ → Master Agent purchase
   - Master Agent → Agent purchase
   - Inventory tracking
   - Transaction history

5. **Deploy to Production**:
   - Update Vercel environment variables
   - Redeploy application
   - Test production environment

---

## Database Backup

To backup your new database:
```bash
npx supabase db dump -f backup.sql
```

To restore:
```bash
psql -h db.rfjcdvaentqmpnuqymmz.supabase.co -U postgres < backup.sql
```

---

## Project Information

- **Old Instance**: Lovable Cloud (lwhdvkrdwdmuauxxhxsg)
- **New Instance**: Supabase (rfjcdvaentqmpnuqymmz)
- **Project URL**: https://rfjcdvaentqmpnuqymmz.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz

---

## Summary

Your complete Supabase setup is ready with:
- ✅ 13 Tables with full schema
- ✅ 46 RLS Policies for security
- ✅ 4 Helper Functions
- ✅ All Triggers & Indexes
- ✅ Storage Bucket configured
- ✅ Idempotent SQL script (safe to re-run)

**Time to Complete**: ~10 minutes
**Effort Level**: Low (mostly copy-paste)
**Risk Level**: Low (script checks for existing objects)

Ready to deploy! 🚀
