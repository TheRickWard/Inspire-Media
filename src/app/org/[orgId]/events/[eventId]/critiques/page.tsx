import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { EventNav } from "@/components/EventNav";
import { ActionForm } from "@/components/ActionForm";
import { CritiqueUpload } from "@/components/CritiqueUpload";
import { CritiqueBulkUpload } from "@/components/CritiqueBulkUpload";
import { critiqueLinks, deleteCritique, setCritiqueRelease } from "@/app/critiques/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { button, buttonSecondary, buttonSmall, card, h2, link, muted } from "@/components/ui";

async function Critiques({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);

  const [{ data: entries }, { data: sessions }, { data: critiques }] = await Promise.all([
    supabase
      .from("entries")
      .select("id, item_number, performer_name, studio_name, entered_by, sections(code, name, session_id)")
      .eq("event_id", eventId)
      .eq("status", "entered")
      .order("position"),
    supabase.from("event_sessions").select("id, name, session_date, critiques_released_at").eq("event_id", eventId).order("position"),
    supabase.from("entry_critiques").select("id, entry_id, file_name, adjudicator, uploaded_at").eq("event_id", eventId).order("uploaded_at"),
  ]);

  const rows = entries ?? [];
  const byEntry = new Map<string, NonNullable<typeof critiques>>();
  for (const c of critiques ?? []) byEntry.set(c.entry_id, [...(byEntry.get(c.entry_id) ?? []), c]);
  const links = await critiqueLinks((critiques ?? []).map((c) => c.id));
  const withCritique = rows.filter((r) => byEntry.has(r.id)).length;
  const missing = rows.length - withCritique;
  const unnumbered = rows.filter((r) => !r.item_number).length;
  const eventReleased = !!event.critiques_released_at;

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="critiques" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}><p className={muted}>Entries with a critique</p><p className="text-2xl font-bold">{withCritique} of {rows.length}</p></div>
        <div className={card}><p className={muted}>Still missing</p><p className={`text-2xl font-bold ${missing ? "text-amber-700" : ""}`}>{missing}</p></div>
        <div className={card}>
          <p className={muted}>Competitors can hear them</p>
          <p className={`text-lg font-semibold ${eventReleased ? "text-emerald-700" : ""}`}>{eventReleased ? `Yes, since ${formatDateTime(event.critiques_released_at)}` : "Not yet"}</p>
        </div>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Release to competitors</h2>
        <p className="text-sm text-slate-600">Critiques stay private until you release them. Then each competitor can play and download their own under <span className="font-medium">My entries</span>.</p>
        <ActionForm
          action={setCritiqueRelease.bind(null, eventId, null, !eventReleased)}
          submitLabel={eventReleased ? "Hide all critiques again" : "Release all critiques"}
          pendingLabel="Saving…"
          className=""
          buttonClassName={eventReleased ? buttonSecondary : button}
          confirmText={eventReleased ? undefined : "Release every critique for this competition to competitors now?"}
        />
        {(sessions ?? []).length > 0 && !eventReleased && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className={muted}>Or one session at a time:</p>
            <ul className="space-y-2">
              {(sessions ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{s.name}</span>
                    {s.session_date && <span className="text-slate-600"> · {formatDate(s.session_date)}</span>}
                    {s.critiques_released_at && <span className="text-emerald-700"> · released</span>}
                  </span>
                  <ActionForm
                    action={setCritiqueRelease.bind(null, eventId, s.id, !s.critiques_released_at)}
                    submitLabel={s.critiques_released_at ? "Hide again" : "Release this session"}
                    pendingLabel="…"
                    className=""
                    buttonClassName={buttonSmall}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Upload recordings</h2>
        <p className="text-sm text-slate-600">
          Choose many recordings at once. Each file is matched to an entry by the item number at the start of its name, for example <span className="font-mono text-xs">12A.mp3</span> or <span className="font-mono text-xs">012A - Jane Jones.m4a</span>. You&apos;ll see the matches before anything uploads. MP3, M4A, WAV or WebM, up to 20 MB each.
        </p>
        {unnumbered > 0 && (
          <p className="text-sm text-amber-700">{unnumbered} {unnumbered === 1 ? "entry has" : "entries have"} no item number yet. Number the program first (Program tab) so recordings can be matched.</p>
        )}
        <CritiqueBulkUpload entries={rows.map((r) => ({ id: r.id, item_number: r.item_number, performer_name: r.performer_name }))} />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className={h2}>Every entry</h2>
          <p className={muted}>Play a critique to check it&apos;s on the right entry. Use &quot;Add critique&quot; for one that&apos;s missing.</p>
        </div>
        {rows.length === 0 ? (
          <p className={`${muted} px-5 py-4`}>No entries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const list = byEntry.get(r.id) ?? [];
              return (
                <li key={r.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[5rem_1fr_minmax(0,22rem)]">
                  <p className="font-semibold">{r.item_number ?? <span className="font-normal text-slate-400">No number</span>}</p>
                  <div>
                    <p className="font-medium">{r.performer_name}{r.studio_name && r.studio_name !== r.performer_name ? <span className="font-normal text-slate-600"> · {r.studio_name}</span> : null}</p>
                    <p className="text-slate-600">{r.sections ? `${r.sections.code} – ${r.sections.name}` : ""}</p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    {list.length === 0 && <p className="text-xs font-medium text-amber-700">No critique yet</p>}
                    {list.map((c) => (
                      <div key={c.id} className="space-y-1">
                        <p className="truncate text-xs text-slate-600" title={c.file_name}>
                          <span className="font-medium text-emerald-700">✓</span> {c.adjudicator ? `${c.adjudicator} · ` : ""}{c.file_name}
                        </p>
                        {links[c.id] && <audio controls preload="none" src={links[c.id].play} className="h-9 w-full" />}
                        <ActionForm action={deleteCritique.bind(null, c.id)} submitLabel="Remove" pendingLabel="…" className="" buttonClassName={buttonSmall} confirmText="Remove this critique?" />
                      </div>
                    ))}
                    <CritiqueUpload entryId={r.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className={muted}>
        Tip: the music and critique files are kept private. Only this competition&apos;s organisers, and each competitor for their own entries (after release), can hear them. <a className={link} href="/privacy">Privacy</a>
      </p>
    </div>
  );
}

export default function CritiquesPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/critiques">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Critiques params={params} />
    </Suspense>
  );
}
