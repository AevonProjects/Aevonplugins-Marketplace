import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  // Read through the service-role client so profile updates never depend on browser RLS.
  const currentResult = await auth.admin
    .from("profiles")
    .select("nickname,nickname_changed_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (currentResult.error) return NextResponse.json({ error: currentResult.error.message }, { status: 500 });

  if (typeof body.nickname === "string") {
    const nickname = body.nickname.trim();
    if (nickname.length < 2 || nickname.length > 32) return NextResponse.json({ error: "Nickname must be 2–32 characters." }, { status: 400 });

    const oldNickname = String(currentResult.data?.nickname || "").trim();
    if (nickname !== oldNickname) {
      const changedAt = currentResult.data?.nickname_changed_at;
      if (changedAt && Date.now() - new Date(changedAt).getTime() < 30 * 86400000) {
        const availableAt = new Date(new Date(changedAt).getTime() + 30 * 86400000);
        return NextResponse.json({ error: `Nickname can only be changed once every 30 days. You can change it again on ${availableAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.` }, { status: 429 });
      }
      patch.nickname = nickname;
      patch.nickname_changed_at = now;
    }
  }

  if (typeof body.avatar_url === "string" && body.avatar_url.startsWith("http")) patch.avatar_url = body.avatar_url;

  let result;
  if (currentResult.data) {
    result = await auth.admin
      .from("profiles")
      .update(patch)
      .eq("id", auth.user.id)
      .select("nickname,avatar_url,nickname_changed_at,verification_status")
      .single();
  } else {
    result = await auth.admin
      .from("profiles")
      .insert({ id: auth.user.id, ...patch })
      .select("nickname,avatar_url,nickname_changed_at,verification_status")
      .single();
  }

  return result.error
    ? NextResponse.json({ error: result.error.message }, { status: 500 })
    : NextResponse.json({ profile: result.data });
}
