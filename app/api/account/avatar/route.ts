import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const fileName = String(body.fileName || "avatar.jpg");
  const contentType = String(body.contentType || "");
  const size = Number(body.size || 0);
  if (!allowed.has(contentType)) return NextResponse.json({ error: "Profile picture must be JPG, PNG, or WEBP." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) return NextResponse.json({ error: "Profile picture must be 5 MB or smaller." }, { status: 400 });

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;
  const { data, error } = await auth.admin.storage.from("profile-avatars").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not prepare profile picture upload." }, { status: 500 });

  const { data: publicData } = auth.admin.storage.from("profile-avatars").getPublicUrl(path);
  return NextResponse.json({ path, token: data.token, publicUrl: publicData.publicUrl, originalName: fileName });
}
