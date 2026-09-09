import "server-only";
import { NextResponse } from "next/server";

export function internalError(publicMessage: string, error?: unknown, status = 500) {
  if (error) console.error(publicMessage, error);
  return NextResponse.json(
    { error: publicMessage },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
