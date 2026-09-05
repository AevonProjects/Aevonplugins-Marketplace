# AevonSMP Store + Minecraft Bridge Setup

## 1. Supabase
Run `supabase/aevonsmp-store.sql` once in the Supabase SQL Editor. It creates:
- `aevonsmp_products`
- `aevonsmp_orders`
- `aevonsmp_server_status`
- RLS policies and indexes

## 2. Vercel environment variable
Create a long random secret and add it to the website project as:

`AEVONSMP_BRIDGE_SECRET=your-long-random-secret`

Keep the existing Supabase and PayPal environment variables unchanged.
Redeploy after adding the variable.

## 3. Minecraft plugin
Install `AevonSMPBridge-1.0.0.jar` into the server `plugins/` folder and start the server once.
Edit `plugins/AevonSMPBridge/config.yml`:

```yml
website-url: "https://aevonplugins.shop"
bridge-secret: "the-exact-same-secret-as-vercel"
server-id: "aevonsmp-main"
server-name: "AevonSMP"
server-address: "aevonsmp.online"
check-interval-seconds: 5
```

Then restart, or use `/asmpbridge reload` as an OP/admin.

## 4. Admin product creation
Open the existing Admin Dashboard. A new **AevonSMP Store** section is included.
Each product supports:
- Product name
- Description
- Price in PHP
- Reward console command
- Command mode: once or once-per-quantity
- Required free inventory slots (0–36)
- Maximum purchase quantity
- Image URL (optional)
- Draft/published status
- Sort order

Reward command placeholders:
- `{player}` target Minecraft IGN
- `{quantity}` purchased quantity
- `{order_id}` immutable order code
- `{product}` product name

Examples:
- `acoins give {player} 500`
- `eco give {player} 50000`
- `lp user {player} parent add vip`
- `crate key give {player} legendary {quantity}`

Do not include the leading `/`.

## 5. Delivery behavior
- PayPal: payment capture automatically queues the reward.
- GCash: admin approval queues the reward.
- Offline player: order remains queued until the IGN is online.
- Inventory requirement: if the configured number of free slots is unavailable, the plugin keeps the reward pending and rechecks every 5 seconds.
- Duplicate safety: successfully executed order IDs are written to `plugins/AevonSMPBridge/processed-orders.txt` before website acknowledgement. A retried website order will not execute twice on the same server installation.

## 6. Live AevonSMP page
The new `/aevonsmp` page shows:
- Live server online/offline state reported by the plugin
- Current player count
- Current online player names
- Player head avatars
- Published AevonSMP products
- Logged-in checkout with IGN + quantity

The bridge heartbeat is considered stale after roughly 30 seconds, so the website will not keep showing old players if the Minecraft server stops.

## 7. Admin command
- `/asmpbridge` — show bridge status
- `/asmpbridge reload` — reload config and 5-second interval
Permission: `aevonsmpbridge.admin` (default OP)
