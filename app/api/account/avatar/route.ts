import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabaseAdmin";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_BUCKET = "profile-avatars";

async function ensureAvatarBucket(admin: any) {
  const { data: bucket, error: lookupError } = await admin.storage.getBucket(AVATAR_BUCKET);
  if (bucket) return;

  // A missing bucket is recoverable. Create it with the service-role client so
  // existing installations don't require a manual Storage-dashboard step.
  const message = String(lookupError?.message || "").toLowerCase();
  const missing = !lookupError ||
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("related resource");

  if (!missing) throw new Error(lookupError?.message || "Could not check profile-picture storage.");

  const { error: createError } = await admin.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
  });

  // If two requests race to create the same bucket, the second one may report
  // that it already exists. That is safe and should not block the upload.
  if (createError) {
    const createMessage = String(createError.message || "").toLowerCase();
    const alreadyExists = createMessage.includes("already exists") ||
      createMessage.includes("duplicate") ||
      createMessage.includes("409");
    if (!alreadyExists) throw new Error(createError.message || "Could not create profile-picture storage.");
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const fileName = String(body.fileName || "avatar.jpg");
  const contentType = String(body.contentType || "");
  const size = Number(body.size || 0);

  if (!allowed.has(contentType)) {
    return NextResponse.json({ error: "Profile picture must be JPG, PNG, or WEBP." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Profile picture must be 5 MB or smaller." }, { status: 400 });
  }

  try {
    await ensureAvatarBucket(auth.admin);

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;

    const { data, error } = await auth.admin.storage.from(AVATAR_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({
        error: "Could not prepare the profile-picture upload. Please try again."
      }, { status: 500 });
    }

    const { data: publicData } = auth.admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return NextResponse.json({
      path,
      token: data.token,
      publicUrl: publicData.publicUrl,
      originalName: fileName
    });
  } catch (error: any) {
    console.error("Avatar storage setup failed:", error);
    return NextResponse.json({
      error: "Profile-picture storage is not ready. Please check the server Supabase configuration and try again."
    }, { status: 500 });
  }
}
