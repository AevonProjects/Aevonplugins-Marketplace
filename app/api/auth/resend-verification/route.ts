import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const configuredSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  const emailRedirectTo = `${configuredSiteUrl || request.nextUrl.origin}/login`;

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" }
  });

  const { error } = await auth.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Verification email sent. Check your inbox and spam/junk folder."
  });
}
