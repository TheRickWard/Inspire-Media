import Link from "next/link";
import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { EntryControls } from "@/components/EntryControls";
import { EventNav } from "@/components/EventNav";
import { buttonSecondary, card, h2, input, label, link, muted } from "@/components/ui";
import { addLateEntry, numberEntries } from "@/app/org/program-actions";

async function Program({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);

  const [{ data: sections }, { data: entries }] = await Promise.all([
    supabase.from("sections").select("id, code, name, event_sessions(name)").eq("event_id", eventId).order("position"),
    supabase.from("entries").select("id, section_id, item_number, performer_name, studio_name, routine_title, status, is_late_entry, position").eq("event_id", eventId).order("position"),
  ]);

  // Sections appear in running order (by their first item); empty sections go last.
  const firstPos = new Map<string, number>();
  (entries ?? []).forEach((e) => { if (!firstPos.has(e.section_id)) firstPos.set(e.section_id, e.position); });
  const orderedSections = [...(sections ?? [])].sort(
    (a, b) => (firstPos.get(a.id) ?? Infinity) - (firstPos.get(b.id) ?? Infinity),
  );

  const unnumbered = (entries ?? []).filter((e) => !e.item_number).length;
  const numbered = (entries ?? []).length - unnumbered;

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="program" />

      {(entries ?? []).length > 0 && (
        <section className={`${card} space-y-3`}>
          <h2 className={h2}>Item numbers</h2>
          <p className="text-sm text-slate-600">
            {unnumbered === 0
              ? "Every entry has an item number."
              : `${unnumbered} ${unnumbered === 1 ? "entry is" : "entries are"} not numbered yet (usually new online entries).`}{" "}
            Numbers follow the running order below, so move items into place first.
          </p>
          <div className="flex flex-wrap gap-3">
            {numbered > 0 && (
              <ActionForm
                action={numberEntries.bind(null, eventId, "new")}
                submitLabel="Number new entries only"
                pendingLabel="Numbering…"
                className=""
              />
            )}
            <ActionForm
              action={numberEntries.bind(null, eventId, "all")}
              submitLabel={numbered === 0 ? "Number all entries 1, 2, 3…" : "Renumber the whole program 1, 2, 3…"}
              pendingLabel="Numbering…"
              className=""
              buttonClassName={numbered > 0 ? buttonSecondary : undefined}
              confirmText={numbered > 0 ? "This changes the item numbers of entries that already have one. Anyone who has seen the old numbers will need the new ones. Continue?" : undefined}
            />
          </div>
          {numbered > 0 && (
            <p className={muted}>
              &quot;New entries only&quot; keeps existing numbers and gives each new entry the number before it plus a letter (e.g. 12A).
              &quot;Renumber&quot; starts again from 1.
            </p>
          )}
        </section>
      )}

      {(sections ?? []).length === 0 ? (
        <div className={card}>
          <p>The program is empty. <Link href={`/org/${orgId}/events/${eventId}/import`} className={link}>Import a CSV file</Link> or <Link href={`/org/${orgId}/events/${eventId}/sections`} className={link}>add sections</Link> first.</p>
        </div>
      ) : (
        <section className={card}>
          <h2 className={h2}>Add a late entry</h2>
          <p className={`${muted} mb-3`}>It goes at the end of its section. Use the arrows to move it.</p>
          <ActionForm action={addLateEntry.bind(null, eventId)} submitLabel="Add late entry" pendingLabel="Adding…" className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <div className="sm:col-span-2">
              <label htmlFor="section_id" className={label}>Section</label>
              <select id="section_id" name="section_id" required className={input}>
                {(sections ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="item_number" className={label}>Item no.</label>
              <input id="item_number" name="item_number" required placeholder="e.g. 45A" className={input} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="performer_name" className={label}>Performer</label>
              <input id="performer_name" name="performer_name" required className={input} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="studio_name" className={label}>Studio</label>
              <input id="studio_name" name="studio_name" className={input} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="routine_title" className={label}>Routine title</label>
              <input id="routine_title" name="routine_title" className={input} />
            </div>
          </ActionForm>
        </section>
      )}

      {orderedSections.map((s) => {
        const items = (entries ?? []).filter((e) => e.section_id === s.id);
        return (
          <section key={s.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
              <h3 className="font-semibold">Section {s.code} – {s.name}</h3>
              <span className={muted}>{s.event_sessions?.name ? `${s.event_sessions.name} · ` : ""}{items.length} items</span>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No items yet.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="w-16 px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium">Performer</th>
                      <th className="px-4 py-2 font-medium">Studio</th>
                      <th className="px-4 py-2 font-medium">Routine</th>
                      <th className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((e, i) => (
                      <tr key={e.id} className={e.status === "scratched" ? "bg-red-50/60 text-slate-400" : ""}>
                        <td className="px-4 py-2 font-mono font-semibold">{e.item_number ?? <span className="font-sans text-xs font-normal text-slate-400">not numbered</span>}</td>
                        <td className="px-4 py-2">
                          <span className={e.status === "scratched" ? "line-through" : ""}>{e.performer_name}</span>
                          {e.status === "scratched" && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">Scratched</span>}
                          {e.is_late_entry && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Late entry</span>}
                        </td>
                        <td className="px-4 py-2">{e.studio_name}</td>
                        <td className="px-4 py-2">{e.routine_title}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <EntryControls entryId={e.id} status={e.status} isFirst={i === 0} isLast={i === items.length - 1} />
                            <Link href={`/org/${orgId}/events/${eventId}/entries/${e.id}`} className="text-xs font-medium text-brand-purple hover:underline">Edit</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function ProgramPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/program">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Program params={params} />
    </Suspense>
  );
}
