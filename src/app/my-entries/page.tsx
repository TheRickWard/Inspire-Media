import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatDateTime, todayInSydney } from "@/lib/format";
import { formatFileSize } from "@/lib/music";
import { musicPlayLinks } from "@/app/music/actions";
import { MusicUpload } from "@/components/MusicUpload";
import { card, h1, h2, link, muted } from "@/components/ui";

async function MyEntries() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: entries } = await supabase
    .from("entries")
    .select(
      "id, item_number, performer_name, studio_name, status, position, events(id, name, starts_on, ends_on, music_due_on), sections(code, name), entry_music(file_name, size_bytes, uploaded_at)",
    )
    .eq("entered_by", user.id)
    .order("position");

  const list = entries ?? [];
  const links = await musicPlayLinks(list.filter((e) => e.entry_music).map((e) => e.id));
  const today = todayInSydney();

  // Group by event, soonest event first.
  const events = new Map<string, { event: NonNullable<(typeof list)[number]["events"]>; entries: typeof list }>();
  for (const e of list) {
    if (!e.events) continue;
    const group = events.get(e.events.id) ?? { event: e.events, entries: [] };
    group.entries.push(e);
    events.set(e.events.id, group);
  }
  const groups = [...events.values()].sort((a, b) => a.event.starts_on.localeCompare(b.event.starts_on));

  return (
    <div className="space-y-6">
      <div>
        <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
        <h1 className={h1}>My entries and music</h1>
        <p className="text-sm text-slate-600">Upload one music file per entry: MP3, M4A or WAV, up to 20 MB. Press play afterwards to check it&apos;s the right track.</p>
      </div>

      {groups.length === 0 && (
        <p className={muted}>No paid entries yet. Once you pay for entries, they appear here so you can upload music.</p>
      )}

      {groups.map(({ event, entries: rows }) => {
        const due = event.music_due_on ?? event.ends_on;
        const closed = today > due;
        const missing = rows.filter((r) => !r.entry_music && r.status === "entered").length;
        return (
          <section key={event.id} className={`${card} space-y-3`}>
            <div>
              <h2 className={h2}>{event.name}</h2>
              <p className="text-sm text-slate-700">{formatDateRange(event.starts_on, event.ends_on)}</p>
              <p className={`text-sm ${closed ? "text-red-700" : missing ? "font-medium text-amber-700" : "text-emerald-700"}`}>
                {closed
                  ? "Music uploads have closed. Contact the organiser if something needs changing."
                  : `${event.music_due_on ? `Music due ${formatDate(event.music_due_on)}.` : "Please upload music as soon as you can."} ${missing ? `${missing} still to upload.` : "All music uploaded."}`}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.item_number ? `Item ${r.item_number} · ` : ""}
                        {r.sections ? `${r.sections.code} – ${r.sections.name}` : "Section"}
                      </p>
                      <p className="text-slate-600">{r.performer_name}{r.studio_name && r.studio_name !== r.performer_name ? ` · ${r.studio_name}` : ""}</p>
                    </div>
                    {r.status === "scratched" && <span className="text-xs font-medium text-slate-500">Scratched</span>}
                  </div>
                  {r.entry_music ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">
                        <span className="font-medium text-emerald-700">Music uploaded:</span> {r.entry_music.file_name} ({formatFileSize(r.entry_music.size_bytes)}, {formatDateTime(r.entry_music.uploaded_at)})
                      </p>
                      {links[r.id] && <audio controls preload="none" src={links[r.id]} className="h-9 w-full max-w-md" />}
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-amber-700">No music yet</p>
                  )}
                  {!closed && r.status === "entered" && <MusicUpload entryId={r.id} hasMusic={!!r.entry_music} />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function MyEntriesPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <MyEntries />
    </Suspense>
  );
}
