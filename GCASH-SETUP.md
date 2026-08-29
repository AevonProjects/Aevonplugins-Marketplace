# Manual GCash checkout setup

1. Run `supabase/gcash-manual-orders.sql` in Supabase SQL Editor.
2. Configure these Vercel environment variables:
   - `NEXT_PUBLIC_DISCORD_INVITE` = `https://discord.gg/kvPZ95ZsVk`
   - `NEXT_PUBLIC_GCASH_ACCOUNT_NAME` = your display/account name
   - `NEXT_PUBLIC_GCASH_NUMBER` = your GCash number (optional if using QR only)
   - `NEXT_PUBLIC_GCASH_QR_URL` = public URL/path to the QR image (optional until QR is supplied)
3. Redeploy.

GCash flow: customer creates a pending order, pays, sends the receipt + order reference in Discord, staff verifies it, then clicks **Approve & Grant** in Admin. Approval creates ownership and an active license.

PayPal is displayed as the next automatic payment integration and remains disabled in this package.
