import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Read the admin role separately. This keeps the Admin tab working even if
  // one of the newer optional profile columns has not been migrated yet.
  const roleResult = await auth.admin
    .from("profiles")
    .select("id,role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (roleResult.error) {
    return NextResponse.json({ error: roleResult.error.message }, { status: 500 });
  }

  let roleProfile = roleResult.data;
  if (!roleProfile) {
    const created = await auth.admin
      .from("profiles")
      .insert({ id: auth.user.id })
      .select("id,role")
      .single();
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
    roleProfile = created.data;
  }

  // Optional fields are intentionally non-fatal for header/admin access.
  const optionalResult = await auth.admin
    .from("profiles")
    .select("nickname,avatar_url,nickname_changed_at,verification_status,verified_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  const optional = optionalResult.error ? null : optionalResult.data;
  const fallbackNickname =
    String(auth.user.user_metadata?.display_name || auth.user.user_metadata?.username || "").trim() ||
    auth.user.email?.split("@")[0] ||
    "Aevon User";

  return NextResponse.json({
    user: { id: auth.user.id, email: auth.user.email ?? null },
    profile: {
      id: roleProfile.id,
      role: roleProfile.role,
      nickname: optional?.nickname ?? fallbackNickname,
      avatar_url: optional?.avatar_url ?? null,
      nickname_changed_at: optional?.nickname_changed_at ?? null,
      verification_status: optional?.verification_status ?? "unverified",
      verified_at: optional?.verified_at ?? null,
      profileMigrationReady: !optionalResult.error,
    },
  });
}
