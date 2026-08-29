# ALicense server-bound marketplace license

ALicense uses the marketplace `licenses.server_id` field as a first-activation binding.

- First successful activation stores the plugin installation UUID in `licenses.server_id`.
- Future validation succeeds only when the same license key presents the same installation UUID.
- A second normal server creates a different installation UUID and is rejected with: `This license is already activated on another server installation.`
- Admins can deliberately move a license to a replacement server using **Admin > Plugin License Manager > Reset Server**. The next valid server activation becomes the new bound server.
- The validation response returns only the customer's public marketplace nickname/display name and a masked license display string. Email, legal verification data, and identity documents are never sent to the Minecraft server.
- ALicense prints a startup acknowledgement containing the licensed owner, masked license number, server-binding status, and plugin release version.

The installation UUID is stored at `plugins/ALicense/.marketplace-installation-id`. Do not copy that file when moving an unlicensed server installation. Use the Admin Reset Server action when a legitimate customer migrates servers.
