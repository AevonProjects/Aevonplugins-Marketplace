# GCash Website Ticket System

This update creates a private website ticket automatically whenever a signed-in buyer chooses GCash for an AevonPlugins or AevonSMP store purchase.

## Buyer
- Redirected directly to their private ticket.
- Sees the bundled GCash QR code, exact order amount, order reference, and product.
- Can send messages to Aevon admins.
- Can revisit all own tickets at `/account/tickets`.
- Cannot see another buyer's ticket.

## Admin
- New **GCash Payment Tickets** section in `/admin`.
- Admins can open every ticket and communicate with the buyer.
- Approve/Reject buttons are available from the ticket.
- Approval uses the existing fulfillment logic: AevonPlugins grants ownership/license; AevonSMP queues the in-game reward.
- Ticket status follows the payment review status.

## Purchase history cleanup
Reviewed orders now have an admin-only **Delete History** action. This is intentionally a safe soft-delete (`admin_hidden`) so it removes the entry from the admin history without revoking licenses, delivered rewards, or commission records.

## Required SQL
Run `supabase/gcash-ticket-system.sql` once in Supabase SQL Editor before deploying the website.
