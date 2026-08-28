import { NextResponse } from "next/server";

const MINECRAFT_SERVER = "aevonsmp.online";
const DISCORD_INVITE_CODE = "kvPZ95ZsVk";
const DISCORD_INVITE_URL = `https://discord.gg/${DISCORD_INVITE_CODE}`;

export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    minecraft: {
      address: MINECRAFT_SERVER,
      online: false,
      playersOnline: 0,
      playersMax: 0,
      version: null as string | null,
      motd: null as string | null,
    },
    discord: {
      inviteUrl: DISCORD_INVITE_URL,
      available: false,
      members: 0,
      online: 0,
      name: null as string | null,
    },
    updatedAt: new Date().toISOString(),
  };

  await Promise.allSettled([
    (async () => {
      const response = await fetch(
        `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(MINECRAFT_SERVER)}?query=false&timeout=4`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = await response.json();
      result.minecraft.online = Boolean(data?.online);
      result.minecraft.playersOnline = Number(data?.players?.online ?? 0);
      result.minecraft.playersMax = Number(data?.players?.max ?? 0);
      result.minecraft.version = data?.version?.name_clean ?? data?.version?.name_raw ?? null;
      result.minecraft.motd = data?.motd?.clean ?? null;
    })(),
    (async () => {
      const response = await fetch(
        `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true`,
        {
          cache: "no-store",
          headers: { "User-Agent": "AevonPluginsMarketplace/2.0" },
        }
      );
      if (!response.ok) return;
      const data = await response.json();
      result.discord.available = true;
      result.discord.members = Number(data?.approximate_member_count ?? 0);
      result.discord.online = Number(data?.approximate_presence_count ?? 0);
      result.discord.name = data?.guild?.name ?? null;
    })(),
  ]);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
