import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { EventNav } from "@/components/EventNav";
import { MusicUpload } from "@/components/MusicUpload";
import { MusicDownload } from "@/components/MusicDownload";
import { musicPlayLinks } from "@/app/music/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatFileSize } from "@/lib/music";
import { button, buttonSmall, card, h2, link, muted } from "@/components/ui";

/** Emails of the people who entered, so organisers can chase missing music. */
async function contactEmails(userIds: string[]) {
  const emails = new Map<string, string>();
  if (userIds.length === 0 || !process.env.SUPABASE_SECRET_KEY?.trim()) return emails;
  const { data } = await createAdminSupabase().from("profiles").select("id, email").in("id", userIds);
  for (const p of data ?? []) emails.set(p.id, p.email);
  return emails;
}

function zipName(eventName: string, part: string) {
  return `${`${eventName} ${part}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()} music.zip`;
}

async function Music({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);

  const [{ data: entries }, { data: sessions }] = await Promise.all([
    supabase
      .from("entries")
      .select("id, item_number, performer_name, studio_name, entered_by, sections(code, name, session_id), entry_music(file_name, size_bytes, uploaded_at)")
      .eq("event_id", eventId)
      .eq("status", "entered")
      .order("position"),
    supabase.from("event_sessions").select("id, name, session_date").eq("event_id", eventId).order("position"),
  ]);

  const rows = entries ?? [];
  const withMusic = rows.filter((r) => r.entry_music);
  const missing = rows.filter((r) => !r.entry_music);
  const [links, emails] = await Promise.all([
    musicPlayLinks(withMusic.map((r) => r.id)),
    contactEmails([...new Set(missing.flatMap((r) => (r.entered_by ? [r.entered_by] : [])))]),
  ]);
  const sessionsWithMusic = (sessions ?? []).filter((s) => withMusic.some((r) => r.sections?.session_id === s.id));

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="music" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}><p className={muted}>Music uploaded</p><p className="text-2xl font-bold">{withMusic.length} of {rows.length}</p></div>
        <div className={card}><p className={muted}>Still missing</p><p className={`text-2xl font-bold ${missing.length ? "text-amber-700" : ""}`}>{missing.length}</p></div>
        <div className={card}><p className={muted}>Music due</p><p className="text-lg font-semibold">{event.music_due_on ? formatDate(event.music_due_on) : "Not set"}</p><p className={muted}>Change it on the Details tab.</p></div>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Download for the sound desk</h2>
        <p className="text-sm text-slate-600">
          One zip file, in running order. Files are named like <span className="font-mono text-xs">003 - Item 12A - Jane Jones.mp3</span>. Number the program first so item numbers are included. Large events can take a few minutes; keep this page open until it saves.
        </p>
        <MusicDownload eventId={eventId} sessionId={null} label="Download all music" zipName={zipName(event.name, "")} className={button} />
        {sessionsWithMusic.length > 1 && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className={muted}>Or one session at a time:</p>
            {sessionsWithMusic.map((s) => (
              <MusicDownload
                key={s.id}
                eventId={eventId}
                sessionId={s.id}
                label={`${s.name}${s.session_date ? ` (${formatDate(s.session_date)})` : ""}`}
                zipName={zipName(event.name, s.name)}
                className={buttonSmall}
              />
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className={h2}>Every entry</h2>
          <p className={muted}>Press play to check a track. You can also upload or replace music for any entry (for example a late change emailed to you).</p>
        </div>
        {rows.length === 0 ? (
          <p className={`${muted} px-5 py-4`}>No entries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[5rem_1fr_minmax(0,22rem)]">
                <p className="font-semibold">{r.item_number ?? <span className="font-normal text-slate-400">No number</span>}</p>
                <div>
                  <p className="font-medium">{r.performer_name}{r.studio_name && r.studio_name !== r.performer_name ? <span className="font-normal text-slate-600"> · {r.studio_name}</span> : null}</p>
                  <p className="text-slate-600">{r.sections ? `${r.sections.code} – ${r.sections.name}` : ""}</p>
                </div>
                <div className="min-w-0 space-y-1">
                  {r.entry_music ? (
                    <>
                      <p className="truncate text-xs text-slate-600" title={r.entry_music.file_name}>
                        <span className="font-medium text-emerald-700">✓</span> {r.entry_music.file_name} · {formatFileSize(r.entry_music.size_bytes)} · {formatDateTime(r.entry_music.uploaded_at)}
                      </p>
                      {links[r.id] && <audio controls preload="none" src={links[r.id]} className="h-9 w-full" />}
                    </>
                  ) : (
                    <p className="text-xs font-medium text-amber-700">
                      No music yet
                      {r.entered_by && emails.get(r.entered_by) && (
                        <> · <a href={`mailto:${emails.get(r.entered_by)}?subject=${encodeURIComponent(`Music for ${event.name}`)}`} className={link}>{emails.get(r.entered_by)}</a></>
                      )}
                    </p>
                  )}
                  <MusicUpload entryId={r.id} hasMusic={!!r.entry_music} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MusicPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/music">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Music params={params} />
    </Suspense>
  );
}
