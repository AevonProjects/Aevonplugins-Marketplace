# Customer License Reset Update

1. Run `supabase/customer-license-reset-and-server-ip.sql` in Supabase SQL Editor.
2. Deploy the updated marketplace normally.
3. Customer License tab now shows current server binding, observed server IP, activation/validation timestamps, and a Reset Server button.
4. Reset is ownership-checked server-side and clears only `server_id`, `server_ip`, `activated_at`, and `last_validated_at`.
5. License status (active/suspended/revoked) is not changed by customer reset.
6. The next successful plugin validation binds the license to one new installation UUID. UUID remains the security lock; IP is display/audit metadata.
7. Admin license actions now use the existing PATCH API correctly and server reset also clears the displayed IP.

Plugin JAR release policy for this patch: reset updated plugin version metadata and filenames to v1.0.0 when the JARs are supplied.
