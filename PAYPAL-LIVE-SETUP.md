# PayPal Live Checkout Setup

This build adds automatic PayPal checkout while preserving manual GCash verification.

## 1. Supabase
Run `supabase/paypal-live-checkout.sql` once in Supabase SQL Editor.

## 2. Vercel environment variables
Production must contain:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = PayPal LIVE Client ID
- `PAYPAL_CLIENT_SECRET` = PayPal LIVE Client Secret (Secret/server-only)
- `PAYPAL_ENVIRONMENT` = `live`

Redeploy after adding/changing environment variables.

## 3. Payment flow
A signed-in customer selects PayPal, approves the payment on PayPal, then returns to the marketplace. The server captures and verifies the PayPal payment amount/currency. Only after a completed verified capture does it grant plugin ownership and create an active license.

GCash remains manual and continues to appear in the Admin payment-verification queue. PayPal orders are not shown in that manual GCash approval queue.
