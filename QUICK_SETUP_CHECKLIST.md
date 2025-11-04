# Quick Setup Checklist - Payment Functions

## Issue
Billplz payment edge function returning errors:
- ❌ `{"error":"Failed to generate order number"}`
- ❌ `{"error":"Billplz not configured. Please contact administrator."}`

## Fix - Run These 4 SQL Scripts

Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/sql

### ☐ Script 1: Order Number Generator
Copy & run: [CREATE_GENERATE_ORDER_NUMBER_FUNCTION.sql](CREATE_GENERATE_ORDER_NUMBER_FUNCTION.sql)

### ☐ Script 2: Settings Upsert Function
Copy & run: [CREATE_UPSERT_FUNCTION.sql](CREATE_UPSERT_FUNCTION.sql)

### ☐ Script 3: Billplz Configuration
1. Get your Billplz credentials:
   - API Key: https://www.billplz.com/enterprise/setting
   - Collection ID: https://www.billplz.com/collections
2. Edit [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql):
   - Replace `YOUR_BILLPLZ_API_KEY_HERE` with your API key
   - Replace `YOUR_BILLPLZ_COLLECTION_ID_HERE` with your Collection ID
3. Copy & run the edited script

### ☐ Verification
Run this query to verify:
```sql
-- Should return 2 rows
SELECT setting_key,
       CASE WHEN setting_key = 'billplz_api_key'
            THEN '••••••••'
            ELSE setting_value
       END as value
FROM public.system_settings
WHERE setting_key IN ('billplz_api_key', 'billplz_collection_id');
```

### ☐ Test Payment
1. Login as Master Agent or Agent
2. Go to Purchase page
3. Select bundle and click "Proceed to Payment"
4. Should redirect to Billplz (not 500 error)

---

## Alternative: Use UI (After Scripts 1 & 2)

Instead of Script 3, you can use the Settings page:
1. Login as HQ (hq@gmail.com)
2. Click **Settings** in sidebar
3. Scroll to **Billplz Payment Gateway**
4. Enter API Key and Collection ID
5. Click **Save**

---

## Files Reference

| File | Purpose |
|------|---------|
| [CREATE_GENERATE_ORDER_NUMBER_FUNCTION.sql](CREATE_GENERATE_ORDER_NUMBER_FUNCTION.sql) | Creates ON1, ON2, ON3... order numbers |
| [CREATE_UPSERT_FUNCTION.sql](CREATE_UPSERT_FUNCTION.sql) | Allows updating system settings |
| [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql) | Adds Billplz credentials to database |
| [FIX_BILLPLZ_EDGE_FUNCTION.md](FIX_BILLPLZ_EDGE_FUNCTION.md) | Detailed explanation |

---

## Summary

**Required:** Scripts 1 & 2 (functions)
**Choose one:** Script 3 (SQL) OR Settings UI (HQ login)
**Result:** Payment processing will work ✅
