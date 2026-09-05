# AevonSMP Discount Code + Commission Update

## Added
- Admin-generated account-bound discount codes.
- Percentage-only discounts.
- Registered-user email lookup before code generation.
- Configurable commission percentage (defaults to 5%).
- One discount code per registered account.
- AevonSMP checkout discount-code field with server-side validation.
- Subtotal, discount, and final total display before payment.
- PayPal charges the discounted total.
- GCash orders store the discounted total for admin approval.
- Commission is credited only after PayPal capture or GCash approval.
- Unique-per-order commission ledger prevents duplicate commission credits.
- My Account > Discount Code panel showing code, discount, commission rate, unique players, paid uses, balance, and lifetime earnings.
- Self-referral is blocked.
- Used discount codes must be disabled instead of deleted so history is preserved.

## Required deployment step
Re-run `supabase/aevonsmp-store.sql` in Supabase SQL Editor before deploying this website build.

No AevonSMPBridge plugin update is required for this feature.


## Global marketplace coverage
Discount codes now apply to BOTH AevonSMP products and paid AevonPlugins marketplace resources. The same generated code is used site-wide. Marketplace PayPal and GCash orders snapshot the discount and commission values and credit the same commission wallet after successful payment/approval. Self-referrals remain blocked.
