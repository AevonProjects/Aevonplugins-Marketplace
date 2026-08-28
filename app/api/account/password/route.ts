import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/server/supabaseAdmin";

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!auth.user.email) return NextResponse.json({ error: "This account does not have an email address." }, { status: 400 });
  if (!currentPassword) return NextResponse.json({ error: "Enter your current password first." }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  if (currentPassword === newPassword) return NextResponse.json({ error: "Choose a new password that is different from your current password." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = await verifier.auth.signInWithPassword({ email: auth.user.email, password: currentPassword });
  if (check.error) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const updated = await auth.admin.auth.admin.updateUserById(auth.user.id, { password: newPassword });
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
