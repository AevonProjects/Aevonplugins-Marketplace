import { NextResponse } from "next/server";

const MINECRAFT_SERVER = "aevonsmp.online";
export const dynamic = "force-dynamic";

export async function GET() {
  const minecraft = {
    address: MINECRAFT_SERVER,
    available: false,
    online: false,
    playersOnline: 0,
    playersMax: 0,
    version: null as string | null,
  };

  try {
    const response = await fetch(
      `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(MINECRAFT_SERVER)}?query=false&timeout=4`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      minecraft.available = true;
      minecraft.online = Boolean(data?.online);
      minecraft.playersOnline = Number(data?.players?.online ?? 0);
      minecraft.playersMax = Number(data?.players?.max ?? 0);
      minecraft.version = data?.version?.name_clean ?? data?.version?.name_raw ?? null;
    }
  } catch {
    // Status provider failures are intentionally isolated from the storefront.
  }

  return NextResponse.json({ minecraft, updatedAt: new Date().toISOString() }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
