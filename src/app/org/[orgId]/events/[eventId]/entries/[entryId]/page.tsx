import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { buttonSecondary, card, h1, input, label, link, muted } from "@/components/ui";
import { deleteEntry, updateEntry } from "@/app/org/program-actions";

async function EditEntry({ params }: { params: Promise<{ orgId: string; eventId: string; entryId: string }> }) {
  const { orgId, eventId, entryId } = await params;
  const { supabase, event } = await loadManagedEvent(orgId, eventId);
  const [{ data: entry }, { data: sections }] = await Promise.all([
    supabase.from("entries").select("*").eq("id", entryId).eq("event_id", eventId).maybeSingle(),
    supabase.from("sections").select("id, code, name").eq("event_id", eventId).order("position"),
  ]);
  if (!entry) notFound();
  const back = `/org/${orgId}/events/${eventId}/program`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className={muted}><Link href={back} className={link}>{event.name} – Program</Link> /</p>
        <h1 className={h1}>Edit item {entry.item_number ?? "(not numbered yet)"}</h1>
      </div>
      <div className={card}>
        <ActionForm action={updateEntry.bind(null, orgId, eventId, entryId)} submitLabel="Save">
          <div>
            <label htmlFor="section_id" className={label}>Section</label>
            <select id="section_id" name="section_id" defaultValue={entry.section_id} className={input}>
              {(sections ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="item_number" className={label}>Item number</label>
            <input id="item_number" name="item_number" defaultValue={entry.item_number ?? ""} required className={input} />
          </div>
          <div>
            <label htmlFor="performer_name" className={label}>Performer</label>
            <input id="performer_name" name="performer_name" defaultValue={entry.performer_name} required className={input} />
          </div>
          <div>
            <label htmlFor="studio_name" className={label}>Studio</label>
            <input id="studio_name" name="studio_name" defaultValue={entry.studio_name} className={input} />
          </div>
          <div>
            <label htmlFor="routine_title" className={label}>Routine title</label>
            <input id="routine_title" name="routine_title" defaultValue={entry.routine_title} className={input} />
          </div>
        </ActionForm>
      </div>
      <div className={card}>
        <p className="mb-3 text-sm text-slate-600">Usually you&apos;d <strong>scratch</strong> an item instead, so it stays in the records. Delete only removes mistakes.</p>
        <ActionForm action={deleteEntry.bind(null, orgId, eventId, entryId)} submitLabel="Delete this item" pendingLabel="Deleting…" className="" buttonClassName={buttonSecondary} confirmText={`Delete item ${entry.item_number ?? ""} permanently?`} />
      </div>
    </div>
  );
}

export default function EditEntryPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/entries/[entryId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <EditEntry params={params} />
    </Suspense>
  );
}
