import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/supabaseAdmin";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, versionId } = await params;
  const { data: release, error: releaseError } = await auth.admin
    .from("plugin_versions")
    .select("id,plugin_id,version,file_path,file_name,is_latest")
    .eq("id", versionId)
    .eq("plugin_id", id)
    .maybeSingle();

  if (releaseError) return NextResponse.json({ error: releaseError.message }, { status: 500 });
  if (!release) return NextResponse.json({ error: "Resource version not found." }, { status: 404 });

  if (release.file_path) {
    const { error: storageError } = await auth.admin.storage.from("plugin-files").remove([release.file_path]);
    if (storageError) return NextResponse.json({ error: `Could not remove JAR from storage: ${storageError.message}` }, { status: 500 });
  }

  const { error: deleteError } = await auth.admin.from("plugin_versions").delete().eq("id", release.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  let promotedVersionId: string | null = null;
  if (release.is_latest) {
    const { data: nextRelease, error: nextError } = await auth.admin
      .from("plugin_versions")
      .select("id,version,file_path,file_name,file_size,is_published,created_at")
      .eq("plugin_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nextError) return NextResponse.json({ error: nextError.message }, { status: 500 });

    if (nextRelease) {
      promotedVersionId = nextRelease.id;
      const { error: promoteError } = await auth.admin.from("plugin_versions").update({ is_latest: true }).eq("id", nextRelease.id);
      if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 500 });
      const { error: syncError } = await auth.admin.from("plugins").update({
        version: nextRelease.version,
        file_path: nextRelease.file_path,
        file_name: nextRelease.file_name,
        file_size: nextRelease.file_size,
        updated_at: new Date().toISOString()
      }).eq("id", id);
      if (syncError) return NextResponse.json({ error: syncError.message }, { status: 500 });
    } else {
      const { error: clearError } = await auth.admin.from("plugins").update({
        version: null, file_path: null, file_name: null, file_size: null, updated_at: new Date().toISOString()
      }).eq("id", id);
      if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, deletedVersionId: release.id, promotedVersionId });
}
