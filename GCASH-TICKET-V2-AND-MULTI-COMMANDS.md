# GCash Ticket v2 + AevonSMP Multi-Command Update

## New GCash ticket controls
- Buyer can cancel their own ticket only while the GCash purchase is still pending/open.
- Admin can permanently delete a ticket after it is approved, rejected, or cancelled.
- Permanent ticket deletion deletes its conversation and private ticket pictures.
- Admin purchase-history Delete History also permanently deletes the linked GCash ticket.
- Completed plugin ownership, licenses, delivered AevonSMP rewards, and credited commissions are not reversed by deleting ticket/history records.

## Ticket pictures
- Buyer and admin can attach picture files inside the private ticket conversation.
- Pictures are stored in the private `gcash-ticket-images` Supabase bucket.
- Maximum picture size: 5 MB.
- Supported types: JPG/JPEG, PNG, WEBP, GIF, BMP, AVIF.
- Images are served through short-lived signed URLs; they are not placed in a public storage bucket.

## AevonSMP product reward commands
- Admin product editor now supports 1 to 5 reward commands.
- Commands run in the order shown in the editor.
- `once` mode: every configured command runs once.
- `per_quantity` mode: the full command list runs once per purchased quantity.
- Existing placeholders still work: `{player}`, `{quantity}`, `{order_id}`, `{product}`.
- Existing single-command products remain compatible.

## Required Supabase step
Run `supabase/gcash-ticket-media-cancel-update.sql` once after the original GCash ticket SQL.

## Minecraft bridge
Replace the old bridge with `AevonSMPBridge-1.0.0-MultiCommands.jar`.
This build preserves the Purpur scheduler fix, redirect handling, bridge auth diagnostics, `/aevonbridgereload`, purchase broadcasts, and adds execution of up to 5 product commands.
