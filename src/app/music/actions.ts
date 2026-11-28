"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { musicContentType, musicExtension, musicFileProblem, playlistFileName } from "@/lib/music";

const BUCKET = "music";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Check the signed-in person may upload music for this entry today. */
async function checkCanUpload(entryId: string): Promise<Result<{ eventId: string }>> {
  await requireUser();
  const supabase = await createSupabase();
  const { data: problem, error } = await supabase.rpc("music_upload_check", { entry: entryId });
  if (error) return { ok: false, error: "We couldn't check this entry. Please try again." };
  if (problem) return { ok: false, error: problem };
  const { data: entry } = await createAdminSupabase().from("entries").select("event_id").eq("id", entryId).maybeSingle();
  if (!entry) return { ok: false, error: "That entry no longer exists." };
  return { ok: true, eventId: entry.event_id };
}

/** Step 1: get a one-off link the browser uploads the file to (straight to storage). */
export async function prepareMusicUpload(
  entryId: string,
  fileName: string,
  sizeBytes: number,
): Promise<Result<{ uploadUrl: string; path: string; contentType: string }>> {
  const problem = musicFileProblem(fileName, sizeBytes);
  if (problem) return { ok: false, error: problem };
  const allowed = await checkCanUpload(entryId);
  if (!allowed.ok) return allowed;

  const ext = musicExtension(fileName)!;
  const path = `${allowed.eventId}/${entryId}/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Music storage isn't ready yet. Please tell the organiser." };
  return { ok: true, uploadUrl: data.signedUrl, path, contentType: musicContentType(ext) };
}

/** Step 2: after the upload, record it against the entry and tidy away the old file. */
export async function finishMusicUpload(entryId: string, path: string, fileName: string): Promise<Result<{ message: string }>> {
  const user = await requireUser();
  const allowed = await checkCanUpload(entryId);
  if (!allowed.ok) return allowed;

  const folder = `${allowed.eventId}/${entryId}`;
  const objectName = path.slice(folder.length + 1);
  if (!path.startsWith(`${folder}/`) || objectName.includes("/")) return { ok: false, error: "That upload doesn't match this entry." };

  const admin = createAdminSupabase();
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
  const uploaded = files?.find((f) => f.name === objectName);
  const size = Number(uploaded?.metadata?.size ?? 0);
  if (!uploaded || size <= 0) return { ok: false, error: "The upload didn't finish. Please try again." };

  const { error } = await admin.from("entry_music").upsert({
    entry_id: entryId,
    event_id: allowed.eventId,
    storage_path: path,
    file_name: fileName.trim().slice(0, 200) || objectName,
    size_bytes: size,
    content_type: String(uploaded.metadata?.mimetype ?? musicContentType(musicExtension(path) ?? "")),
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: "We couldn't save the music. Please try again." };

  // Remove any older file (or half-finished upload) for this entry.
  const old = (files ?? []).filter((f) => f.name !== objectName).map((f) => `${folder}/${f.name}`);
  if (old.length) await admin.storage.from(BUCKET).remove(old);

  refresh();
  return { ok: true, message: "Music uploaded." };
}

/** Short-lived links to play music the signed-in person is allowed to hear. */
export async function musicPlayLinks(entryIds: string[]): Promise<Record<string, string>> {
  await requireUser();
  if (entryIds.length === 0) return {};
  const supabase = await createSupabase();
  // The security rules only return music for your own entries, or for events you organise.
  const { data: rows } = await supabase.from("entry_music").select("entry_id, storage_path").in("entry_id", entryIds);
  if (!rows?.length) return {};
  const { data: signed } = await createAdminSupabase()
    .storage.from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return Object.fromEntries(rows.flatMap((r) => (byPath.get(r.storage_path) ? [[r.entry_id, byPath.get(r.storage_path)!]] : [])));
}

/** Organiser: every music file for an event (or one session), in running order, ready to zip. */
export async function musicDownloadList(
  eventId: string,
  sessionId: string | null,
): Promise<Result<{ files: { name: string; url: string }[]; missing: number }>> {
  await requireUser();
  const supabase = await createSupabase();
  const { data: canManage } = await supabase.rpc("can_manage_event", { ev: eventId });
  if (!canManage) return { ok: false, error: "You don't have access to this event." };

  let query = supabase
    .from("entries")
    .select("id, performer_name, routine_title, position, sections!inner(session_id, name), entry_music(storage_path)")
    .eq("event_id", eventId)
    .eq("status", "entered")
    .order("position");
  if (sessionId) query = query.eq("sections.session_id", sessionId);
  const { data: entries, error } = await query;
  if (error) return { ok: false, error: "We couldn't load the music list. Please try again." };

  // Number by running order (counting entries without music), so the files sort like the program.
  const withMusic = (entries ?? []).map((e, i) => ({ ...e, order: i + 1 })).filter((e) => e.entry_music?.storage_path);
  const missing = (entries ?? []).length - withMusic.length;
  if (withMusic.length === 0) return { ok: true, files: [], missing };

  const { data: signed } = await createAdminSupabase()
    .storage.from(BUCKET)
    .createSignedUrls(withMusic.map((e) => e.entry_music!.storage_path), 60 * 60);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const files = withMusic.map((e) => {
    const path = e.entry_music!.storage_path;
    return { name: playlistFileName(e.order, e.performer_name, e.sections.name, e.routine_title, musicExtension(path) ?? "mp3"), url: byPath.get(path) ?? "" };
  });
  return { ok: true, files: files.filter((f) => f.url), missing };
}
