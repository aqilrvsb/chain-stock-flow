# Troubleshooting PENDING Orders in Payment System

## Issue

Orders remain in "PENDING" status even after payment is completed in Billplz.

## Understanding the Payment Flow

### The Billplz webhook is correctly implemented:

1. ✅ Receives callback from Billplz
2. ✅ **IGNORES** the status from callback (security best practice)
3. ✅ Queries Billplz API directly to verify payment status
4. ✅ Only marks as `completed` if both conditions are true:
   - `paid === true`
   - `state === 'paid'`
5. ✅ Updates `pending_orders.status` accordingly

**Location:** [supabase/functions/billplz-payment/index.ts](supabase/functions/billplz-payment/index.ts) (lines 218-355)

---

## Why Orders Stay PENDING

### 1. Billplz Callback URL Not Configured

**Problem:** Billplz doesn't know where to send payment notifications.

**Solution:**
1. Login to Billplz Dashboard: https://www.billplz.com/
2. Go to **Settings** → **Webhooks**
3. Set callback URL to:
   ```
   https://nzjolxsloobsoqltkpmi.supabase.co/functions/v1/billplz-payment
   ```
4. Make sure webhook is **enabled**

---

### 2. Payment Not Actually Completed

**Problem:** Customer didn't complete payment or payment failed.

**Verification:**
1. Check Billplz Dashboard → Bills
2. Look for the Bill ID (from "Bill ID" column in Transaction History)
3. Verify status is "Paid" in Billplz

---

### 3. Check Edge Function Logs

**How to check:**
1. Go to: https://supabase.com/dashboard/project/nzjolxsloobsoqltkpmi/functions/billplz-payment/logs
2. Look for these messages:
   - `"Webhook received - Bill ID: xxx"` - Confirms webhook was called
   - `"🔍 Querying Billplz API for real status..."` - Confirms API query
   - `"📊 Real bill status from Billplz API:"` - Shows actual status
   - `"✅ Payment successful, creating transaction..."` - Payment verified

**Common log errors:**
- No webhook messages = Billplz not sending callbacks
- API query fails = Authentication issue with Billplz API key
- Status shows `paid: false` = Payment not completed

---

### 4. Manual Recheck Feature

The system includes a **"Recheck"** button for failed transactions.

**How it works:**
1. Click "Recheck" button next to FAILED or PENDING order
2. Calls the same verification logic
3. Queries Billplz API directly
4. Updates status if payment was completed

**Location:** [src/components/dashboard/common/TransactionHistory.tsx](src/components/dashboard/common/TransactionHistory.tsx) (lines 85-133)

---

### 5. Automatic Status Polling on Payment Summary Page

When customer completes payment and returns to your site:

**Location:** [src/pages/PaymentSummary.tsx](src/pages/PaymentSummary.tsx)

**Features:**
- Automatically checks payment status on page load (lines 47-64)
- Polls every 5 seconds for status updates (lines 76-82)
- Manual refresh button (lines 85-133)

This serves as a **backup** to the webhook mechanism.

---

## Diagnostic SQL Queries

### Check pending orders with their details:

```sql
SELECT
  po.order_number,
  po.status,
  po.billplz_bill_id,
  po.transaction_id,
  po.total_price,
  po.created_at,
  p.full_name as buyer_name,
  p.email as buyer_email,
  prod.name as product_name,
  b.name as bundle_name
FROM pending_orders po
LEFT JOIN profiles p ON po.buyer_id = p.id
LEFT JOIN products prod ON po.product_id = prod.id
LEFT JOIN bundles b ON po.bundle_id = b.id
WHERE po.status = 'pending'
ORDER BY po.created_at DESC;
```

### Check Billplz configuration:

```sql
SELECT
  setting_key,
  CASE
    WHEN setting_key = 'billplz_api_key' THEN '••••••••'
    ELSE setting_value
  END as value
FROM system_settings
WHERE setting_key IN ('billplz_api_key', 'billplz_collection_id');
```

### Check recent order status changes:

```sql
SELECT
  order_number,
  status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) / 60 as minutes_to_update
FROM pending_orders
WHERE updated_at > created_at
ORDER BY updated_at DESC
LIMIT 20;
```

---

## Testing the Webhook Manually

### Test with a real Billplz bill:

```bash
curl -X POST https://nzjolxsloobsoqltkpmi.supabase.co/functions/v1/billplz-payment \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=YOUR_BILL_ID_HERE"
```

Replace `YOUR_BILL_ID_HERE` with an actual Billplz bill ID from your database.

**Expected result:**
- Check Supabase logs for processing messages
- Order status should update if payment was completed

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No webhook logs | Callback URL not set in Billplz | Configure webhook URL in Billplz dashboard |
| "Billplz not configured" error | Missing API key or Collection ID | Run [INSERT_BILLPLZ_CONFIG.sql](INSERT_BILLPLZ_CONFIG.sql) or use Settings page |
| Webhook returns 401 | Authentication issue | Verify Billplz API key is correct |
| Status updates on recheck but not webhook | Webhook URL wrong or disabled | Check Billplz webhook settings |
| Orders stuck after hours | Payment not completed by customer | Acceptable - customer didn't pay |

---

## For Old Orders (Before bundle_id was added)

Old orders won't have bundle information. This is expected.

**Behavior:**
- Orders created **before** running [ADD_BUNDLE_ID_TO_PENDING_ORDERS.sql](ADD_BUNDLE_ID_TO_PENDING_ORDERS.sql) will show "-" in Bundle column
- Orders created **after** will show proper bundle names
- This doesn't affect payment processing - only display

---

## Next Steps

1. **Check Billplz webhook configuration first** - This is the most common issue
2. **Review edge function logs** to see if webhooks are being received
3. **Verify API credentials** in system_settings table
4. **Use the Recheck button** for any stuck orders to manually trigger verification
5. **For test orders**, you can manually update status:
   ```sql
   UPDATE pending_orders
   SET status = 'completed', updated_at = NOW()
   WHERE order_number = 'ON1';  -- Replace with your order number
   ```

---

## Technical Details

### Webhook Function Location
[supabase/functions/billplz-payment/index.ts](supabase/functions/billplz-payment/index.ts)

**Lines 218-355:** `handleWebhook()` function

**Key verification code (line 282):**
```typescript
const isPaidSuccess = billData.paid === true && billData.state === 'paid';
```

**Status update (lines 333-346):**
```typescript
if (isPaidSuccess) {
  // Mark as completed
  await supabase
    .from('pending_orders')
    .update({ status: 'completed' })
    .eq('id', payment.id);
} else {
  // Mark as failed
  await supabase
    .from('pending_orders')
    .update({ status: 'failed' })
    .eq('id', payment.id);
}
```

---

Generated with [Claude Code](https://claude.com/claude-code)
