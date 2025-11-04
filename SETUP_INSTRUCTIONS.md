# Complete Supabase Setup Instructions
## Chain Stock Flow - New Instance Setup

This guide will help you set up your new Supabase instance from scratch.

---

## Prerequisites

- New Supabase project URL: `https://rfjcdvaentqmpnuqymmz.supabase.co`
- Service role key (keep this secure!)
- Supabase dashboard access

---

## Step 1: Run Database Setup Script

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/rfjcdvaentqmpnuqymmz

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Complete Setup Script**
   - Open the file: `COMPLETE_DATABASE_SETUP.sql`
   - Select ALL contents (Ctrl+A)
   - Copy (Ctrl+C)
   - Paste into Supabase SQL Editor (Ctrl+V)

4. **Run the Script**
   - Click "Run" or press Ctrl+Enter
   - Wait for completion (should take 10-30 seconds)
   - You should see "Success. No rows returned"

**What this creates:**
- 13 database tables with proper relationships
- All Row Level Security (RLS) policies
- 4 helper functions
- All triggers for automation
- Indexes for performance
- 1 storage bucket (product-images)

---

## Step 2: Verify Database Setup

Run this verification query in SQL Editor:

```sql
-- Check if all tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**You should see these tables:**
- agent_purchases
- bundles
- inventory
- master_agent_relationships
- pending_orders
- pricing_config
- products
- profiles
- rewards_config
- stock_in_hq
- system_settings
- transactions
- user_roles

---

## Step 3: Create Your First HQ User

### Option A: Using Supabase Dashboard

1. Go to **Authentication** > **Users**
2. Click "Add user" > "Create new user"
3. Fill in:
   - Email: your-admin@email.com
   - Password: (create a strong password)
   - Auto Confirm User: ✓ (checked)
4. Click "Create user"
5. Copy the User ID (UUID)

### Option B: Using SQL

```sql
-- This will be done automatically when you sign up through your app
-- The trigger will create the profile automatically
```

### Assign HQ Role

After creating the user, run this in SQL Editor (replace USER_ID with actual UUID):

```sql
-- Insert HQ role for your admin user
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'hq');
```

---

## Step 4: Configure Environment Variables (ALREADY DONE ✓)

Your local `.env` file has been updated with:
```
VITE_SUPABASE_PROJECT_ID="rfjcdvaentqmpnuqymmz"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://rfjcdvaentqmpnuqymmz.supabase.co"
```

---

## Step 5: Deploy Edge Functions (Optional - For Payment Processing)

Your project has 7 Edge Functions that need to be deployed:

### Functions to Deploy:
1. **create-user** - HQ user provisioning
2. **get-email-from-idstaff** - Staff ID lookup
3. **update-user-password** - Password management
4. **bayarcash-payment** - BayarCash payment initiation
5. **bayarcash-callback** - BayarCash webhook handler
6. **billplz-payment** - Billplz payment initiation
7. **check-payment-status** - Payment status polling

### Deployment Methods:

#### Method 1: Using Supabase CLI (Recommended)

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref rfjcdvaentqmpnuqymmz

# Deploy all functions
npx supabase functions deploy create-user
npx supabase functions deploy get-email-from-idstaff
npx supabase functions deploy update-user-password
npx supabase functions deploy bayarcash-payment
npx supabase functions deploy bayarcash-callback
npx supabase functions deploy billplz-payment
npx supabase functions deploy check-payment-status
```

#### Method 2: Manual Deployment via Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. For each function:
   - Click "Create a new function"
   - Copy code from `supabase/functions/[function-name]/index.ts`
   - Paste into the editor
   - Click "Deploy"

### Set Environment Variables for Edge Functions

Go to **Edge Functions** > **Settings** and add:

```
BAYARCASH_API_TOKEN=your_bayarcash_token
BAYARCASH_PORTAL_KEY=your_bayarcash_portal_key
BILLPLZ_API_KEY=your_billplz_key
BILLPLZ_COLLECTION_ID=your_collection_id
```

---

## Step 6: Configure Storage Bucket

The storage bucket has been created, but **policies must be created manually**:

### 6.1 Verify Bucket Exists
1. Go to **Storage** in Supabase dashboard
2. You should see bucket: `product-images`
3. It should be set to **Public** access

### 6.2 Create Storage Policies Manually

**IMPORTANT:** Storage policies cannot be created via SQL due to permissions.

Go to: **Storage** > **product-images** > **Policies** > **New Policy**

**Policy 1: HQ can upload product images**
- Policy name: `HQ can upload product images`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- Policy definition:
  ```sql
  bucket_id = 'product-images' AND (SELECT has_role(auth.uid(), 'hq'::app_role))
  ```

**Policy 2: Anyone can view product images**
- Policy name: `Anyone can view product images`
- Allowed operation: `SELECT`
- Target roles: `public`
- Policy definition:
  ```sql
  bucket_id = 'product-images'
  ```

See [STORAGE_POLICIES_MANUAL.sql](STORAGE_POLICIES_MANUAL.sql) for detailed instructions.

---

## Step 7: Test Your Setup

### Test Database Connection

Run your development server:

```bash
npm install
npm run dev
```

### Test Authentication

1. Try to sign up/login with your HQ user
2. Verify you can access the HQ dashboard

### Test Data Entry

Try creating:
- A product
- A master agent user
- An agent user
- Check inventory

---

## Step 8: Deploy to Vercel (Production)

### Update Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Update these variables:

```
VITE_SUPABASE_PROJECT_ID=rfjcdvaentqmpnuqymmz
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://rfjcdvaentqmpnuqymmz.supabase.co
```

4. **Redeploy** your Vercel project

```bash
# If using Vercel CLI
vercel --prod
```

---

## Troubleshooting

### Issue: "relation does not exist"
**Solution:** Make sure you ran the complete SQL setup script

### Issue: "permission denied for table"
**Solution:** Check RLS policies are enabled and user has correct role

### Issue: Edge Functions not working
**Solution:**
1. Verify function is deployed
2. Check environment variables are set
3. Look at function logs in dashboard

### Issue: Storage upload fails
**Solution:**
1. Verify bucket exists and is public
2. Check user has HQ role
3. Verify storage policies exist

---

## Database Schema Overview

### Core Tables:

1. **profiles** - User information
2. **user_roles** - Role assignments (hq/master_agent/agent)
3. **products** - Product catalog
4. **pricing_config** - Role-based pricing
5. **inventory** - Stock levels per user
6. **bundles** - Product bundle definitions
7. **transactions** - Transaction history
8. **pending_orders** - Payment processing queue
9. **agent_purchases** - Agent purchase orders
10. **master_agent_relationships** - Agent hierarchy
11. **stock_in_hq** - HQ stock receipt log
12. **rewards_config** - Rewards configuration
13. **system_settings** - Application configuration

### Access Control:

- **HQ**: Full access to all data
- **Master Agent**: View/manage their assigned agents
- **Agent**: View only their own data

---

## Next Steps

1. ✓ Database setup complete
2. ✓ Environment variables updated
3. ⏳ Deploy Edge Functions (if using payments)
4. ⏳ Create initial HQ user
5. ⏳ Test locally
6. ⏳ Deploy to Vercel

---

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard > Logs
2. Check browser console for errors
3. Verify all steps were completed in order
4. Check RLS policies are not blocking access

---

## Security Checklist

- [ ] Service role key is kept secure (not in frontend code)
- [ ] RLS is enabled on all tables
- [ ] Storage bucket has proper access policies
- [ ] Edge Function environment variables are set
- [ ] HQ user password is strong
- [ ] Production environment variables are updated in Vercel

---

**Setup Complete! Your new Supabase instance is ready to use.**
