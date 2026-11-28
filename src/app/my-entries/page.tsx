import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatDateTime, todayInSydney } from "@/lib/format";
import { formatFileSize } from "@/lib/music";
import { musicPlayLinks } from "@/app/music/actions";
import { critiqueLinks } from "@/app/critiques/actions";
import { MusicUpload } from "@/components/MusicUpload";
import { card, h1, h2, link, muted } from "@/components/ui";

async function MyEntries() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: entries } = await supabase
    .from("entries")
    .select(
      "id, item_number, performer_name, studio_name, status, position, events(id, name, starts_on, ends_on, music_due_on, critiques_released_at), sections(code, name, event_sessions(critiques_released_at)), entry_music(file_name, size_bytes, uploaded_at), entry_critiques(id, adjudicator, file_name)",
    )
    .eq("entered_by", user.id)
    .order("position");

  // A competitor only sees critiques once the organiser releases them (whole event or the entry's session).
  // The security rules let organisers see every critique, so an organiser who also entered
  // would otherwise hear theirs early. Hide unreleased ones here for everyone.
  const list = (entries ?? []).map((e) => {
    const released = !!(e.events?.critiques_released_at || e.sections?.event_sessions?.critiques_released_at);
    return { ...e, entry_critiques: released ? e.entry_critiques : [] };
  });
  const [links, critique] = await Promise.all([
    musicPlayLinks(list.filter((e) => e.entry_music).map((e) => e.id)),
    critiqueLinks(list.flatMap((e) => e.entry_critiques.map((c) => c.id))),
  ]);
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
        <h1 className={h1}>My entries, music and critiques</h1>
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
            {!event.critiques_released_at && !rows.some((r) => r.entry_critiques.length > 0) && (
              <p className={muted}>Critiques from the adjudicators will appear here once the organiser releases them.</p>
            )}
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
                  {r.entry_critiques.length > 0 && (
                    <div className="space-y-2 rounded-md bg-brand-purple/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Adjudicator&apos;s critique</p>
                      {r.entry_critiques.map((c) =>
                        critique[c.id] ? (
                          <div key={c.id} className="space-y-1">
                            {c.adjudicator && <p className="text-xs text-slate-600">{c.adjudicator}</p>}
                            <audio controls preload="none" src={critique[c.id].play} className="h-9 w-full max-w-md" />
                            <a href={critique[c.id].download} className={`${link} text-xs font-medium`}>Download</a>
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
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
