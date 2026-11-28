"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { critiqueContentType, critiqueDownloadName, critiqueExtension, critiqueFileProblem } from "@/lib/critiques";
import { done, fail, type FormState } from "@/lib/form";

const BUCKET = "critiques";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** The entry's event, if the signed-in person organises it. */
async function managedEntry(entryId: string): Promise<Result<{ eventId: string }>> {
  await requireUser();
  const supabase = await createSupabase();
  const { data: entry } = await supabase.from("entries").select("event_id").eq("id", entryId).maybeSingle();
  if (!entry) return { ok: false, error: "That entry no longer exists." };
  const { data: canManage } = await supabase.rpc("can_manage_event", { ev: entry.event_id });
  if (!canManage) return { ok: false, error: "Only the competition's organisers can upload critiques." };
  return { ok: true, eventId: entry.event_id };
}

/** Step 1: a one-off link the browser uploads the recording to. */
export async function prepareCritiqueUpload(
  entryId: string,
  fileName: string,
  sizeBytes: number,
): Promise<Result<{ uploadUrl: string; path: string; contentType: string }>> {
  const problem = critiqueFileProblem(fileName, sizeBytes);
  if (problem) return { ok: false, error: problem };
  const allowed = await managedEntry(entryId);
  if (!allowed.ok) return allowed;
  const ext = critiqueExtension(fileName)!;
  const path = `${allowed.eventId}/${entryId}/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Critique storage isn't ready yet. Has the critiques SQL file been run?" };
  return { ok: true, uploadUrl: data.signedUrl, path, contentType: critiqueContentType(ext) };
}

/** Step 2: record the uploaded recording against the entry. */
export async function finishCritiqueUpload(entryId: string, path: string, fileName: string, adjudicator: string): Promise<Result<{ message: string }>> {
  const user = await requireUser();
  const allowed = await managedEntry(entryId);
  if (!allowed.ok) return allowed;

  const folder = `${allowed.eventId}/${entryId}`;
  const objectName = path.slice(folder.length + 1);
  if (!path.startsWith(`${folder}/`) || objectName.includes("/")) return { ok: false, error: "That upload doesn't match this entry." };

  const admin = createAdminSupabase();
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 100, search: objectName });
  const uploaded = files?.find((f) => f.name === objectName);
  const size = Number(uploaded?.metadata?.size ?? 0);
  if (!uploaded || size <= 0) return { ok: false, error: "The upload didn't finish. Please try again." };

  const { error } = await admin.from("entry_critiques").insert({
    entry_id: entryId,
    event_id: allowed.eventId,
    storage_path: path,
    file_name: fileName.trim().slice(0, 200) || objectName,
    adjudicator: adjudicator.trim().slice(0, 100),
    size_bytes: size,
    content_type: String(uploaded.metadata?.mimetype ?? critiqueContentType(critiqueExtension(path) ?? "")),
    uploaded_by: user.id,
  });
  if (error) return { ok: false, error: "We couldn't save the critique. Please try again." };
  return { ok: true, message: "Critique uploaded." };
}

/** Organiser: remove a critique (for example, one matched to the wrong entry). */
export async function deleteCritique(critiqueId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  // Organisers can read every critique for their events; competitors can't delete.
  const { data: row } = await supabase.from("entry_critiques").select("id, event_id, storage_path").eq("id", critiqueId).maybeSingle();
  if (!row) return fail("That critique no longer exists.");
  const { data: canManage } = await supabase.rpc("can_manage_event", { ev: row.event_id });
  if (!canManage) return fail("Only the competition's organisers can remove critiques.");
  const admin = createAdminSupabase();
  await admin.storage.from(BUCKET).remove([row.storage_path]);
  const { error } = await admin.from("entry_critiques").delete().eq("id", row.id);
  if (error) return fail("We couldn't remove it. Please try again.");
  refresh();
  return done("Removed.");
}

/** Organiser: release (or hide again) critiques for the whole event, or one session. */
export async function setCritiqueRelease(eventId: string, sessionId: string | null, release: boolean): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const value = release ? new Date().toISOString() : null;
  // The security rules only let organisers change their own events and sessions.
  const { data, error } = sessionId
    ? await supabase.from("event_sessions").update({ critiques_released_at: value }).eq("id", sessionId).eq("event_id", eventId).select("id")
    : await supabase.from("events").update({ critiques_released_at: value }).eq("id", eventId).select("id");
  if (error || !data?.length) return fail("You don't have permission to do that.");
  refresh();
  return done(release ? "Released. Competitors can now hear their critiques." : "Hidden from competitors again.");
}

export type CritiqueLink = { id: string; play: string; download: string };

/** Short-lived play and download links for critiques the signed-in person may hear. */
export async function critiqueLinks(critiqueIds: string[]): Promise<Record<string, CritiqueLink>> {
  await requireUser();
  if (critiqueIds.length === 0) return {};
  const supabase = await createSupabase();
  // The security rules only return released critiques for your own entries, or any for events you organise.
  const { data: rows } = await supabase.from("entry_critiques").select("id, storage_path, file_name, adjudicator, entries(item_number, performer_name, sections(name))")
    .in("id", critiqueIds);
  if (!rows?.length) return {};
  const storage = createAdminSupabase().storage.from(BUCKET);
  const { data: play } = await storage.createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  const playByPath = new Map((play ?? []).map((s) => [s.path, s.signedUrl]));
  const out: Record<string, CritiqueLink> = {};
  await Promise.all(
    rows.map(async (r) => {
      const { data: dl } = await storage.createSignedUrl(r.storage_path, 60 * 60, {
        download: critiqueDownloadName(
          r.entries?.item_number ?? null,
          r.entries?.performer_name ?? "",
          r.entries?.sections?.name ?? null,
          r.adjudicator,
          critiqueExtension(r.storage_path) ?? "mp3",
        ),
      });
      const p = playByPath.get(r.storage_path);
      if (p && dl?.signedUrl) out[r.id] = { id: r.id, play: p, download: dl.signedUrl };
    }),
  );
  return out;
}
