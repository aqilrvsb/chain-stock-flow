# Fix Billplz Edge Function 500 Error

## Problem
Edge function returns error: `{"error":"Billplz not configured. Please contact administrator."}`

## Root Cause
The `billplz-payment` edge function requires two settings in the `system_settings` table:
- `billplz_api_key`
- `billplz_collection_id`

## Solution - 3 SQL Scripts to Run

### Step 1: Create the Upsert Function
Run this in Supabase SQL Editor: [CREATE_UPSERT_FUNCTION.sql](CREATE_UPSERT_FUNCTION.sql)

This creates a helper function that allows HQ to safely update system settings.

### Step 2: Insert Billplz Configuration
Run this in Supabase SQL Editor: [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql)

**IMPORTANT**: Replace the placeholder values with your actual Billplz credentials:
- Get API Key from: https://www.billplz.com/enterprise/setting
- Get Collection ID from: https://www.billplz.com/collections

### Step 3: Access Settings Page (HQ Role)
1. Login as HQ user (hq@gmail.com)
2. Click **Settings** in the sidebar (at the bottom)
3. Scroll to **Billplz Payment Gateway** section
4. Enter your:
   - Billplz API Key
   - Billplz Collection ID
5. Click **Save Billplz Configuration**

---

## Verification

After completing the steps above, verify the configuration:

```sql
SELECT setting_key,
       CASE
         WHEN setting_key = 'billplz_api_key' THEN '••••••••'
         ELSE setting_value
       END as value
FROM public.system_settings
WHERE setting_key IN ('billplz_api_key', 'billplz_collection_id');
```

You should see:
```
billplz_api_key      | ••••••••
billplz_collection_id | your_collection_id
```

---

## How the Settings Page Works

### For HQ Role Only:
1. **View Configuration** - Shows masked API key and Collection ID
2. **Update Configuration** - Can update both values via web form
3. **RLS Policies** - HQ has FOR ALL permission on system_settings table

### Database Permissions:
```sql
-- HQ can do everything with system_settings
CREATE POLICY "HQ can manage system settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hq'::app_role));

-- Everyone can read (for logo_url etc)
CREATE POLICY "Anyone can read system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);
```

---

## Files Modified/Created

### Code Changes:
- [src/components/dashboard/HQDashboard.tsx](src/components/dashboard/HQDashboard.tsx) - Added Settings view
- [src/components/dashboard/common/Settings.tsx](src/components/dashboard/common/Settings.tsx) - Already has Billplz section

### SQL Scripts Created:
- [CREATE_UPSERT_FUNCTION.sql](CREATE_UPSERT_FUNCTION.sql) - Helper function for updating settings
- [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql) - Insert Billplz configuration

---

## Alternative: Use Edge Function Secrets

Instead of storing in database, you can set as Supabase secrets:

1. Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/settings/functions
2. Add secrets:
   - `BILLPLZ_API_KEY` = your_api_key
   - `BILLPLZ_COLLECTION_ID` = your_collection_id

The edge function checks environment variables as fallback:
```typescript
const BILLPLZ_API_KEY = billplzApiKey?.setting_value || Deno.env.get('BILLPLZ_API_KEY');
const BILLPLZ_COLLECTION_ID = billplzCollectionId?.setting_value || Deno.env.get('BILLPLZ_COLLECTION_ID');
```

---

## Testing

After configuration, test the payment flow:

1. Login as Master Agent (aqil@gmail.com) or Agent (em@gmail.com)
2. Go to **Purchase** page
3. Select a bundle and quantity
4. Click **Proceed to Payment**
5. Should redirect to Billplz payment page (not 500 error)

---

## Summary

**What was fixed:**
1. ✅ HQ can now access Settings page from sidebar
2. ✅ Settings page has Billplz configuration section
3. ✅ Created `upsert_system_setting` function for safe updates
4. ✅ RLS policies already allow HQ to update system_settings

**What you need to do:**
1. Run [CREATE_UPSERT_FUNCTION.sql](CREATE_UPSERT_FUNCTION.sql) in SQL Editor
2. Get your Billplz credentials
3. Either:
   - Option A: Run [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql) with your credentials
   - Option B: Login as HQ and use Settings page to enter credentials

**Result:**
- Edge function will stop throwing "Billplz not configured" error
- Payment processing will work correctly

---

Generated with [Claude Code](https://claude.com/claude-code)
