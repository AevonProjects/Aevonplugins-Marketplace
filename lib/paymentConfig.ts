export const paymentConfig = {
  discordInvite: process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/kvPZ95ZsVk",
  gcashAccountName: process.env.NEXT_PUBLIC_GCASH_ACCOUNT_NAME || "",
  gcashNumber: process.env.NEXT_PUBLIC_GCASH_NUMBER || "0976 211 3232",
  // Intentionally bundled locally so an older NEXT_PUBLIC_GCASH_QR_URL cannot keep showing a stale QR.
  gcashQrUrl: "/assets/gcash-qr.jpg?v=20260829-0709",
};
