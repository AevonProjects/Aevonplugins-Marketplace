import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const runtime = "nodejs";

type ProxyCheckResult = {
  status?: string;
  [key: string]: unknown;
};

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-vercel-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return raw.replace(/^::ffff:/, "");
}

function ipHash(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function checkProxy(ip: string, apiKey: string) {
  const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${encodeURIComponent(apiKey)}&vpn=1&risk=1`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`IP reputation service returned ${response.status}`);
  const body = await response.json() as ProxyCheckResult;
  const result = body[ip] as { proxy?: string; type?: string; risk?: string | number } | undefined;
  if (!result) throw new Error("IP reputation result was unavailable");
  return {
    blocked: result.proxy === "yes",
    type: result.type || "proxy/VPN",
    risk: result.risk
  };
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hashSecret = process.env.IP_HASH_SECRET;
  const proxyCheckKey = process.env.PROXYCHECK_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !hashSecret || !proxyCheckKey) {
    return NextResponse.json({ error: "Registration security is not fully configured yet." }, { status: 503 });
  }

  let payload: { email?: string; password?: string; displayName?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid registration request." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password || "";
  const displayName = payload.displayName?.trim().slice(0, 40) || "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const ip = getClientIp(request);
  if (!ip) return NextResponse.json({ error: "We could not verify your connection IP." }, { status: 400 });

  try {
    const reputation = await checkProxy(ip, proxyCheckKey);
    if (reputation.blocked) {
      return NextResponse.json({ error: `Registration from VPN/proxy connections is not allowed (${reputation.type}). Disable it and try again.` }, { status: 403 });
    }
  } catch (error) {
    console.error("IP reputation check failed", error);
    return NextResponse.json({ error: "We could not complete the connection security check. Please try again shortly." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const registrationHash = ipHash(ip, hashSecret);

  const { data: existing, error: lookupError } = await admin
    .from("registration_ip_locks")
    .select("id")
    .eq("ip_hash", registrationHash)
    .maybeSingle();

  if (lookupError) {
    console.error("IP lock lookup failed", lookupError);
    return NextResponse.json({ error: "Registration protection is temporarily unavailable." }, { status: 503 });
  }
  if (existing) return NextResponse.json({ error: "An account has already been registered from this connection." }, { status: 409 });

  const emailRedirectTo = `${request.nextUrl.origin}/login`;
  const { data: signup, error: signupError } = await admin.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { display_name: displayName || null }
    }
  });

  if (signupError || !signup.user) {
    return NextResponse.json({ error: signupError?.message || "Account creation failed." }, { status: 400 });
  }

  // Supabase may deliberately obscure an already-registered email by returning
  // a user with no identities. Do not consume an IP registration slot in that case.
  if (Array.isArray(signup.user.identities) && signup.user.identities.length === 0) {
    return NextResponse.json({ error: "Unable to create this account. If the email is already registered, use Login or Forgot Password." }, { status: 409 });
  }

  const { error: lockError } = await admin.from("registration_ip_locks").insert({
    user_id: signup.user.id,
    ip_hash: registrationHash
  });

  if (lockError) {
    console.error("IP lock insert failed; rolling back user", lockError);
    await admin.auth.admin.deleteUser(signup.user.id).catch(() => undefined);
    if (lockError.code === "23505") {
      return NextResponse.json({ error: "An account has already been registered from this connection." }, { status: 409 });
    }
    return NextResponse.json({ error: "Account registration could not be finalized. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    message: "Account created. Check your email and verify it before signing in."
  });
}
