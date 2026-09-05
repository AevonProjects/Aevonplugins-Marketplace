# AevonSMP Forum + Forum Credits

## Rules
- Every registered account receives **1 free forum thread**.
- After the free thread is used, each new thread costs **1 Forum Credit**.
- Replies inside existing threads are **free** and never consume credits.
- **1 Forum Credit = PHP 10**.
- Minimum top-up is **PHP 100 = 10 credits**.
- Custom top-ups are allowed from PHP 100 upward in PHP 10 increments.

## Payments
- PayPal top-ups are captured and credited automatically.
- GCash top-ups remain pending until an administrator approves them in the Admin page.
- Credit purchase delivery is idempotent; approving/capturing the same order again cannot add the credits twice.
- Thread charging is atomic; one available credit cannot create two paid threads even from simultaneous requests.

## Setup
Run `supabase/aevonsmp-forum.sql` in the Supabase SQL Editor after the existing marketplace/AevonSMP schemas have been installed.

The existing PayPal environment variables are reused. No Minecraft plugin update is required because Forum Credits are website-only.
